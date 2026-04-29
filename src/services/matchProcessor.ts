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
  try {
    const supabase = supabaseAdmin;
    const now = new Date().toISOString();
    
    console.log(`DEBUG: [PROCESSOR] SUPABASE_URL used: ${process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL}`);
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
    console.log(`DEBUG: [PROCESSOR] Loading lineup for fixture ${fixtureId}`);
    const { data: lineupData, error: lineupError } = await supabase
      .from('fixture_lineups')
      .select('*, players(*)')
      .eq('fixture_id', fixtureId);
    
    if (lineupError) {
      console.error(`DEBUG: [PROCESSOR] Lineup fetch failed:`, lineupError);
      throw new Error(`Lineup fetch failed: ${lineupError.message}`);
    }
    
    if (!lineupData || lineupData.length === 0) {
      console.warn(`DEBUG: [PROCESSOR] No players found in lineup for fixture ${fixtureId}`);
      throw new Error('No players in lineup for this fixture.');
    }
    console.log(`DEBUG: [PROCESSOR] Found ${lineupData.length} lineup entries`);

    // 3. Load Player Stats
    const playerIds = lineupData.map(e => e.player_id).filter(Boolean);
    console.log(`DEBUG: [PROCESSOR] Fetching stats for ${playerIds.length} players`);
    const { data: statsData, error: statsError } = await supabase
      .from('player_stats')
      .select('*')
      .in('player_id', playerIds);
    
    if (statsError) {
      console.error(`DEBUG: [PROCESSOR] Stats fetch failed:`, statsError);
      throw new Error(`Stats fetch failed: ${statsError.message}`);
    }
    console.log(`DEBUG: [PROCESSOR] Found ${statsData?.length || 0} stats records`);

    const statsByPlayer: Record<string, PlayerStats[]> = {};
    statsData?.forEach(stat => {
      if (!statsByPlayer[stat.player_id]) statsByPlayer[stat.player_id] = [];
      statsByPlayer[stat.player_id].push(stat);
    });

    // 4. Load Votes
    console.log("STEP: votes loaded");
    console.log(`DEBUG: [PROCESSOR] Fetching votes for fixture ${fixtureId}`);
    const { data: votes, error: votesError } = await supabase
      .from('player_votes')
      .select('*')
      .eq('fixture_id', fixtureId);
    
    if (votesError) {
      console.error(`DEBUG: [PROCESSOR] Votes fetch failed:`, votesError);
      throw new Error(`Votes fetch failed: ${votesError.message}`);
    }
    console.log(`DEBUG: [PROCESSOR] Found ${votes?.length || 0} votes`);


    const votesByPlayer: Record<string, any[]> = {};
    votes?.forEach(v => {
      const pid = typeof v.player_id === 'object' ? v.player_id.id : v.player_id;
      if (!votesByPlayer[pid]) votesByPlayer[pid] = [];
      votesByPlayer[pid].push(v);
    });

    // 5. Load Match Events
    console.log(`DEBUG: [PROCESSOR] Fetching match events for fixture ${fixtureId}`);
    const { data: matchEventsData, error: matchEventsError } = await supabase
      .from('match_events')
      .select('*')
      .eq('fixture_id', fixtureId);
    
    if (matchEventsError) {
      console.error(`DEBUG: [PROCESSOR] Match events fetch failed:`, matchEventsError);
      // Continue anyway as events are optional
    }
    const matchEvents = matchEventsData || [];
    console.log(`DEBUG: [PROCESSOR] Found ${matchEvents.length} match events`);

    // Team Details
    const homeTeamId = fixture.home_team_id;
    const awayTeamId = fixture.away_team_id;
    const homeScore = fixture.home_score || 0;
    const awayScore = fixture.away_score || 0;
    console.log(`DEBUG: [PROCESSOR] Home ID: ${homeTeamId}, Away ID: ${awayTeamId}, Score: ${homeScore}-${awayScore}`);

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

      // Participation (Not explicitly stated in new rules, prompt says 'no multipliers', so let's set to 1.0)
      const participationMultiplier = 1.0;

      // Votes
      const playerVotes = votesByPlayer[playerId] || [];
      const upVotes = playerVotes.filter(v => (v.vote_type || v.vote) === 'up').length;
      const downVotes = playerVotes.filter(v => (v.vote_type || v.vote) === 'down').length;
      const neutralVotes = playerVotes.filter(v => (v.vote_type || v.vote) === 'neutral').length;
      const voteScore = upVotes - downVotes;
      const voteImpact = voteScore * 0.15;

      // Clean Sheet Impact
      let cleanSheetImpact = 0;
      if (isCleanSheet) {
        if (posGroup === 'Torwart') cleanSheetImpact = 1.0;
        else cleanSheetImpact = 0.3;
      }

      // Events Impact
      const playerEvents = matchEvents.filter(e => e.player_id === playerId);
      const goalCount = playerEvents.filter(e => e.event_type === 'goal').length;
      const assistCount = playerEvents.filter(e => e.event_type === 'assist').length;
      const yellowCount = playerEvents.filter(e => e.event_type === 'yellow_card').length;
      const redCount = playerEvents.filter(e => e.event_type === 'red_card').length;

      // Goals & Assists
      const goalImpact = goalCount * 1.0; 
      const assistBonus = 0.5;

      // Opponent Goal Penalty
      const oppGoalPenalty = teamGoalsAgainst * -0.2;
      
      // Cards penalty
      const eventImpact = goalImpact + (assistCount * assistBonus) + (yellowCount * -0.2) + (redCount * -1.5) + cleanSheetImpact + oppGoalPenalty;

      // Result Impact logic: Fixed values
      let resultImpact = 0;
      if (actualScore === 1) resultImpact = 0.2;       // Win
      else if (actualScore === 0) resultImpact = -0.2;  // Loss
      else resultImpact = 0;                            // Draw

      const expectedScore = 1 / (1 + Math.pow(10, (oppAvg - teamAvg) / 12));

      // Raw Delta
      const rawDelta = voteImpact + resultImpact + eventImpact;
      const finalDeltaBase = Math.max(-2, Math.min(2, rawDelta));

      // MVP Score (used for ties)
      const voteRatio = (upVotes + downVotes) > 0 ? (upVotes / (upVotes + downVotes)) : 0;
      const mvpScore = voteScore * 100 + upVotes * 10 + voteRatio * 5 + rawDelta;

      playerCalcs.push({
        playerId, oldOverall, posGroup, rawPos, isHome, participationMultiplier,
        upVotes, downVotes, neutralVotes, voteScore, voteImpact, voteRatio,
        goalCount, goalImpact, assistCount, yellowCount, redCount, isCleanSheet, teamGoalsAgainst,
        eventImpact, resultImpact, expectedScore, actual_score: actualScore,
        rawDelta, finalDeltaBase, mvpScore, players: entry.players,
        isStarter: entry.lineup_role === 'starter'
      });
    }

    // 7. MVP Selection
    let mvpId: string | null = null;
    // MVP must have positive votes > negative votes (voteScore > 0)
    const potentialMVPs = playerCalcs.filter(p => p.voteScore > 0);
    
    if (potentialMVPs.length > 0) {
      potentialMVPs.sort((a, b) => {
        if (b.finalDeltaBase !== a.finalDeltaBase) return b.finalDeltaBase - a.finalDeltaBase;
        if (b.voteScore !== a.voteScore) return b.voteScore - a.voteScore;
        if (b.upVotes !== a.upVotes) return b.upVotes - a.upVotes;
        if (b.voteRatio !== a.voteRatio) return b.voteRatio - a.voteRatio;
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
        const change = finalDelta > 0 ? 1 : -1;
        
        const weights: Record<string, (keyof PlayerStats)[]> = {
          'Torwart': ['def', 'phy', 'pas', 'dri'],
          'Abwehr': ['def', 'phy', 'tem', 'pas'],
          'Mittelfeld': ['pas', 'dri', 'tem', 'phy'],
          'Sturm': ['sch', 'tem', 'dri', 'pas']
        };

        const attrs = weights[p.posGroup] || weights['Mittelfeld'];
        
        const absDelta = Math.abs(finalDelta);
        let numToChange = 1;
        if (isMvp) numToChange = 4;
        else if (absDelta >= 2.0) numToChange = 3;
        else if (absDelta >= 1.0) numToChange = 2;
        else numToChange = 1;

        for (let i = 0; i < Math.min(numToChange, attrs.length); i++) {
          const key = attrs[i];
          (newStats as any)[key] = Math.max(30, Math.min(95, ((newStats as any)[key] || 50) + change));
        }
      }

      statsUpdates.push({
        player_id: p.playerId, overall: newOverall,
        tem: newStats.tem, sch: newStats.sch, pas: newStats.pas,
        dri: newStats.dri, def: newStats.def, phy: newStats.phy,
        updated_at: now
      });

      finalHistory.push({
        id: '', // Will be removed
        fixture_id: fixtureId, player_id: p.playerId,
        old_overall: Math.round(p.oldOverall), new_overall: newOverall, delta_overall: finalDelta,
        votes_up: p.upVotes, votes_down: p.downVotes, votes_neutral: p.neutralVotes,
        positive_votes: p.upVotes, negative_votes: p.downVotes, neutral_votes: p.neutralVotes,
        vote_score: p.voteScore, vote_impact: p.voteImpact,
        result_impact: p.resultImpact, event_impact: p.eventImpact,
        goal_count: p.goalCount, yellow_count: p.yellowCount, red_count: p.redCount,
        participation_multiplier: p.participationMultiplier,
        expected_score: p.expectedScore, actual_score: p.actual_score,
        raw_delta: p.rawDelta, final_delta: finalDelta,
        is_mvp: isMvp, mvp_score: p.mvpScore, mvp_bonus: mvpBonus,
        rating_version: '3.0', processed_at: now, created_at: now
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
    
    console.log("STEP: rating calculated");

    // 9. Database Writes
    console.log(`DEBUG: [PROCESSOR] Preparing database writes for ${fixtureId}`);
    
    console.log(`DEBUG: [PROCESSOR] Deleting existing rating history for ${fixtureId}`);
    const { error: delError } = await supabase.from('player_rating_history').delete().eq('fixture_id', fixtureId);
    if (delError) {
      console.error(`DEBUG: [PROCESSOR] Rating history delete FAILED:`, delError);
      throw delError;
    }
    
    // Remove 'id' from history objects to let DB auto-generate
    const historyToInsert = finalHistory.map(({ id, votes_up, votes_down, votes_neutral, ...rest }) => ({
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
    
    console.log(`DEBUG: [PROCESSOR] Inserting ${historyToInsert.length} history records`);
    console.log("STEP: insert history start");
    let { error: insError } = await supabase.from('player_rating_history').insert(historyToInsert);
    
    if (insError && insError.message && insError.message.includes('neutral_votes')) {
      throw new Error(`Datenbank-Fehler: Die Spalte 'neutral_votes' fehlt in der Tabelle 'player_rating_history'. Bitte führe die SQL-Migration aus und lade den Schema Cache mit 'NOTIFY pgrst, "reload schema";' neu. Original error: ${insError.message}`);
    }

    if (insError) {
      console.error(`DEBUG: [PROCESSOR] Rating history insert FAILED:`, insError);
      throw new Error(`Rating history insert failed: ${insError.message}`);
    }
    console.log("STEP: insert history success");
    
    if (statsUpdates.length > 0) {
      console.log(`DEBUG: [PROCESSOR] Upserting ${statsUpdates.length} stats updates`);
      const { error: statsError } = await supabase.from('player_stats').upsert(statsUpdates, { onConflict: 'player_id' });
      if (statsError) {
        console.error(`DEBUG: [PROCESSOR] Stats upsert FAILED:`, statsError);
        throw new Error(`Stats upsert failed: ${statsError.message}`);
      }
    }

    console.log(`DEBUG: [PROCESSOR] Updating fixture ${fixtureId} status to finished and processed`);
    const { error: fixError } = await supabase.from('fixtures').update({ 
      results_processed_at: now, status: 'finished', updated_at: now 
    }).eq('id', fixtureId);
    if (fixError) {
      console.error(`DEBUG: [PROCESSOR] Fixture update FAILED:`, fixError);
      throw new Error(`Fixture update failed: ${fixError.message}`);
    }

    console.log(`DEBUG: [PROCESSOR] Rating 3.0 processing COMPLETED for fixture: ${fixtureId}. MVP: ${mvpId}`);

    return finalHistory;
  } catch (err: any) {
    console.error(`DEBUG: [PROCESSOR] CRITICAL FAILURE in Rating 3.0:`, err);
    throw new Error(err.message || 'Unknown processor error');
  }
}
