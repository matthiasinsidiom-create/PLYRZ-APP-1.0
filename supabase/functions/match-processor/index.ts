import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  // Handle OPTIONS requests immediately for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let body: any = {};
    
    if (contentType.includes("application/json")) {
      body = await req.json();
    }

    console.log(`[match-processor] Request received. Body:`, JSON.stringify(body));

    const fixtureId = body.fixtureId;
    let APP_URL = body.appUrl || Deno.env.get('APP_URL') || "";
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";

    if (!APP_URL) {
      console.error("[match-processor] APP_URL not found in request body or environment.");
      throw new Error("Server configuration error: APP_URL missing");
    }

    // Ensure protocol exists
    if (!APP_URL.startsWith('http')) {
      console.log(`[match-processor] APP_URL missing protocol, prepending https://`);
      APP_URL = `https://${APP_URL}`;
    }

    // Ensure no trailing slash
    if (APP_URL.endsWith('/')) {
      APP_URL = APP_URL.slice(0, -1);
    }

    // Manual processing mode (triggered from the app)
    if (fixtureId) {
      const endpoint = `${APP_URL}/api/admin/process-fixture-results`;
      console.log(`[match-processor] Starting manual processing for fixture: ${fixtureId}`);
      console.log(`[match-processor] Targeting backend: ${endpoint}`);
      
      const userAuthHeader = req.headers.get("Authorization") ?? "";
      if (!userAuthHeader) {
        console.warn("[match-processor] No Authorization header received from client.");
      }

      // Call the manual processing endpoint on the main app backend
      let backendResponse;
      try {
        console.log(`[match-processor] Sending request to backend...`);
        backendResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': userAuthHeader
          },
          body: JSON.stringify({ fixtureId })
        });
      } catch (fetchError: any) {
        console.error("[match-processor] Failed to fetch backend:", fetchError.message);
        throw new Error(`Failed to contact main app backend at ${endpoint}: ${fetchError.message}`);
      }

      const responseText = await backendResponse.text();
      console.log(`[match-processor] Backend responded with status: ${backendResponse.status}`);
      
      let backendResult: any = null;
      try {
        if (responseText && responseText.trim()) {
          backendResult = JSON.parse(responseText);
        } else {
          console.warn("[match-processor] Empty response from backend");
          throw new Error("Empty response body");
        }
      } catch (e) {
        console.error("[match-processor] Backend returned non-JSON response. Status:", backendResponse.status);
        console.error("[match-processor] Response Body (first 500 chars):", responseText.substring(0, 500));
        
        // Return a clear error to the app
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Backend returned invalid response (Not JSON)",
          status: backendResponse.status,
          endpoint: endpoint,
          details: (responseText || "Empty Response").substring(0, 500)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      // Requirement 7: Only update results_processed_at if backend response is JSON and success === true
      if (backendResult && typeof backendResult === 'object' && backendResult.success === true) {
        console.log(`[match-processor] Backend reports SUCCESS for ${fixtureId}. Updating fixture record...`);
        
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { error: updateError } = await supabaseAdmin
          .from('fixtures')
          .update({ results_processed_at: new Date().toISOString() })
          .eq('id', fixtureId);

        if (updateError) {
          console.error("[match-processor] Error updating fixture status in database:", updateError);
          // We still return success since the processing itself succeeded
        }

        return new Response(JSON.stringify({ success: true, data: backendResult }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } else {
        console.error("[match-processor] Backend reported FAILURE:", backendResult);
        return new Response(JSON.stringify({ 
          success: false, 
          error: backendResult?.error || "Backend processing failed",
          status: backendResponse.status,
          data: backendResult 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: backendResponse.status === 200 ? 400 : backendResponse.status,
        });
      }
    } else {
      // Automation mode (Cron or general processor trigger)
      // Always use environment APP_URL for cron, as origin isn't available
      const CRON_URL = Deno.env.get('APP_URL') || APP_URL;
      console.log(`[match-processor] No fixtureId provided. Running automation check for: ${CRON_URL}`);
      
      const CRON_SECRET = Deno.env.get('CRON_SECRET') || "";
      const automationResponse = await fetch(`${CRON_URL}/api/automation/run-processor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CRON_SECRET}`
        }
      });

      const autoResult = await automationResponse.text();
      return new Response(JSON.stringify({ success: true, mode: "automation", result: autoResult }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

  } catch (error: any) {
    console.error('[match-processor] Critical Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
