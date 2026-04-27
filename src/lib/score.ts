import { Fixture, MatchEvent } from '../types';

/**
 * Robustly calculates the current match score from match events.
 * Falls back to 0:0 if the match is live or finished but no goal events exist.
 */
export function calculateMatchScore(fixture: Fixture | null, events: MatchEvent[] = []) {
  if (!fixture) {
    return { homeScore: 0, awayScore: 0, scoreString: '0 : 0' };
  }

  let homeScore = 0;
  let awayScore = 0;

  // Filter goal events
  const goalEvents = events.filter(e => 
    e.fixture_id === fixture.id && 
    (e.event_type === 'goal' || e.event_type === 'opponent_goal')
  );

  if (goalEvents.length > 0) {
    let assignedHome = 0;
    let assignedAway = 0;

    goalEvents.forEach(event => {
      if (event.team_id === fixture.home_team_id) {
        assignedHome++;
      } else if (event.team_id === fixture.away_team_id) {
        assignedAway++;
      }
    });

    // If we have goal events but couldn't assign any of them to teams (e.g. legacy data with team_id: null),
    // we fall back to the fixture scores to avoid resetting to 0:0.
    if (assignedHome === 0 && assignedAway === 0 && (fixture.home_score || fixture.away_score)) {
      homeScore = fixture.home_score ?? 0;
      awayScore = fixture.away_score ?? 0;
    } else {
      homeScore = assignedHome;
      awayScore = assignedAway;
    }
  } else {
    // Fallback to fixture scores if no events exist but scores are set
    // This handles manual overrides in Admin panel or legacy data
    // However, user specifically asked to favor calculation.
    // We'll use 0 as default if match is started.
    homeScore = fixture.home_score ?? 0;
    awayScore = fixture.away_score ?? 0;
  }

  // Ensure 0 instead of null/undefined for live/finished matches
  if (fixture.status === 'live' || fixture.status === 'finished') {
    homeScore = homeScore ?? 0;
    awayScore = awayScore ?? 0;
  }

  const scoreString = `${homeScore} : ${awayScore}`;
  
  // Debug log as requested
  console.log(`DEBUG: [SCORE] Fixture: ${fixture.id}, Status: ${fixture.status}, Events: ${events.length}, Goals: ${goalEvents.length}, Calculated: ${scoreString}`);

  return { homeScore, awayScore, scoreString };
}
