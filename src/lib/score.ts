import { Fixture, MatchEvent } from '../types';

/**
 * Robustly calculates the current match score from match events.
 * Uses the managed team context to correctly assign goal and opponent_goal events.
 */
export function calculateMatchScore(fixture: Fixture | null, events: MatchEvent[] = []) {
  if (!fixture) {
    return { homeScore: 0, awayScore: 0, scoreString: '0 : 0', isOwnTeamHome: true };
  }

  const matchEvents = events.filter(e => e.fixture_id === fixture.id);

  // 1. Determine which team is the "managed" team (eigenes/verwaltetes Team)
  let isOwnTeamHome = true; // default
  let foundManagedTeam = false;

  // Identify via event with player_id (only managed teams have players)
  const playerEvent = matchEvents.find(e => e.player_id != null);
  if (playerEvent) {
    isOwnTeamHome = playerEvent.team_id === fixture.home_team_id;
    foundManagedTeam = true;
  }
  
  // Fallback: Identify via a normal 'goal' event (admins log 'goal' for their team)
  if (!foundManagedTeam) {
    const goalEvent = matchEvents.find(e => e.event_type === 'goal');
    if (goalEvent) {
      isOwnTeamHome = goalEvent.team_id === fixture.home_team_id;
      foundManagedTeam = true;
    }
  }

  // Fallback: Check typical team names
  if (!foundManagedTeam) {
    const homeName = (fixture as any).home_team?.name?.toLowerCase() || '';
    const awayName = (fixture as any).away_team?.name?.toLowerCase() || '';
    if (awayName.includes('hofstetten') || awayName.includes('uhg') || awayName.includes('gerersdorf')) {
      isOwnTeamHome = false;
    } else {
      isOwnTeamHome = true;
    }
  }

  // 2. Count Goals directly and precisely by team
  const homeGoals = matchEvents.filter(e => 
    (e.event_type === 'goal' || e.event_type === 'opponent_goal') && 
    e.team_id === fixture.home_team_id
  ).length;

  const awayGoals = matchEvents.filter(e => 
    (e.event_type === 'goal' || e.event_type === 'opponent_goal') && 
    e.team_id === fixture.away_team_id
  ).length;

  let homeScore = homeGoals;
  let awayScore = awayGoals;

  // Fallback if no goal events but scores are set in fixture
  if (homeGoals === 0 && awayGoals === 0 && (fixture.home_score != null || fixture.away_score != null)) {
    homeScore = fixture.home_score ?? 0;
    awayScore = fixture.away_score ?? 0;
  }

  // Ensure 0 instead of null/undefined for live/finished matches
  if (fixture.status === 'live' || fixture.status === 'finished') {
    homeScore = homeScore ?? 0;
    awayScore = awayScore ?? 0;
  }

  const scoreString = `${homeScore} : ${awayScore}`;
  
  // Debug log explicitly
  console.log(`DEBUG: [SCORE] Fixture: ${fixture.id}, Status: ${fixture.status}, Events: ${matchEvents.length}, isOwnTeamHome: ${isOwnTeamHome}, homeGoals: ${homeGoals}, awayGoals: ${awayGoals}, Calculated: ${scoreString}`);

  return { homeScore, awayScore, scoreString, isOwnTeamHome };
}
