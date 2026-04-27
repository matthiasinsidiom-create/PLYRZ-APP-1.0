import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { PlayerStats, PlayerRatingHistory } from '../types';
import { mapPlayerWithStats, resolveLatestStats } from '../lib/stats';

/**
 * Maps a position string to a position group for logic processing.
 */
function getPositionGroup(pos: string): 'Torwart' | 'Abwehr' | 'Mittelfeld' | 'Sturm' {
  const p = (pos || '').toUpperCase();
  if (p.includes('GK') || p.includes('TW') || p.includes('TOR')) return 'Torwart';
  if (p.includes('DEF') || p.includes('ABWEHR') || p.includes('LB') || p.includes('RB') || p.includes('CB')) return 'Abwehr';
  if (p.includes('MID') || p.includes('MITTEL') || p.includes('CM') || p.includes('DM') || p.includes('OM')) return 'Mittelfeld';
  if (p.includes('ST') || p.includes('STURM') || p.includes('FW') || p.includes('FLÜGEL')) return 'Sturm';
  return 'Mittelfeld'; // Fallback
}

/**
 * Core processing logic for fixture ratings (v3.0).
 * This function calculates position-dependent rating changes, MVP awards, and clean sheet bonuses.
 */
export async function processFixtureRatings(_passedSupabase: SupabaseClient, fixtureId: string) {
  const supabase = supabaseAdmin;
  const now = new Date().toISOString();
  
  console.log(`DEBUG: [PROCESSOR] Starting Rating 3.0 processing for fixture: ${fixtureId}`);

  if (!fixtureId) throw new Error('No fixtureId provided to processFixtureRatings');

  // 1. Load Fixture
  const { data: fixture, error: fixtureError } = await supabase
    .from('fixtures')
    .select('*')
    .eq('id', fixtureId)
    .single();
  
  if (fixtureError) throw new Error(`Fixture load failed: ${fixtureError.message}`);
  
  // NOTE: We allow re-processing now to enable admins to fix mistakes.
  if (fixture.results_processed_at) {
    console.log(`DEBUG: [PROCESSOR] Fixture ${fixtureId} already processed. Re-processing...`);
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
  const { data: votes, error: votesError } = await supabase
    .from('player_votes')
    .select('*')
    .eq('fixture_id', fixtureId);
  
  if (votesError) throw new Error(`Votes fetch failed: ${votesError.message}`);

  const votesByPlayer: Record<string, any[]> = {};
  votes?.forEach(v => {
    const pid = typeof v.player_id === 'object' ? v.player_id.id : v.player_id;
    if (!votesByPlayer[pid]) votesByPlayer[pid] = [];
    votesByPlayer[pid].push(v);
  });

  // 5. Load Match Events
  const { data: matchEventsData } = await supabase
    .from('match_events')
    .select('*')
    .eq('fixture_id', fixtureId);
  const matchEvents = matchEventsData || [];

  // Team Details
  const homeTeamId = fixture.home_team_id;
  const awayTeamId = fixture.away_team_id;
  const homeScore = fixture.home_score || 0;
  const awayScore = fixture.away_score || 0;

  const getPlayerRating = (playerId: string) => {
    const playerStats = statsByPlayer[playerId] || [];
    const latest = resolveLatestStats({ id: playerId, player_stats: playerStats });
    return latest.overall || 50;
  };

  const homePlayers = lineupData.filter(e => e.team_id === homeTeamId);
  const awayPlayers = lineupData.filter(e => e.team_id === awayTeamId);

  const homeAvg = homePlayers.length > 0 ? homePlayers.reduce((acc, e) => acc + getPlayerRating(e.player_id), 0) / homePlayers.length : 50;
  const awayAvg = awayPlayers.length > 0 ? awayPlayers.reduce((acc, e) => acc + getPlayerRating(e.player_id), 0) / awayPlayers.length : 50;

  let homeActualScore = 0.5;
  let awayActualScore = 0.5;
  if (homeScore > awayScore) { homeActualScore = 1; awayActualScore = 0; }
  else if (awayScore > homeScore) { homeActualScore = 0; awayActualScore = 1; }

  // 6. Calculate Intermediate Ratings
  const playerCalcs: any[] = [];

  for (const entry of lineupData) {
    const playerId = entry.player_id;
    if (!playerId) continue;

    const oldOverall = getPlayerRating(playerId);
    const isHome = entry.team_id === homeTeamId;
    const teamAvg = isHome ? homeAvg : awayAvg;
    const oppAvg = isHome ? awayAvg : homeAvg;
    const actualScore = isHome ? homeActualScore : awayActualScore;
    const teamGoalsAgainst = isHome ? awayScore : homeScore;
    const isCleanSheet = teamGoalsAgainst === 0;

    const rawPos = entry.players?.position;
    const posGroup = getPositionGroup(rawPos);

    // Participation
    const participationMultiplier = entry.lineup_role === 'starter' ? 1.0 : 0.75;

    // Votes
    const playerVotes = votesByPlayer[playerId] || [];
    const upVotes = playerVotes.filter(v => (v.vote_type || v.vote) === 'up').length;
    const downVotes = playerVotes.filter(v => (v.vote_type || v.vote) === 'down').length;
    const neutralVotes = playerVotes.filter(v => (v.vote_type || v.vote) === 'neutral').length;
    const voteScore = upVotes - downVotes;
    const voteImpact = voteScore * 0.25;

    // Clean Sheet Impact
    let cleanSheetImpact = 0;
    if (isCleanSheet) {
      if (posGroup === 'Torwart') cleanSheetImpact = 1.0;
      else if (posGroup === 'Abwehr') cleanSheetImpact = 0.5;
      else if (posGroup === 'Mittelfeld') cleanSheetImpact = 0.15;
      // Sturm stays at 0
    }

    // Events Impact
    const playerEvents = matchEvents.filter(e => e.player_id === playerId);
    const goalCount = playerEvents.filter(e => e.event_type === 'goal').length;
    const assistCount = playerEvents.filter(e => e.event_type === 'assist').length;
    const yellowCount = playerEvents.filter(e => e.event_type === 'yellow_card').length;
    const redCount = playerEvents.filter(e => e.event_type === 'red_card').length;

    // RULE 3.0 Update: All outfield players get +1.0 per goal. 
    // Goalkeeper gets +0.0 (or +1.0 if they actually score as an exception).
    const goalImpactPerGoal = posGroup === 'Torwart' ? 1.0 : 1.0; 
    const goalImpact = goalCount * goalImpactPerGoal;
    
    // Assist bonus remains position-logic dependent
    let assistBonus = 0.4;
    if (posGroup === 'Torwart') assistBonus = 0.8;
    else if (posGroup === 'Abwehr') assistBonus = 0.6;
    else if (posGroup === 'Mittelfeld') assistBonus = 0.5;

    const oppGoalPenalty = teamGoalsAgainst * (posGroup === 'Torwart' || posGroup === 'Abwehr' ? -0.2 : -0.05);
    const eventImpact = goalImpact + (assistCount * assistBonus) + (yellowCount * -0.25) + (redCount * -1.5) + cleanSheetImpact + oppGoalPenalty;

    // Result Impact logic: Fixed values per user request
    let resultImpact = 0;
    if (actualScore === 1) resultImpact = 0.2;       // Win
    else if (actualScore === 0) resultImpact = -0.2;  // Loss
    else resultImpact = 0;                            // Draw

    const expectedScore = 1 / (1 + Math.pow(10, (oppAvg - teamAvg) / 12));

    // Raw Delta
    const rawDelta = (voteImpact + resultImpact + eventImpact) * participationMultiplier;
    const finalDeltaBase = Math.max(-2, Math.min(2, rawDelta));

    // MVP Score (Break ties for MVP)
    const mvpScore = (voteScore * 10) + (upVotes * 2) + (rawDelta * 5);
    playerCalcs.push({
      playerId, oldOverall, posGroup, rawPos, isHome, participationMultiplier,
      upVotes, downVotes, neutralVotes, voteScore, voteImpact, 
      goalCount, goalImpact, assistCount, yellowCount, redCount, isCleanSheet, teamGoalsAgainst,
      eventImpact, resultImpact, expectedScore, actual_score: actualScore,
      rawDelta, finalDeltaBase, mvpScore, players: entry.players,
      isStarter: entry.lineup_role === 'starter'
    });
  }

  // 7. MVP Selection
  let mvpId: string | null = null;
  const potentialMVPs = playerCalcs.filter(p => p.voteScore > 0 && p.upVotes > p.downVotes && (p.finalDeltaBase >= 1.5 || p.rawDelta >= 1.8));
  
  if (potentialMVPs.length > 0) {
    potentialMVPs.sort((a, b) => {
      if (b.voteScore !== a.voteScore) return b.voteScore - a.voteScore;
      if (b.upVotes !== a.upVotes) return b.upVotes - a.upVotes;
      if (b.rawDelta !== a.rawDelta) return b.rawDelta - a.rawDelta;
      if (b.isStarter !== a.isStarter) return b.isStarter ? 1 : -1;
      return b.oldOverall - a.oldOverall;
    });
    mvpId = potentialMVPs[0].playerId;
  }

  const finalHistory: PlayerRatingHistory[] = [];
  const statsUpdates: any[] = [];

  // 8. Final Calculation & Attribute Updates
  for (const p of playerCalcs) {
    const isMvp = p.playerId === mvpId;
    const mvpBonus = isMvp ? 1.0 : 0;
    const finalDeltaRaw = p.finalDeltaBase + mvpBonus;
    const finalDelta = Math.max(-2, Math.min(3, finalDeltaRaw));
    const newOverall = Math.round(Math.max(30, Math.min(95, p.oldOverall + finalDelta)));

    const oldStats = resolveLatestStats({ id: p.playerId, player_stats: statsByPlayer[p.playerId] || [] });
    const newStats = { ...oldStats };

    if (Math.abs(finalDelta) >= 0.2) {
      const change = finalDelta > 0 ? (finalDelta >= 2.0 ? 2 : 1) : (finalDelta <= -1.0 ? -2 : -1);
      
      const weights: Record<string, (keyof PlayerStats)[]> = {
        'Torwart': p.isCleanSheet ? ['def', 'phy', 'pas'] : (p.teamGoalsAgainst > 0 ? ['phy', 'def', 'pas'] : ['phy', 'def']),
        'Abwehr': p.isCleanSheet ? ['def', 'phy', 'tem'] : ['def', 'phy', 'pas'],
        'Mittelfeld': p.goalCount > 0 ? ['sch', 'pas', 'dri', 'phy'] : ['pas', 'dri', 'phy', 'tem'],
        'Sturm': p.goalCount > 0 ? ['sch', 'dri', 'tem'] : ['dri', 'tem', 'sch', 'pas']
      };

      const attrs = weights[p.posGroup] || weights['Mittelfeld'];
      const numToChange = isMvp ? 4 : (Math.abs(finalDelta) >= 1.5 ? 3 : 1);

      for (let i = 0; i < Math.min(numToChange, attrs.length); i++) {
        const key = attrs[i];
        (newStats as any)[key] = Math.max(30, Math.min(95, ((newStats as any)[key] || 50) + (change > 0 ? 1 : -1)));
        // MVP gets extra boost? Actually, we'll just handle it by numToChange
      }
    }

    statsUpdates.push({
      player_id: p.playerId, overall: newOverall,
      tem: newStats.tem, sch: newStats.sch, pas: newStats.pas,
      dri: newStats.dri, def: newStats.def, phy: newStats.phy,
      updated_at: now
    });

    finalHistory.push({
      id: '', // Will be assigned by DB
      fixture_id: fixtureId, player_id: p.playerId,
      old_overall: Math.round(p.oldOverall), new_overall: newOverall, delta_overall: finalDelta,
      votes_up: p.upVotes, votes_down: p.downVotes,
      positive_votes: p.upVotes, negative_votes: p.downVotes,
      vote_score: p.voteScore, vote_impact: p.voteImpact,
      result_impact: p.resultImpact, event_impact: p.eventImpact,
      goal_count: p.goalCount, yellow_count: p.yellowCount, red_count: p.redCount,
      participation_multiplier: p.participationMultiplier,
      expected_score: p.expectedScore, actual_score: p.actual_score,
      raw_delta: p.rawDelta, final_delta: finalDelta,
      is_mvp: isMvp, mvp_score: p.mvpScore, mvp_bonus: mvpBonus,
      rating_version: '3.0-positional', processed_at: now, created_at: now
    });

    // Detailed Debug Log
    console.log(`DEBUG: [RATING-3.0] Player: ${p.players?.full_name} (${p.playerId})
      Pos: ${p.rawPos} -> positionGroup: ${p.posGroup} | Team: ${p.isHome ? 'Home' : 'Away'} | Starter: ${p.isStarter}
      Votes: +${p.upVotes} / -${p.downVotes} / Neutral: ${p.neutralVotes} (Score: ${p.voteScore})
      goals: ${p.goalCount} | goalImpact: ${p.goalImpact.toFixed(2)} | assists: ${p.assistCount} | Cards: Y:${p.yellowCount} R:${p.redCount}
      Team Against: ${p.teamGoalsAgainst} | Clean Sheet: ${p.isCleanSheet}
      eventImpact total: ${p.eventImpact.toFixed(2)} | resultImpact: ${p.resultImpact.toFixed(2)} | voteImpact: ${p.voteImpact.toFixed(2)}
      rawDelta: ${p.rawDelta.toFixed(4)} | finalDelta: ${finalDelta.toFixed(4)} | MVP: ${isMvp} (Bonus: ${mvpBonus})
      Overall: ${p.oldOverall} -> ${newOverall}
      Stats Change: TEM:${oldStats.tem}->${newStats.tem}, SCH:${oldStats.sch}->${newStats.sch}, PAS:${oldStats.pas}->${newStats.pas}, DRI:${oldStats.dri}->${newStats.dri}, DEF:${oldStats.def}->${newStats.def}, PHY:${oldStats.phy}->${newStats.phy}`);
  }


  // 9. Database Writes
  try {
    const { error: delError } = await supabase.from('player_rating_history').delete().eq('fixture_id', fixtureId);
    if (delError) throw delError;
    
    // Remove 'id' from history objects to let DB auto-generate
    const historyToInsert = finalHistory.map(({ id, ...rest }) => ({
      ...rest,
      delta_overall: Number(Math.max(-2, Math.min(2, rest.delta_overall)).toFixed(4)),
      vote_impact: Number(rest.vote_impact.toFixed(4)),
      result_impact: Number(rest.result_impact.toFixed(4)),
      event_impact: Number(rest.event_impact.toFixed(4)),
      raw_delta: Number(rest.raw_delta.toFixed(4)),
      final_delta: Number(rest.final_delta.toFixed(4)),
      mvp_score: Number(rest.mvp_score.toFixed(4)),
      mvp_bonus: Number(rest.mvp_bonus.toFixed(4))
    }));
    
    const { error: insError } = await supabase.from('player_rating_history').insert(historyToInsert);
    if (insError) throw insError;
    
    if (statsUpdates.length > 0) {
      const { error: statsError } = await supabase.from('player_stats').upsert(statsUpdates, { onConflict: 'player_id' });
      if (statsError) throw statsError;
    }

    const { error: fixError } = await supabase.from('fixtures').update({ 
      results_processed_at: now, status: 'finished', updated_at: now 
    }).eq('id', fixtureId);
    if (fixError) throw fixError;

    console.log(`DEBUG: [PROCESSOR] Rating 3.0 processing COMPLETED for fixture: ${fixtureId}. MVP: ${mvpId}`);
    return finalHistory;
  } catch (err) {
    console.error(`DEBUG: [PROCESSOR] CRITICAL FAILURE in Rating 3.0:`, err);
    throw err;
  }
}
