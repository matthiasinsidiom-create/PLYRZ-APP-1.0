// Supabase Edge Function: match-processor
// This function is triggered by Supabase Cron (pg_cron)
// It performs the full automation logic for processing match results.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

serve(async (req) => {
  const APP_URL = Deno.env.get("APP_URL");
  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const now = new Date().toISOString();
  console.log(`[AUTOMATION] Edge Function started at ${now}`);

  if (!APP_URL || !CRON_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[AUTOMATION] ERROR: Missing environment variables");
    return new Response(JSON.stringify({ error: "Missing configuration" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const processedFixtureIds: string[] = [];
  const skippedFixtureIds: string[] = [];
  const errors: any[] = [];

  try {
    // 1. Query eligible fixtures
    console.log(`[AUTOMATION] Querying eligible fixtures (status=finished, voting_close_at < now, results_processed_at is null)...`);
    const { data: fixtures, error: fetchError } = await supabase
      .from('fixtures')
      .select('id, status, voting_close_at, results_processed_at')
      .eq('status', 'finished')
      .not('voting_close_at', 'is', null)
      .lt('voting_close_at', now)
      .is('results_processed_at', null);

    if (fetchError) {
      console.error("[AUTOMATION] Error fetching fixtures:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const eligibleFixtureCount = fixtures?.length || 0;
    console.log(`[AUTOMATION] Eligible fixture count: ${eligibleFixtureCount}`);
    
    if (eligibleFixtureCount === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No fixtures to process",
        eligibleFixtureCount
      }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`[AUTOMATION] Eligible fixture IDs:`, fixtures?.map(f => f.id));

    // 2. Process each fixture by calling the backend
    for (const fixture of fixtures!) {
      console.log(`[AUTOMATION] Triggering backend for fixture: ${fixture.id}`);
      
      try {
        const baseUrl = APP_URL.endsWith('/') ? APP_URL.slice(0, -1) : APP_URL;
        const apiUrl = `${baseUrl}/api/automation/run-processor`;
        
        console.log(`[AUTOMATION] Calling backend URL: ${apiUrl}`);
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${CRON_SECRET}`
          },
          body: JSON.stringify({ fixtureId: fixture.id })
        });

        const httpStatus = response.status;
        const contentType = response.headers.get("content-type") || "none";
        console.log(`[AUTOMATION] Backend response for ${fixture.id}: HTTP ${httpStatus}, Content-Type: ${contentType}`);

        let backendResult;
        if (contentType.includes("application/json")) {
          backendResult = await response.json();
          console.log(`[AUTOMATION] Parsed backend JSON for ${fixture.id}:`, JSON.stringify(backendResult));
        } else {
          const text = await response.text();
          console.error(`[AUTOMATION] ERROR: Backend returned non-JSON response for ${fixture.id}:`, text.slice(0, 500));
          errors.push({ id: fixture.id, error: "Non-JSON response", details: text.slice(0, 200) });
          skippedFixtureIds.push(fixture.id);
          continue;
        }
        
        // STRICT VALIDATION
        if (!response.ok) {
          console.error(`[AUTOMATION] ERROR: Backend returned HTTP ${httpStatus} for ${fixture.id}:`, backendResult);
          errors.push({ id: fixture.id, error: `HTTP ${httpStatus}`, details: backendResult });
          skippedFixtureIds.push(fixture.id);
          continue;
        }

        if (backendResult.success !== true) {
          console.error(`[AUTOMATION] ERROR: Backend JSON success is not true for ${fixture.id}:`, backendResult);
          errors.push({ id: fixture.id, error: "Success flag missing", details: backendResult });
          skippedFixtureIds.push(fixture.id);
          continue;
        }

        console.log(`[AUTOMATION] SUCCESS: Backend successfully processed fixture ${fixture.id}`);
        processedFixtureIds.push(fixture.id);
      } catch (err) {
        console.error(`[AUTOMATION] EXCEPTION during backend call for ${fixture.id}:`, err.message);
        errors.push({ id: fixture.id, error: "Exception", details: err.message });
        skippedFixtureIds.push(fixture.id);
      }
    }

    // FINAL SUMMARY - Never update results_processed_at here!
    return new Response(JSON.stringify({ 
      success: errors.length === 0, 
      eligibleFixtureCount,
      processedFixtureIds,
      skippedFixtureIds,
      errors
    }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(`[AUTOMATION] FATAL ERROR in Edge Function:`, error.message);
    return new Response(JSON.stringify({ 
      error: error.message,
      processedFixtureIds,
      skippedFixtureIds
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
})
