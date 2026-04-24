import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  // Handle OPTIONS requests immediately
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    // Add logs at the top
    console.log(`[match-processor] Method: ${req.method}`)
    console.log(`[match-processor] URL: ${req.url}`)
    console.log(`[match-processor] Body:`, JSON.stringify(body))

    const { fixtureId } = body

    if (!fixtureId) {
      throw new Error('fixtureId is required')
    }

    // Existing match processing logic (placeholder since original file was unavailable in workspace)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data, error } = await supabaseClient.rpc('process_fixture_results', { p_fixture_id: fixtureId })
    
    if (error) throw error

    // Ensure every response includes corsHeaders
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('[match-processor] Error:', error.message)
    // Ensure every response includes corsHeaders
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
