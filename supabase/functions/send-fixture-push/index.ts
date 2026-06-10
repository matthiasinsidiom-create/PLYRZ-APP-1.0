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
    const validClubs = [homeClubId, awayClubId].filter(id => id != null);
    let relevantUserIdsInfo = new Set<string>();
    
    // a) Admins and Fans
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, favorite_club_id, role');

    if (profiles) {
      profiles.forEach(p => {
        if (p.role === 'admin' || validClubs.includes(p.favorite_club_id)) {
          relevantUserIdsInfo.add(p.id);
        }
      });
    }

    // b) Club Admins
    if (validClubs.length > 0) {
      const { data: clubAdmins } = await supabase
        .from('club_admins')
        .select('user_id, club_id')
        .in('club_id', validClubs);
        
      if (clubAdmins) {
        clubAdmins.forEach(ca => {
          if (ca.user_id) relevantUserIdsInfo.add(ca.user_id);
        });
      }
      
      // c) Claimed Players
      const { data: players } = await supabase
        .from('players')
        .select('claimed_by_user_id, team_id, club_id')
        .not('claimed_by_user_id', 'is', null);
        
      if (players) {
        const { data: relevantTeams } = await supabase
          .from('teams')
          .select('id')
          .in('club_id', validClubs);
          
        const relevantTeamIds = new Set(relevantTeams?.map(t => t.id) || []);
        
        players.forEach(p => {
          if (validClubs.includes(p.club_id) || relevantTeamIds.has(p.team_id)) {
             relevantUserIdsInfo.add(p.claimed_by_user_id);
          }
        });
      }
    }

    let relevantUserIds = Array.from(relevantUserIdsInfo);
    let recipientsMode = "target_fans_admins_and_players";

    if (relevantUserIds.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        type, 
        fixtureId,
        recipientsMode,
        recipientsFound: 0,
        iosTokensFound: 0,
        androidTokensFound: 0,
        iosSent: 0,
        androidSent: 0,
        skippedDuplicates: 0,
        failed: 0,
        results: []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3. Load Push Tokens (Both iOS and Android)
    const { data: pushTokens, error: tokenErr } = await supabase
      .from('push_tokens')
      .select('user_id, token, platform')
      .in('user_id', relevantUserIds);

    if (tokenErr || !pushTokens || pushTokens.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        type, 
        fixtureId,
        recipientsMode,
        recipientsFound: relevantUserIds.length,
        iosTokensFound: 0,
        androidTokensFound: 0,
        iosSent: 0,
        androidSent: 0,
        skippedDuplicates: 0,
        failed: 0,
        results: []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const iosTokens = pushTokens.filter(t => t.platform === 'ios');
    const androidTokens = pushTokens.filter(t => t.platform === 'android');

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

    // Setup FCM
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');
    const canSendFCM = !!fcmServerKey;

    let iosSent = 0;
    let androidSent = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const results = [];

    // Send push to each token individually
    for (const pt of pushTokens) {
      // Check Duplicate (includes platform)
      const { data: existingLog } = await supabase
        .from('push_notification_log')
        .select('id')
        .eq('user_id', pt.user_id)
        .eq('fixture_id', fixtureId)
        .eq('notification_type', type)
        .eq('platform', pt.platform)
        .maybeSingle();

      if (existingLog) {
        skippedCount++;
        results.push({ user_id: pt.user_id, platform: pt.platform, token_start: pt.token.substring(0, 25), status: 'skipped_duplicate' });
        continue;
      }

      if (pt.platform === 'ios') {
        if (!canSendAPNs) {
          failedCount++;
          results.push({ user_id: pt.user_id, platform: 'ios', status: 'failed', reason: 'Missing APNS credentials' });
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
            try { providerResp = JSON.parse(text); } catch(e) { providerResp = { raw: text }; }
          }

          try {
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
          } catch(e) { console.error('Log insert duplicate error ignored'); }

          if (isSuccess) {
            iosSent++;
            results.push({ user_id: pt.user_id, platform: 'ios', token_start: pt.token.substring(0, 25), status: 'sent' });
          } else {
            failedCount++;
            results.push({ user_id: pt.user_id, platform: 'ios', token_start: pt.token.substring(0, 25), status: 'failed', provider_status: status, response: providerResp });
          }
        } catch (err: any) {
          failedCount++;
          results.push({ user_id: pt.user_id, platform: 'ios', token_start: pt.token.substring(0, 25), status: 'error', error: err.message });
          
          try {
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
          } catch(e) { /* ignore uniqueness issues */ }
        }
      } else if (pt.platform === 'android') {
        if (!canSendFCM) {
          failedCount++;
          results.push({ user_id: pt.user_id, platform: 'android', status: 'skipped', reason: 'Missing FCM credentials' });
          // Note: we do not log missing config to DB to avoid DB bloat when FCM isn't setup.
          continue;
        }

        const payload = {
          to: pt.token,
          notification: {
            title: title,
            body: body,
            sound: "default"
          },
          data: {
            type,
            fixtureId
          }
        };

        try {
          const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: "POST",
            headers: {
              "Authorization": `key=${fcmServerKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });

          const status = response.status;
          const text = await response.text();
          let isSuccess = status === 200;
          
          let providerResp = null;
          if (text) {
            try { providerResp = JSON.parse(text); } catch(e) { providerResp = { raw: text }; }
          }

          // Check if FCM indicated failure in response even with 200 OK
          if (isSuccess && providerResp?.failure && providerResp.failure > 0) {
             isSuccess = false;
          }

          try {
            await supabase.from('push_notification_log').insert({
              user_id: pt.user_id,
              fixture_id: fixtureId,
              notification_type: type,
              title,
              body,
              platform: 'android',
              token_start: pt.token.substring(0, 25),
              success: isSuccess,
              provider_status: status.toString(),
              provider_response: providerResp
            });
          } catch(e) { console.error('Log insert duplicate error ignored'); }

          if (isSuccess) {
            androidSent++;
            results.push({ user_id: pt.user_id, platform: 'android', token_start: pt.token.substring(0, 25), status: 'sent' });
          } else {
            failedCount++;
            results.push({ user_id: pt.user_id, platform: 'android', token_start: pt.token.substring(0, 25), status: 'failed', provider_status: status, response: providerResp });
          }
        } catch (err: any) {
          failedCount++;
          results.push({ user_id: pt.user_id, platform: 'android', token_start: pt.token.substring(0, 25), status: 'error', error: err.message });
          
          try {
            await supabase.from('push_notification_log').insert({
              user_id: pt.user_id,
              fixture_id: fixtureId,
              notification_type: type,
              title,
              body,
              platform: 'android',
              token_start: pt.token.substring(0, 25),
              success: false,
              provider_status: 'error',
              provider_response: { error: err.message }
            });
          } catch(e) { /* ignore */ }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      type, 
      fixtureId,
      recipientsMode,
      recipientsFound: relevantUserIds.length,
      iosTokensFound: iosTokens.length,
      androidTokensFound: androidTokens.length,
      iosSent,
      androidSent,
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
