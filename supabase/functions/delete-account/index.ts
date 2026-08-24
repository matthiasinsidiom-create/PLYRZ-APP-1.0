import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get user from auth token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized or invalid token')
    }

    const userId = user.id

    // Initialize Supabase Admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`Starting account deletion for user: ${userId}`)

    // 1. Remove player claim
    const { error: playerError } = await supabaseAdmin
      .from('players')
      .update({ claimed_by_user_id: null })
      .eq('claimed_by_user_id', userId)

    if (playerError) {
      console.error('Error unclaiming player:', playerError)
    }

    // 2. Delete club admins
    const { error: adminError } = await supabaseAdmin
      .from('club_admins')
      .delete()
      .eq('user_id', userId)

    if (adminError) {
      console.error('Error deleting club admins:', adminError)
    }

    // 3. Delete push tokens
    const { error: tokenError } = await supabaseAdmin
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)

    if (tokenError) {
      console.error('Error deleting push tokens:', tokenError)
    }

    // 4. Delete push notification log
    const { error: pushLogError } = await supabaseAdmin
      .from('push_notification_log')
      .delete()
      .eq('user_id', userId)

    if (pushLogError) {
      console.error('Error deleting push log:', pushLogError)
    }

    // 5. Delete player votes (we can keep these if we want, but user requested personal data to be removed)
    // Wait, the prompt says: "Votes, Favoriten und andere personenbezogene Daten entweder löschen oder anonymisieren"
    // "historische sportliche Daten bestehen lassen"
    // If we delete a vote, does it break rating? The rating history is stored separately in `player_rating_history`, which does NOT have a user_id. So we can delete votes.
    const { error: voteError } = await supabaseAdmin
      .from('player_votes')
      .delete()
      .eq('user_id', userId)

    if (voteError) {
      console.error('Error deleting player votes:', voteError)
    }

    // 6. Delete match checkins
    const { error: checkinError } = await supabaseAdmin
      .from('match_checkins')
      .delete()
      .eq('user_id', userId)

    if (checkinError) {
      console.error('Error deleting match checkins:', checkinError)
    }

    // 7. Delete premium requests
    const { error: premiumError } = await supabaseAdmin
      .from('player_premium_requests')
      .delete()
      .eq('user_id', userId)

    if (premiumError) {
      console.error('Error deleting premium requests:', premiumError)
    }

    // 8. Delete profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error('Error deleting profile:', profileError)
      // Usually, deleting the auth user cascades to profiles, but doing it explicitly is safer.
    }

    // 9. Delete Auth User
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteUserError) {
      console.error('Error deleting auth user:', deleteUserError)
      throw deleteUserError
    }

    console.log(`Successfully deleted user: ${userId}`)

    return new Response(JSON.stringify({ success: true, message: 'Account successfully deleted' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('Delete account error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
