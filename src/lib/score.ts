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

  // 2. Count Goals globally for the fixture
  const goalCount = matchEvents.filter(e => e.event_type === 'goal').length;
  const opponentGoalCount = matchEvents.filter(e => e.event_type === 'opponent_goal').length;

  let homeScore = 0;
  let awayScore = 0;

  // 3. Score Mapping:
  // Wenn eigenes/verwaltetes Team zuhause ist: goal = Heimteam, opponent_goal = Auswärtsteam
  // Wenn eigenes/verwaltetes Team auswärts ist: goal = Auswärtsteam, opponent_goal = Heimteam
  if (isOwnTeamHome) {
    homeScore = goalCount;
    awayScore = opponentGoalCount;
  } else {
    awayScore = goalCount;
    homeScore = opponentGoalCount;
  }

  // Fallback if no goal events but scores are set in fixture
  if (goalCount === 0 && opponentGoalCount === 0 && (fixture.home_score || fixture.away_score)) {
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
  console.log(`DEBUG: [SCORE] Fixture: ${fixture.id}, Status: ${fixture.status}, Events: ${matchEvents.length}, isOwnTeamHome: ${isOwnTeamHome}, goalCount: ${goalCount}, opponentGoalCount: ${opponentGoalCount}, Calculated: ${scoreString}`);

  return { homeScore, awayScore, scoreString, isOwnTeamHome };
}
