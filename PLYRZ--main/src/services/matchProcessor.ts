import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { PlayerStats } from '../types';
import { mapPlayerWithStats, resolveLatestStats } from '../lib/stats';
import { mapOldPosition } from '../lib/positions';

/**
 * Core processing logic for fixture ratings.
 * This function calculates rating changes based on user votes and updates the database.
 * 
 * CRITICAL: results_processed_at is updated ONLY after successful history insertion.
 */
export async function processFixtureRatings(_passedSupabase: SupabaseClient, fixtureId: string) {
  const supabase = supabaseAdmin;
  const now = new Date().toISOString();
  
  console.log(`DEBUG: [PROCESSOR] Starting rating processing for fixture: ${fixtureId}`);

  if (!fixtureId) throw new Error('No fixtureId provided to processFixtureRatings');

  // 1. Load Fixture
  const { data: fixture, error: fixtureError } = await supabase
    .from('fixtures')
    .select('*')
    .eq('id', fixtureId)
    .single();
  
  if (fixtureError) throw new Error(`Fixture load failed: ${fixtureError.message}`);
  if (fixture.results_processed_at) {
    console.log(`DEBUG: [PROCESSOR] Fixture ${fixtureId} already processed at ${fixture.results_processed_at}. Skipping.`);
    return [];
  }

  // 2. Load Lineup
  const { data: lineupData, error: lineupError } = await supabase
    .from('fixture_lineups')
    .select('*, players(*)')
    .eq('fixture_id', fixtureId);
  
  if (lineupError || !lineupData || lineupData.length === 0) {
    throw new Error('No players in lineup for this fixture.');
  }

  // 3. Load Player Stats
  const playerIds = lineupData.map(e => e.player_id).filter(Boolean);
  const { data: statsData, error: statsError } = await supabase
    .from('player_stats')
    .select('*')
    .in('player_id', playerIds);
  
  if (statsError) throw new Error(`Stats fetch failed: ${statsError.message}`);

  const statsByPlayer: Record<string, PlayerStats[]> = {};
  statsData?.forEach(stat => {
    if (!statsByPlayer[stat.player_id]) statsByPlayer[stat.player_id] = [];
    statsByPlayer[stat.player_id].push(stat);
  });

  // 4. Load Votes
  console.log(`DEBUG: [PROCESSOR] Fetching votes for fixture: ${fixtureId}`);
  
  // Total table audit (no filter)
  const { count: totalVotesInDB } = await supabase
    .from('player_votes')
    .select('*', { count: 'exact', head: true });
  console.log(`DEBUG: [PROCESSOR] Total rows in player_votes table (across ALL fixtures): ${totalVotesInDB || 0}`);

  const { data: votes, error: votesError } = await supabase
    .from('player_votes')
    .select('*')
    .eq('fixture_id', fixtureId);
  
  if (votesError) {
    console.error(`DEBUG: [PROCESSOR] ERROR: Votes fetch failed:`, votesError);
    throw new Error(`Votes fetch failed: ${votesError.message}`);
  }
  
  console.log(`DEBUG: [PROCESSOR] --- VOTE STORAGE AUDIT ---`);
  console.log(`DEBUG: [PROCESSOR] Fixture ID: ${fixtureId}`);
  console.log(`DEBUG: [PROCESSOR] Total Vote Rows Found for this fixture: ${votes?.length || 0}`);
  
  if (votes && votes.length > 0) {
    console.log(`DEBUG: [PROCESSOR] Sample Vote Row:`, JSON.stringify(votes[0]));
    // Log details of all votes for a more thorough audit (since it seems to be 0 for the user)
    votes.forEach((v, idx) => {
      console.log(`DEBUG: [PROCESSOR] Vote Row ${idx + 1}: Voter=${v.user_id}, Player=${v.player_id}, Value=${v.vote_type || v.vote}`);
    });
  } else {
    console.warn(`DEBUG: [PROCESSOR] WARNING: No vote rows found in player_votes for fixture ${fixtureId}`);
  }

  // Group votes by player for efficient aggregation
  const votesByPlayer: Record<string, any[]> = {};
  votes?.forEach(v => {
    // Robust mapping - handle potential string vs object player_id
    const pid = typeof v.player_id === 'object' ? v.player_id.id : v.player_id;
    if (!votesByPlayer[pid]) votesByPlayer[pid] = [];
    votesByPlayer[pid].push(v);
  });
  console.log(`DEBUG: [PROCESSOR] Players with votes:`, Object.keys(votesByPlayer).join(', '));

  // 5. Load Match Events
  const { data: matchEventsData } = await supabase
    .from('match_events')
    .select('*')
    .eq('fixture_id', fixtureId);
  const matchEvents = matchEventsData || [];

  // 6. Team Averages & Results
  const homeTeamId = fixture.home_team_id;
  const getPlayerRating = (playerId: string) => {
    const playerStats = statsByPlayer[playerId] || [];
    const latest = resolveLatestStats({ id: playerId, player_stats: playerStats });
    return latest.overall || 50;
  };

  const homePlayers = lineupData.filter(e => e.team_id === homeTeamId);
  const awayPlayers = lineupData.filter(e => e.team_id === fixture.away_team_id);

  const homeAvg = homePlayers.length > 0 ? homePlayers.reduce((acc, e) => acc + getPlayerRating(e.player_id), 0) / homePlayers.length : 50;
  const awayAvg = awayPlayers.length > 0 ? awayPlayers.reduce((acc, e) => acc + getPlayerRating(e.player_id), 0) / awayPlayers.length : 50;

  const homeScore = fixture.home_score || 0;
  const awayScore = fixture.away_score || 0;
  let homeActualScore = 0.5;
  let awayActualScore = 0.5;

  if (homeScore > awayScore) { homeActualScore = 1; awayActualScore = 0; }
  else if (awayScore > homeScore) { homeActualScore = 0; awayActualScore = 1; }

  // 7. Calculate Ratings
  const historyResults: any[] = [];
  const statsUpdates: any[] = [];

  for (const entry of lineupData) {
    const playerId = entry.player_id;
    if (!playerId) continue;

    const oldOverall = getPlayerRating(playerId);
    const isHome = entry.team_id === homeTeamId;
    const teamAvg = isHome ? homeAvg : awayAvg;
    const oppAvg = isHome ? awayAvg : homeAvg;
    const actualScore = isHome ? homeActualScore : awayActualScore;

    // Participation
    const participationMultiplier = entry.lineup_role === 'starter' ? 1.0 : (entry.lineup_role === 'substitute' ? 0.75 : 1.0);

    // Votes (using vote_type column as confirmed by database audit)
    // We use robust fallback to 'vote' if 'vote_type' is missing, but prioritize 'vote_type'
    const playerVotes = votesByPlayer[playerId] || [];
    const upVotes = playerVotes.filter(v => (v.vote_type || v.vote) === 'up').length;
    const downVotes = playerVotes.filter(v => (v.vote_type || v.vote) === 'down').length;
    
    console.log(`DEBUG: [PROCESSOR] --- AGGREGATION for Player ${playerId} (${entry.players?.name}) ---`);
    console.log(`DEBUG: [PROCESSOR] Found ${playerVotes.length} votes for this player.`);
    console.log(`DEBUG: [PROCESSOR] Up: ${upVotes}, Down: ${downVotes}`);

    // Vote Impact
    const voteImpact = (upVotes - downVotes) * 0.2;
    console.log(`DEBUG: [PROCESSOR] Calculated voteImpact: ${voteImpact}`);

    // Event Impact (goal, yellow_card, red_card only)
    const playerEvents = matchEvents.filter(e => e.player_id === playerId);
    const goalCount = playerEvents.filter(e => e.event_type === 'goal').length;
    const yellowCount = playerEvents.filter(e => e.event_type === 'yellow_card').length;
    const redCount = playerEvents.filter(e => e.event_type === 'red_card').length;

    const position = mapOldPosition(entry.players?.position);
    let goalBonus = 0.70;
    if (position === 'Torwart') goalBonus = 1.20;
    else if (position === 'Abwehr') goalBonus = 1.00;
    else if (position === 'Mittelfeld') goalBonus = 0.85;

    const eventImpact = (goalCount * goalBonus) + (yellowCount * -0.25) + (redCount * -1.00);

    // Result Impact
    const expectedScore = 1 / (1 + Math.pow(10, (oppAvg - teamAvg) / 12));
    const resultImpact = (actualScore - expectedScore) * 1.2;

    // Final Delta (Deterministic)
    const rawDelta = (voteImpact + resultImpact + eventImpact) * participationMultiplier;
    const delta = Math.max(-2, Math.min(2, rawDelta));
    
    console.log(`DEBUG: [VOTE-AGGREGATE] Player: ${playerId}, VotesUp: ${upVotes}, VotesDown: ${downVotes}, VoteImpact: ${voteImpact.toFixed(2)}, FinalDelta: ${delta.toFixed(2)}`);
    console.log(`DEBUG: [PROCESSOR] --- FINAL CALCULATION for Player ${playerId} (${entry.players?.name}) ---`);
    console.log(`DEBUG: [PROCESSOR] voteImpact: ${voteImpact.toFixed(4)}`);
    console.log(`DEBUG: [PROCESSOR] resultImpact: ${resultImpact.toFixed(4)}`);
    console.log(`DEBUG: [PROCESSOR] eventImpact: ${eventImpact.toFixed(4)}`);
    console.log(`DEBUG: [PROCESSOR] participationMultiplier: ${participationMultiplier}`);
    console.log(`DEBUG: [PROCESSOR] rawDelta (Combined): ${rawDelta.toFixed(4)}`);
    console.log(`DEBUG: [PROCESSOR] finalDelta (Capped): ${delta.toFixed(4)}`);
    console.log(`DEBUG: [PROCESSOR] oldOverall: ${oldOverall}`);
    console.log(`DEBUG: [PROCESSOR] newOverall (Unrounded): ${oldOverall + delta}`);
    console.log(`DEBUG: [PROCESSOR] newOverall (Final): ${Math.round(oldOverall + delta)}`);

    const newOverall = Math.round(Math.max(30, Math.min(95, oldOverall + delta)));
    const oldStats = resolveLatestStats({ id: playerId, player_stats: statsByPlayer[playerId] || [] });

    // Attribute Updates (Deterministic)
    const newStats = { ...oldStats };
    if (Math.abs(delta) >= 0.3) {
      const change = delta > 0 ? 1 : -1;
      const attributesByPosition: Record<string, (keyof PlayerStats)[]> = {
        'Torwart': ['phy', 'def', 'tem', 'pas'],
        'Abwehr': ['def', 'phy', 'tem', 'pas'],
        'Mittelfeld': ['pas', 'dri', 'def', 'phy'],
        'Sturm': ['sch', 'dri', 'tem', 'phy']
      };
      const attrs = attributesByPosition[position] || attributesByPosition['Sturm'];
      const maxChanges = Math.abs(delta) >= 1.0 ? 3 : 1;
      
      for (let i = 0; i < Math.min(maxChanges, attrs.length); i++) {
        const key = attrs[i];
        const oldVal = (newStats as any)[key] as number;
        (newStats as any)[key] = Math.max(30, Math.min(95, oldVal + change));
      }
    }

    statsUpdates.push({ 
      player_id: playerId, overall: newOverall,
      tem: newStats.tem, sch: newStats.sch, pas: newStats.pas,
      dri: newStats.dri, def: newStats.def, phy: newStats.phy,
      updated_at: now
    });

    historyResults.push({
      fixture_id: fixtureId, player_id: playerId,
      old_overall: Math.round(oldOverall), new_overall: newOverall, delta_overall: delta,
      votes_up: upVotes, votes_down: downVotes,
      expected_score: expectedScore, actual_score: actualScore,
      participation_multiplier: participationMultiplier,
      vote_impact: voteImpact, result_impact: resultImpact, event_impact: eventImpact,
      goal_count: goalCount, yellow_count: yellowCount, red_count: redCount,
      rating_version: '2.0-deterministic', processed_at: now, created_at: now
    });
  }

  // Database Writes
  try {
    await supabase.from('player_rating_history').delete().eq('fixture_id', fixtureId);
    await supabase.from('player_rating_history').insert(historyResults);
    if (statsUpdates.length > 0) {
      await supabase.from('player_stats').upsert(statsUpdates, { onConflict: 'player_id' });
    }
    await supabase.from('fixtures').update({ 
      results_processed_at: now, status: 'finished', updated_at: now 
    }).eq('id', fixtureId);

    return historyResults;
  } catch (err) {
    console.error(`DEBUG: [PROCESSOR] CRITICAL FAILURE:`, err);
    throw err;
  }
}
