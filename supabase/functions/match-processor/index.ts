
import { serve } from "https://deno.land/std@0.131.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      // Body might be empty for cron
    }
    
    const { fixtureId, type, appUrl } = body;
    const isCron = type === 'cron' || !fixtureId;

    const authHeader = req.headers.get('Authorization');

    const baseUrl = appUrl 
      ? appUrl
      :  'https://ais-dev-fjrcrkmhkbuzcz4zrklcla-612426073473.europe-west2.run.app';

    const backendUrl = isCron
      ? `${baseUrl}/api/automation/run-processor`
      : `${baseUrl}/api/admin/process-fixture-results`;

    console.log(`Proxying request to ${backendUrl} for fixtureId: ${fixtureId || 'cron'}`);

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) requestHeaders['Authorization'] = authHeader;

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(isCron ? {} : { fixtureId })
    });

    let data: any;
    const responseText = await response.text();
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`Backend returned non-JSON response: ${responseText.substring(0, 200)}...`);
      return new Response(JSON.stringify({
        success: false,
        error: "Backend returned invalid response format",
        details: responseText.substring(0, 100)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log(`Backend response: ${response.status}`, data);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: response.status,
    });
  } catch (error: any) {
    console.error(`Edge function proxy error: ${error.message}`);
    return new Response(JSON.stringify({
      success: false,
      error: `Proxy Error: ${error.message}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
