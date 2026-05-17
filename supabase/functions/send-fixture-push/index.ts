import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import * as jose from "https://esm.sh/jose@5.2.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!isServiceRole) {
      const token = authHeader?.replace("Bearer ", "")?.trim();
      if (!token) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized: Missing auth token" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
         return new Response(JSON.stringify({ success: false, error: "Unauthorized: " + (authError?.message || "Invalid user") }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 401,
         });
      }
    }

    const bodyText = await req.text();
    if (!bodyText) {
      throw new Error("Empty body");
    }

    let bodyJson;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      throw new Error("Invalid JSON body");
    }

    const { type, fixtureId } = bodyJson;

    if (!type || !fixtureId) {
      throw new Error("Missing 'type' or 'fixtureId' in body");
    }

    // 1. Get Fixture and related teams
    const { data: fixture, error: fixError } = await supabase
      .from('fixtures')
      .select(`
        id, 
        home_team:teams!home_team_id ( id, name, club_id ),
        away_team:teams!away_team_id ( id, name, club_id )
      `)
      .eq('id', fixtureId)
      .single();

    if (fixError || !fixture) {
      throw new Error(`Fixture not found or error loading: ${fixError?.message}`);
    }

    const homeTeam = fixture.home_team;
    const awayTeam = fixture.away_team;
    const homeClubId = homeTeam?.club_id;
    const awayClubId = awayTeam?.club_id;
    const homeName = homeTeam?.name || "Home";
    const awayName = awayTeam?.name || "Away";

    // 2. Fetch Relevant Users
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, favorite_club_id, role');

    let relevantUserIds: string[] = [];
    let recipientsMode = "target_fans_and_admins";

    if (profError || !profiles || profiles.length === 0) {
       console.log("Could not load profiles or no profiles. Fallback to admins.");
       recipientsMode = "admins_only_fallback";
    } else {
      const isClubValid = (clubId: string) => clubId && (clubId === homeClubId || clubId === awayClubId);
      
      const filteredProfiles = profiles.filter(p => 
         p.role === 'admin' || isClubValid(p.favorite_club_id)
      );

      relevantUserIds = filteredProfiles.map(p => p.id);

      if (relevantUserIds.length === 0) {
        // Fallback: just send to admins if no fans
        const admins = profiles.filter(p => p.role === 'admin');
        relevantUserIds = admins.map(p => p.id);
        if (relevantUserIds.length > 0) {
          recipientsMode = "admins_only_fallback";
        }
      }
    }

    if (relevantUserIds.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        type, 
        fixtureId,
        recipientsMode,
        recipientsFound: 0,
        tokensFound: 0,
        sent: 0,
        skippedDuplicates: 0,
        failed: 0,
        results: []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3. Load Push Tokens
    const { data: pushTokens, error: tokenErr } = await supabase
      .from('push_tokens')
      .select('user_id, token, platform')
      .in('user_id', relevantUserIds)
      .eq('platform', 'ios');

    if (tokenErr || !pushTokens || pushTokens.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        type, 
        fixtureId,
        recipientsMode,
        recipientsFound: relevantUserIds.length,
        tokensFound: 0,
        sent: 0,
        skippedDuplicates: 0,
        failed: 0,
        results: []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Prepare Messages
    let title = "";
    let body = "";

    if (type === "voting_open") {
      title = "Voting ist offen";
      body = `${homeName} vs ${awayName}: Bewerte jetzt die Spieler.`;
    } else if (type === "results_ready") {
      title = "Ratings sind da";
      body = `${homeName} vs ${awayName}: Die neuen Ratings sind verfügbar.`;
    } else {
      title = "Update";
      body = `${homeName} vs ${awayName}`;
    }

    // Setup APNs
    const apnsKeyId = Deno.env.get('APNS_KEY_ID');
    const apnsTeamId = Deno.env.get('APPLE_TEAM_ID');
    const apnsPrivateKeyString = Deno.env.get('APNS_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    const apnsBundleId = Deno.env.get('APNS_BUNDLE_ID');
    const apnsEnv = Deno.env.get('APNS_ENV') || 'development';

    let canSendAPNs = true;
    if (!apnsKeyId || !apnsTeamId || !apnsPrivateKeyString || !apnsBundleId) {
      canSendAPNs = false;
    }

    let jwtToken = "";
    if (canSendAPNs) {
      const privateKey = await jose.importPKCS8(apnsPrivateKeyString!, "ES256");
      jwtToken = await new jose.SignJWT({})
        .setProtectedHeader({ alg: "ES256", kid: apnsKeyId })
        .setIssuer(apnsTeamId!)
        .setIssuedAt(Math.floor(Date.now() / 1000))
        .sign(privateKey);
    }

    const host = apnsEnv === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const results = [];

    // Send push to each token individually
    for (const pt of pushTokens) {
      // Check Duplicate
      const { data: existingLog } = await supabase
        .from('push_notification_log')
        .select('id')
        .eq('user_id', pt.user_id)
        .eq('fixture_id', fixtureId)
        .eq('notification_type', type)
        .maybeSingle();

      if (existingLog) {
        skippedCount++;
        results.push({ user_id: pt.user_id, token_start: pt.token.substring(0, 25), status: 'skipped_duplicate' });
        continue;
      }

      if (!canSendAPNs) {
        failedCount++;
        results.push({ user_id: pt.user_id, status: 'failed', reason: 'Missing APNS credentials' });
        continue;
      }

      const payload = {
        aps: {
          alert: {
            title: title,
            body: body,
          },
          sound: "default"
        },
        type,
        fixtureId
      };

      try {
        const response = await fetch(`https://${host}/3/device/${pt.token}`, {
          method: "POST",
          headers: {
            "authorization": `bearer ${jwtToken}`,
            "apns-topic": apnsBundleId!,
            "apns-push-type": "alert"
          },
          body: JSON.stringify(payload)
        });

        const status = response.status;
        const text = await response.text();

        let isSuccess = status === 200;
        
        let providerResp = null;
        if (text) {
          try {
            providerResp = JSON.parse(text);
          } catch(e) {
            providerResp = { raw: text };
          }
        }

        await supabase.from('push_notification_log').insert({
          user_id: pt.user_id,
          fixture_id: fixtureId,
          notification_type: type,
          title,
          body,
          platform: 'ios',
          token_start: pt.token.substring(0, 25),
          success: isSuccess,
          provider_status: status.toString(),
          provider_response: providerResp
        });

        if (isSuccess) {
          sentCount++;
          results.push({ user_id: pt.user_id, token_start: pt.token.substring(0, 25), status: 'sent' });
        } else {
          failedCount++;
          results.push({ user_id: pt.user_id, token_start: pt.token.substring(0, 25), status: 'failed', provider_status: status, response: providerResp });
        }
      } catch (err: any) {
        failedCount++;
        results.push({ user_id: pt.user_id, token_start: pt.token.substring(0, 25), status: 'error', error: err.message });

        await supabase.from('push_notification_log').insert({
          user_id: pt.user_id,
          fixture_id: fixtureId,
          notification_type: type,
          title,
          body,
          platform: 'ios',
          token_start: pt.token.substring(0, 25),
          success: false,
          provider_status: 'error',
          provider_response: { error: err.message }
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      type, 
      fixtureId,
      recipientsMode,
      recipientsFound: relevantUserIds.length,
      tokensFound: pushTokens.length,
      sent: sentCount,
      skippedDuplicates: skippedCount,
      failed: failedCount,
      results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
