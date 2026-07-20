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
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized: Missing auth token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "").trim();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized: " + (authError?.message || "Invalid user") }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Check if user is superadmin
    const { data: profile } = await supabase.from('profiles').select('role, email').eq('id', user.id).maybeSingle();
    const isAdmin = profile?.role === 'admin' || user.email === 'matthias.insidiom@gmail.com' || profile?.email?.toLowerCase() === 'matthias.insidiom@gmail.com';
    
    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden: Superadmin only" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const bodyText = await req.text();
    if (!bodyText) {
      throw new Error("Empty body");
    }

    let bodyJson;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch (e) {
      throw new Error("Invalid JSON body");
    }

    const { action, audienceType, platform, clubId, userId, title, message, confirmationRecipientCount } = bodyJson;

    if (!['estimate', 'send_test', 'send'].includes(action)) {
      throw new Error("Invalid action");
    }

    let targetUserIds: string[] | null = null; // null means all users (or based on platform)

    if (action === 'send_test') {
      targetUserIds = [user.id];
    } else {
      if (audienceType === 'user') {
        if (!userId) throw new Error("Missing userId for audienceType user");
        targetUserIds = [userId];
      } else if (audienceType === 'club') {
        if (!clubId) throw new Error("Missing clubId for audienceType club");
        const userSet = new Set<string>();

        // Fans
        const { data: fans } = await supabase.from('profiles').select('id').eq('favorite_club_id', clubId);
        fans?.forEach(f => userSet.add(f.id));

        // Club Admins
        const { data: admins } = await supabase.from('club_admins').select('user_id').eq('club_id', clubId);
        admins?.forEach(a => userSet.add(a.user_id));

        // Teams of the club
        const { data: teams } = await supabase.from('teams').select('id').eq('club_id', clubId);
        const teamIds = teams?.map(t => t.id) || [];

        // Players
        let playerQuery = supabase.from('players').select('claimed_by_user_id').not('claimed_by_user_id', 'is', null);
        if (teamIds.length > 0) {
          playerQuery = playerQuery.or(`club_id.eq.${clubId},team_id.in.(${teamIds.join(',')})`);
        } else {
          playerQuery = playerQuery.eq('club_id', clubId);
        }
        
        const { data: players } = await playerQuery;
        players?.forEach(p => {
          if (p.claimed_by_user_id) userSet.add(p.claimed_by_user_id);
        });

        targetUserIds = Array.from(userSet);
      }
    }

    // Fetch Push Tokens
    let tokensQuery = supabase.from('push_tokens').select('*');
    if (targetUserIds !== null) {
      if (targetUserIds.length === 0) {
        if (action === 'estimate') {
          return new Response(JSON.stringify({ success: true, recipientCount: 0, iosCount: 0, androidCount: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
        }
        throw new Error("No users found for target audience");
      }
      
      // Batch 'in' queries to avoid URL too long if many users
      const BATCH_SIZE = 500;
      let allTokens: any[] = [];
      for (let i = 0; i < targetUserIds.length; i += BATCH_SIZE) {
        const batch = targetUserIds.slice(i, i + BATCH_SIZE);
        let q = supabase.from('push_tokens').select('*').in('user_id', batch);
        if (platform) q = q.eq('platform', platform);
        const { data: batchTokens } = await q;
        if (batchTokens) allTokens = allTokens.concat(batchTokens);
      }
      tokensQuery = null as any; // Skip the single query below
      var pushTokens = allTokens;
    } else {
      if (platform) tokensQuery = tokensQuery.eq('platform', platform);
      const { data: tokens } = await tokensQuery;
      var pushTokens = tokens || [];
    }

    // Deduplicate by token value
    const uniqueTokensMap = new Map<string, any>();
    pushTokens.forEach(pt => {
      uniqueTokensMap.set(pt.token, pt);
    });
    const finalTokens = Array.from(uniqueTokensMap.values());

    const iosTokens = finalTokens.filter(t => t.platform === 'ios');
    const androidTokens = finalTokens.filter(t => t.platform === 'android');

    if (action === 'estimate') {
      return new Response(JSON.stringify({
        success: true,
        recipientCount: finalTokens.length,
        iosCount: iosTokens.length,
        androidCount: androidTokens.length
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Validation for send and send_test
    if (!title || title.trim().length < 2 || title.trim().length > 60) {
      throw new Error("Titel muss zwischen 2 und 60 Zeichen lang sein.");
    }
    if (!message || message.trim().length < 2 || message.trim().length > 240) {
      throw new Error("Nachricht muss zwischen 2 und 240 Zeichen lang sein.");
    }

    if (action === 'send' && confirmationRecipientCount !== undefined) {
      if (confirmationRecipientCount !== finalTokens.length) {
        return new Response(JSON.stringify({ success: false, error: "Conflict: Recipient count changed." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409,
        });
      }
    }

    // Initialize APNs and FCM
    let canSendAPNs = false;
    let jwtToken = "";
    let host = "api.push.apple.com";
    const apnsKey = Deno.env.get("APNS_KEY_CONTENT");
    const apnsKeyId = Deno.env.get("APNS_KEY_ID");
    const apnsTeamId = Deno.env.get("APNS_TEAM_ID");
    const apnsBundleId = Deno.env.get("APNS_BUNDLE_ID");

    if (apnsKey && apnsKeyId && apnsTeamId && apnsBundleId) {
      try {
        const privateKey = await jose.importPKCS8(apnsKey.replace(/\\n/g, "\n"), "ES256");
        jwtToken = await new jose.SignJWT({})
          .setProtectedHeader({ alg: "ES256", kid: apnsKeyId })
          .setIssuer(apnsTeamId)
          .setIssuedAt()
          .sign(privateKey);
        canSendAPNs = true;
      } catch (e) {
        console.error("APNS setup failed", e);
      }
    }

    let canSendFCM = false;
    let fcmAccessToken = "";
    const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
    const firebaseClientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
    const firebasePrivateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");

    if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
      try {
        const privateKey = await jose.importPKCS8(firebasePrivateKey.replace(/\\n/g, "\n"), "RS256");
        const fcmJwt = await new jose.SignJWT({
          iss: firebaseClientEmail,
          sub: firebaseClientEmail,
          aud: "https://oauth2.googleapis.com/token",
          scope: "https://www.googleapis.com/auth/firebase.messaging"
        })
          .setProtectedHeader({ alg: "RS256", typ: "JWT" })
          .setIssuedAt(Math.floor(Date.now() / 1000))
          .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
          .sign(privateKey);

        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: fcmJwt
          })
        });

        if (!tokenResponse.ok) {
          console.error("FCM Access Token fetch failed", await tokenResponse.text());
        } else {
          const tokenData = await tokenResponse.json();
          fcmAccessToken = tokenData.access_token;
          canSendFCM = true;
        }
      } catch (e) {
        console.error("FCM setup failed", e);
      }
    }

    // Create Push Campaign
    const campaignType = action === 'send_test' ? 'test' : audienceType;
    let campaignId: string | null = null;
    
    try {
      const { data: campaign, error: campaignError } = await supabase.from('push_campaigns').insert({
        title: title.trim(),
        message: message.trim(),
        audience_type: campaignType,
        status: 'sending',
        sending_started_at: new Date().toISOString(),
        estimated_recipients: finalTokens.length,
        ios_count: iosTokens.length,
        android_count: androidTokens.length,
        created_by: user.id
      }).select('id').single();
      
      if (!campaignError && campaign) {
        campaignId = campaign.id;
      } else {
        console.error("Failed to create campaign record", campaignError);
      }
    } catch (e) {
      console.error("Error creating campaign", e);
    }

    let iosSent = 0;
    let androidSent = 0;
    let failedCount = 0;
    const results = [];

    for (const pt of finalTokens) {
      if (pt.platform === 'ios') {
        if (!canSendAPNs) {
          failedCount++;
          results.push({ user_id: pt.user_id, platform: 'ios', status: 'failed', reason: 'Missing APNS credentials' });
          continue;
        }
        
        const payload = {
          aps: {
            alert: { title: title.trim(), body: message.trim() },
            sound: "default"
          },
          type: "manual",
          category: "general",
          campaign_id: campaignId,
          is_test: action === 'send_test'
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
              notification_type: 'manual',
              title: title.trim(),
              body: message.trim(),
              platform: 'ios',
              token_start: pt.token.substring(0, 25),
              success: isSuccess,
              provider_status: status.toString(),
              provider_response: providerResp,
              campaign_id: campaignId
            });
          } catch(e) {}

          if (isSuccess) {
            iosSent++;
            results.push({ user_id: pt.user_id, platform: 'ios', token_start: pt.token.substring(0, 25), status: 'sent' });
          } else {
            failedCount++;
            results.push({ user_id: pt.user_id, platform: 'ios', token_start: pt.token.substring(0, 25), status: 'failed', provider_status: status });
          }
        } catch (err: any) {
          failedCount++;
          results.push({ user_id: pt.user_id, platform: 'ios', token_start: pt.token.substring(0, 25), status: 'error', error: err.message });
          try {
            await supabase.from('push_notification_log').insert({
              user_id: pt.user_id,
              notification_type: 'manual',
              title: title.trim(),
              body: message.trim(),
              platform: 'ios',
              token_start: pt.token.substring(0, 25),
              success: false,
              provider_status: 'error',
              provider_response: { error: err.message },
              campaign_id: campaignId
            });
          } catch(e) {}
        }
      } else if (pt.platform === 'android') {
        if (!canSendFCM || !fcmAccessToken) {
          failedCount++;
          results.push({ user_id: pt.user_id, platform: 'android', status: 'skipped', reason: 'Missing FCM credentials' });
          continue;
        }

        const payload = {
          message: {
            token: pt.token,
            notification: { title: title.trim(), body: message.trim() },
            data: {
              type: "manual",
              category: "general",
              campaign_id: campaignId || "",
              is_test: action === 'send_test' ? "true" : "false"
            }
          }
        };

        try {
          const response = await fetch(`https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${fcmAccessToken}`,
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
          if (isSuccess && providerResp?.error) {
             isSuccess = false;
          }

          try {
            await supabase.from('push_notification_log').insert({
              user_id: pt.user_id,
              notification_type: 'manual',
              title: title.trim(),
              body: message.trim(),
              platform: 'android',
              token_start: pt.token.substring(0, 25),
              success: isSuccess,
              provider_status: status.toString(),
              provider_response: providerResp,
              campaign_id: campaignId
            });
          } catch(e) {}

          if (isSuccess) {
            androidSent++;
            results.push({ user_id: pt.user_id, platform: 'android', token_start: pt.token.substring(0, 25), status: 'sent' });
          } else {
            failedCount++;
            results.push({ user_id: pt.user_id, platform: 'android', token_start: pt.token.substring(0, 25), status: 'failed', provider_status: status });
          }
        } catch (err: any) {
          failedCount++;
          results.push({ user_id: pt.user_id, platform: 'android', token_start: pt.token.substring(0, 25), status: 'error', error: err.message });
          try {
            await supabase.from('push_notification_log').insert({
              user_id: pt.user_id,
              notification_type: 'manual',
              title: title.trim(),
              body: message.trim(),
              platform: 'android',
              token_start: pt.token.substring(0, 25),
              success: false,
              provider_status: 'error',
              provider_response: { error: err.message },
              campaign_id: campaignId
            });
          } catch(e) {}
        }
      }
    }

    const successCount = iosSent + androidSent;
    let finalStatus = 'sent';
    if (successCount === 0 && failedCount > 0) finalStatus = 'failed';
    else if (failedCount > 0) finalStatus = 'partially_failed';
    else if (successCount === 0 && failedCount === 0) finalStatus = 'failed'; // No tokens

    if (campaignId) {
      try {
        await supabase.from('push_campaigns').update({
          status: finalStatus,
          attempted_count: finalTokens.length,
          success_count: successCount,
          failure_count: failedCount,
          sent_at: new Date().toISOString()
        }).eq('id', campaignId);
      } catch (e) {
        console.error("Failed to update campaign", e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      status: finalStatus,
      attempted: finalTokens.length,
      successCount,
      failedCount,
      iosSent,
      androidSent,
      campaignId
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
