import type { SupabaseClient } from '@supabase/supabase-js';

export interface RatingProcessResult {
  success: boolean;
  message?: string;
  processed?: number;
  results?: any[];
  error?: string;
  details?: any;
}

const DEFAULT_STATS = {
  overall: 50,
  tem: 50,
  sch: 50,
  pas: 50,
  dri: 50,
  def: 50,
  phy: 50
};

export function getPositionGroup(pos: string): 'Torwart' | 'Abwehr' | 'Mittelfeld' | 'Sturm' {
  const p = (pos || '').toUpperCase();
  if (p.includes('GK') || p.includes('TW') || p.includes('TOR')) return 'Torwart';
  if (p.includes('DEF') || p.includes('ABWEHR') || p.includes('LB') || p.includes('RB') || p.includes('CB')) return 'Abwehr';
  if (p.includes('MID') || p.includes('MITTEL') || p.includes('CM') || p.includes('DM') || p.includes('OM')) return 'Mittelfeld';
  if (p.includes('ST') || p.includes('STURM') || p.includes('FW') || p.includes('FLÜGEL')) return 'Sturm';
  return 'Mittelfeld';
}

export function resolveLatestStats(player: any): any {
  const statsArray = player.player_stats;
  
  if (!Array.isArray(statsArray) || statsArray.length === 0) {
    return {
      player_id: player.id || '',
      updated_at: new Date().toISOString(),
      ...DEFAULT_STATS
    };
  }

  const sorted = [...statsArray].sort((a, b) => {
    const dateA = new Date(a.updated_at || 0).getTime();
    const dateB = new Date(b.updated_at || 0).getTime();
    if (!isNaN(dateA) && !isNaN(dateB) && dateB !== dateA) return dateB - dateA;
    return 0;
  });

  const latest = sorted[0];
  return {
    ...latest,
    player_id: player.id || latest.player_id || '',
    updated_at: latest.updated_at || new Date().toISOString(),
    overall: latest.overall ?? DEFAULT_STATS.overall,
    tem: latest.tem ?? DEFAULT_STATS.tem,
    sch: latest.sch ?? DEFAULT_STATS.sch,
    pas: latest.pas ?? DEFAULT_STATS.pas,
    dri: latest.dri ?? DEFAULT_STATS.dri,
    def: latest.def ?? DEFAULT_STATS.def,
    phy: latest.phy ?? DEFAULT_STATS.phy
  };
}

