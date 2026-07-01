import { useAuth } from '../context/AuthContext';
import { Fixture, Player, League } from '../types';

export const useVisibility = () => {
  const { profile, isAdmin, clubAdminLeagueIds, clubAdminClubIds } = useAuth();

  const isMainAdmin = () => isAdmin;

  const getCurrentUserLeagueIds = (): string[] => {
    if (isAdmin) return []; // Admin sees all, logic handled separately
    
    const leagueIds = new Set<string>();
    
    // Add league from profile if standard user/player/fan
    if (profile?.selected_league_id) {
      leagueIds.add(profile.selected_league_id);
    }
    
    // Add leagues from club assignments if they are a club admin
    clubAdminLeagueIds.forEach(id => leagueIds.add(id));
    
    return Array.from(leagueIds);
  };

  const getUserClubIds = (): string[] => {
    if (isAdmin) return [];
    
    const clubIds = new Set<string>();
    if (profile?.favorite_club_id) clubIds.add(profile.favorite_club_id);
    clubAdminClubIds.forEach(id => clubIds.add(id));
    
    return Array.from(clubIds);
  };

  const canViewLeague = (leagueId?: string) => {
    if (!leagueId) return false;
    if (isMainAdmin()) return true;
    
    const myLeagues = getCurrentUserLeagueIds();
    return myLeagues.includes(leagueId);
  };

  const canViewFixture = (fixture: any) => {
    if (!fixture) return false;
    if (isMainAdmin()) return true;

    // Check by direct league_id
    if (fixture.league_id && canViewLeague(fixture.league_id)) {
      return true;
    }
    
    // Check by populated relations
    if (fixture.home_team?.clubs?.league_id && canViewLeague(fixture.home_team.clubs.league_id)) return true;
    if (fixture.away_team?.clubs?.league_id && canViewLeague(fixture.away_team.clubs.league_id)) return true;

    // Direct club admin check
    const myClubs = getUserClubIds();
    if (fixture.home_team?.club_id && myClubs.includes(fixture.home_team.club_id)) return true;
    if (fixture.away_team?.club_id && myClubs.includes(fixture.away_team.club_id)) return true;

    return false;
  };

  const canViewPlayer = (player: any) => {
    if (!player) return false;
    if (isMainAdmin()) return true;
    
    // Check by teams->clubs->league_id relation
    if (player.teams?.clubs?.league_id && canViewLeague(player.teams.clubs.league_id)) {
      return true;
    }

    // Direct club admin check
    const myClubs = getUserClubIds();
    if (player.teams?.club_id && myClubs.includes(player.teams.club_id)) return true;

    return false;
  };

  const canViewClub = (club: any) => {
    if (!club) return false;
    if (isMainAdmin()) return true;
    
    if (club.league_id && canViewLeague(club.league_id)) return true;
    
    const myClubs = getUserClubIds();
    if (myClubs.includes(club.id)) return true;

    return false;
  };

  return {
    getCurrentUserLeagueIds,
    getUserClubIds,
    isMainAdmin,
    canViewLeague,
    canViewFixture,
    canViewPlayer,
    canViewClub
  };
};
