// Supabase Edge Function: match-processor
// Pure proxy to backend processor.
// Supports:
// 1. Manual processing from app with { fixtureId }
// 2. Cron automation for expired voting fixtures

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function readBackendJson(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: "Backend returned non-JSON response",
      status: response.status,
      responseText: text.slice(0, 1000),
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const APP_URL = Deno.env.get("APP_URL");
  const CRON_SECRET = Deno.env.get("CRON_SECRET");

  console.log("[MATCH_PROCESSOR] Started", new Date().toISOString());
  console.log("[MATCH_PROCESSOR] ENV CHECK", {
    hasAppUrl: !!APP_URL,
    hasCronSecret: !!CRON_SECRET,
  });

  if (!APP_URL || !CRON_SECRET) {
    return jsonResponse(
      {
        success: false,
        error: "Missing configuration",
        hasAppUrl: !!APP_URL,
        hasCronSecret: !!CRON_SECRET,
      },
      500
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const manualFixtureId = body?.fixtureId;
  const baseUrl = APP_URL.endsWith("/") ? APP_URL.slice(0, -1) : APP_URL;

  try {
    if (manualFixtureId) {
      const userAuthHeader = req.headers.get("Authorization") ?? "";

      if (!userAuthHeader) {
        return jsonResponse(
          {
            success: false,
            error: "Missing Authorization header for manual processing",
            fixtureId: manualFixtureId,
          },
          401
        );
      }

      const apiUrl = `${baseUrl}/api/admin/process-fixture-results`;

      console.log("[MATCH_PROCESSOR] Calling MANUAL backend processor", {
        fixtureId: manualFixtureId,
        apiUrl,
      });

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: userAuthHeader,
        },
        body: JSON.stringify({ fixtureId: manualFixtureId }),
      });

      const backendResult = await readBackendJson(response);

      console.log("[MATCH_PROCESSOR] Manual backend response", {
        fixtureId: manualFixtureId,
        status: response.status,
        ok: response.ok,
        backendResult,
      });

      return jsonResponse(
        {
          success: response.ok && backendResult?.success !== false,
          mode: "manual",
          fixtureId: manualFixtureId,
          backendResult,
          error:
            backendResult?.success === false
              ? backendResult?.error
              : undefined,
        },
        response.ok && backendResult?.success !== false ? 200 : 500
      );
    }

    // Cron mode: backend decides which fixtures are eligible and updates DB.
    const apiUrl = `${baseUrl}/api/automation/run-processor`;

    console.log("[MATCH_PROCESSOR] Calling CRON backend processor", { apiUrl });

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({}),
    });

    const backendResult = await readBackendJson(response);

    console.log("[MATCH_PROCESSOR] Cron backend response", {
      status: response.status,
      ok: response.ok,
      backendResult,
    });

    return jsonResponse(
      {
        success: response.ok && backendResult?.success !== false,
        mode: "cron",
        backendResult,
        error:
          backendResult?.success === false ? backendResult?.error : undefined,
      },
      response.ok && backendResult?.success !== false ? 200 : 500
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("[MATCH_PROCESSOR] Fatal error", message);

    return jsonResponse(
      {
        success: false,
        error: message,
      },
      500
    );
  }
});