export async function processFixtureRatingsEngine(supabase: SupabaseClient, fixtureId: string): Promise<any[]> {
  const now = new Date().toISOString();
  console.log(`[RATING ENGINE] Processing fixture: ${fixtureId}`);

  // 1. Load Fixture
  const { data: fixture, error: fixtureError } = await supabase
    .from('fixtures')
    .select('*')
    .eq('id', fixtureId)
    .single();
  
  if (fixtureError) throw new Error(`Fixture load failed: ${fixtureError.message}`);
  if (!fixture) throw new Error(`Fixture not found: ${fixtureId}`);

  // 2. Load Lineup
  const { data: lineupData, error: lineupError } = await supabase
    .from('fixture_lineups')
    .select('*, players(*)')
    .eq('fixture_id', fixtureId);
  
  if (lineupError) throw new Error(`Lineup fetch failed: ${lineupError.message}`);
  
  const homeLineups = lineupData?.filter((e: any) => e.team_id === fixture.home_team_id) || [];
  const awayLineups = lineupData?.filter((e: any) => e.team_id === fixture.away_team_id) || [];

  if (!lineupData || lineupData.length === 0 || homeLineups.length === 0 || awayLineups.length === 0) {
    console.log(`[RATING ENGINE] Incomplete lineups (Home: ${homeLineups.length}, Away: ${awayLineups.length}) for ${fixtureId}. Marking as processed.`);
    await supabase
      .from('fixtures')
      .update({ 
        results_processed_at: now,
        status: 'finished',
        updated_at: now
      })
      .eq('id', fixtureId);
    return [];
  }

  // 3. Load Player Stats
  const playerIds = lineupData.map((e: any) => e.player_id).filter(Boolean);
  const { data: statsData, error: statsError } = await supabase
    .from('player_stats')
    .select('*')
    .in('player_id', playerIds);
  
  if (statsError) throw new Error(`Stats fetch failed: ${statsError.message}`);

  const statsByPlayer: Record<string, any[]> = {};
  statsData?.forEach((stat: any) => {
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
  votes?.forEach((v: any) => {
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

  // Calculate global event counts
  const eventCounts: Record<string, number> = {};
  for (const e of matchEvents) {
    const type = e.event_type || 'unknown';
    eventCounts[type] = (eventCounts[type] || 0) + 1;
  }
  
  const opponentGoalCount = eventCounts['opponent_goal'] || 0;

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

  const homePlayers = lineupData.filter((e: any) => e.team_id === homeTeamId);
  const awayPlayers = lineupData.filter((e: any) => e.team_id === awayTeamId);

  const homeAvg = homePlayers.length > 0 ? homePlayers.reduce((acc: number, e: any) => acc + getPlayerRating(e.player_id), 0) / homePlayers.length : 50;
  const awayAvg = awayPlayers.length > 0 ? awayPlayers.reduce((acc: number, e: any) => acc + getPlayerRating(e.player_id), 0) / awayPlayers.length : 50;

  let homeActualScore = 0.5;
  let awayActualScore = 0.5;
  if (homeScore > awayScore) { homeActualScore = 1; awayActualScore = 0; }
  else if (awayScore > homeScore) { homeActualScore = 0; awayActualScore = 1; }

  // 6. Calculate Intermediate Ratings
  const playerCalcs: any[] = [];

  for (const entry of lineupData) {
    const playerId = entry.player_id;
    if (!playerId) continue;

    const wasStarter = entry.lineup_role === 'starter';
    const playerEventsForSubIn = matchEvents.filter((e: any) => (e.event_type === 'substitution' || e.event_type === 'sub_out') && e.related_player_id === playerId);
    const wasSubbedIn = playerEventsForSubIn.length > 0;
    const played = wasStarter || wasSubbedIn;

    const oldOverall = getPlayerRating(playerId);
    const isHome = entry.team_id === homeTeamId;
    const teamAvg = isHome ? homeAvg : awayAvg;
    const oppAvg = isHome ? awayAvg : homeAvg;
    const actualScore = isHome ? homeActualScore : awayActualScore;
    const teamGoalsAgainst = isHome ? awayScore : homeScore;
    
    const rawPos = entry.players?.position;
    const posGroup = getPositionGroup(rawPos);
    const participationMultiplier = 1.0;

    let upVotes = 0, downVotes = 0, neutralVotes = 0;
    let voteScore = 0, voteImpact = 0;
    let isCleanSheet = false, cleanSheetImpact = 0;
    let goalCount = 0, assistCount = 0, yellowCount = 0, redCount = 0;
    let oppGoalPenalty = 0, goalBonus = 0, assistBonus = 0, eventImpact = 0;

    if (played) {
      const playerVotes = votesByPlayer[playerId] || [];
      upVotes = playerVotes.filter((v: any) => (v.vote_type || v.vote) === 'up').length;
      downVotes = playerVotes.filter((v: any) => (v.vote_type || v.vote) === 'down').length;
      neutralVotes = playerVotes.filter((v: any) => (v.vote_type || v.vote) === 'neutral').length;
      
      voteScore = upVotes - downVotes;
      voteImpact = voteScore * 0.15;

      isCleanSheet = opponentGoalCount === 0;
      if (isCleanSheet) {
        if (posGroup === 'Torwart') cleanSheetImpact = 1.0;
        else cleanSheetImpact = 0.3;
      }

      const playerEvents = matchEvents.filter((e: any) => e.player_id === playerId);
      goalCount = playerEvents.filter((e: any) => e.event_type === 'goal').length;
      assistCount = matchEvents.filter((e: any) => e.event_type === 'goal' && e.assist_player_id === playerId).length;
      yellowCount = playerEvents.filter((e: any) => e.event_type === 'yellow_card').length;
      redCount = playerEvents.filter((e: any) => e.event_type === 'red_card').length;
      
      oppGoalPenalty = opponentGoalCount * -0.2;
      goalBonus = goalCount * 1.0;
      assistBonus = assistCount * 0.7;

      eventImpact = goalBonus + assistBonus + (yellowCount * -0.2) + (redCount * -1.5) + cleanSheetImpact + oppGoalPenalty;
    }

    let resultImpact = 0;
    if (actualScore === 1) resultImpact = 0.2;
    else if (actualScore === 0) resultImpact = -0.2;
    else resultImpact = 0;

    const expectedScore = 1 / (1 + Math.pow(10, (oppAvg - teamAvg) / 12));
    const rawDelta = voteImpact + resultImpact + eventImpact;
    const finalDeltaBase = Math.max(-2, Math.min(2, rawDelta));
    const voteRatio = (upVotes + downVotes) > 0 ? (upVotes / (upVotes + downVotes)) : 0;
    const mvpScore = played ? (goalCount * 1000 + assistCount * 500 + voteScore * 100 + rawDelta * 10) : -9999; 

    playerCalcs.push({
      playerId, oldOverall, posGroup, rawPos, isHome, participationMultiplier,
      upVotes, downVotes, neutralVotes, voteScore, voteImpact, voteRatio,
      goalCount, assistCount, yellowCount, redCount, isCleanSheet, teamGoalsAgainst,
      eventImpact, resultImpact, expectedScore, actual_score: actualScore,
      rawDelta, finalDeltaBase, mvpScore, players: entry.players,
      isStarter: wasStarter, played
    });
  }

  // 7. MVP Selection
  let mvpId: string | null = null;
  const potentialMVPs = playerCalcs.filter((p: any) => p.played && (p.voteScore > 0 || p.goalCount > 0 || p.assistCount > 0));
  
  if (potentialMVPs.length > 0) {
    potentialMVPs.sort((a: any, b: any) => {
      if (b.mvpScore !== a.mvpScore) return b.mvpScore - a.mvpScore;
      if (b.rawDelta !== a.rawDelta) return b.rawDelta - a.rawDelta;
      if (b.isStarter !== a.isStarter) return b.isStarter ? 1 : -1;
      return b.oldOverall - a.oldOverall;
    });
    mvpId = potentialMVPs[0].playerId;
  }

  const finalHistory: any[] = [];
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
      
      const weights: Record<string, string[]> = {
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
      player_id: p.playerId,
      overall: newOverall,
      tem: newStats.tem,
      sch: newStats.sch,
      pas: newStats.pas,
      dri: newStats.dri,
      def: newStats.def,
      phy: newStats.phy,
      updated_at: now
    });

    finalHistory.push({
      fixture_id: fixtureId, 
      player_id: p.playerId,
      old_overall: Math.round(p.oldOverall), 
      new_overall: newOverall, 
      delta_overall: Number(Math.max(-2, Math.min(3, finalDelta)).toFixed(4)),
      positive_votes: p.upVotes, 
      negative_votes: p.downVotes, 
      neutral_votes: p.neutralVotes,
      vote_score: p.voteScore, 
      vote_impact: Number((p.voteImpact || 0).toFixed(4)),
      result_impact: Number((p.resultImpact || 0).toFixed(4)), 
      event_impact: Number((p.eventImpact || 0).toFixed(4)),
      goal_count: p.goalCount, 
      assists: p.assistCount,
      yellow_count: p.yellowCount, 
      red_count: p.redCount,
      participation_multiplier: p.participationMultiplier,
      expected_score: p.expectedScore, 
      actual_score: Number((p.actual_score || 0).toFixed(4)),
      raw_delta: Number((p.rawDelta || 0).toFixed(4)), 
      final_delta: Number((finalDelta || 0).toFixed(4)),
      is_mvp: isMvp, 
      mvp_score: Number((p.mvpScore || 0).toFixed(4)), 
      mvp_bonus: Number((mvpBonus || 0).toFixed(4)),
      rating_version: '3.0', 
      processed_at: now, 
      created_at: now
    });
  }
  
  // 9. Database Writes
  const { error: delError } = await supabase.from('player_rating_history').delete().eq('fixture_id', fixtureId);
  if (delError) {
    console.warn(`[RATING ENGINE] Warning during history delete:`, delError.message);
  }
  
  const { error: insError } = await supabase.from('player_rating_history').insert(finalHistory);
  if (insError) throw new Error(`Rating history insert failed: ${insError.message}`);
  
  if (statsUpdates.length > 0) {
    const { error: statsError } = await supabase.from('player_stats').upsert(statsUpdates, { onConflict: 'player_id' });
    if (statsError) throw new Error(`Stats upsert failed: ${statsError.message}`);
  }

  const { error: fixError } = await supabase.from('fixtures').update({ 
    results_processed_at: now,
    status: 'finished',
    updated_at: now 
  }).eq('id', fixtureId);
  
  if (fixError) throw new Error(`Fixture update failed: ${fixError.message}`);

  console.log(`[RATING ENGINE] Completed fixture ${fixtureId} with ${finalHistory.length} ratings. MVP: ${mvpId}`);

  // Optional: trigger push
  try {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      fetch(`${SUPABASE_URL}/functions/v1/send-fixture-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          type: 'results_ready',
          fixtureId
        })
      }).catch(e => console.log('[RATING ENGINE] Push notification error (non-fatal):', e));
    }
  } catch (e) {
    // Non-fatal
  }

  return finalHistory;
}
