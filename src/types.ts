export type UserType = 'admin' | 'player' | 'fan';

export interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string;
  user_type: UserType;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface League {
  id: string;
  name: string;
  region?: string;
  level?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Club {
  id: string;
  league_id: string;
  name: string;
  short_name?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
  leagues?: { name: string };
}

export interface Team {
  id: string;
  club_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  clubs?: { name: string };
}

export interface PlayerStats {
  id?: string;
  player_id: string;
  overall: number;
  tem: number;
  sch: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  updated_at: string;
}

export interface Player {
  id: string;
  team_id: string;
  full_name: string;
  position?: string;
  shirt_number?: number;
  photo_url?: string;
  birth_year?: number;
  is_active: boolean;
  claimed_by_user_id?: string;
  nationality?: string;
  card_layout?: any;
  created_at: string;
  updated_at: string;
  teams?: { name: string, club_id: string, clubs?: Club };
  player_stats?: PlayerStats[];
  current_stats?: PlayerStats;
}

export interface Fixture {
  id: string;
  league_id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string;
  status: 'upcoming' | 'live' | 'finished' | 'cancelled';
  venue_name?: string;
  home_score?: number;
  away_score?: number;
  checkin_code?: string;
  checkin_opens_at?: string;
  checkin_closes_at?: string;
  created_at: string;
  updated_at: string;
  home_team?: { name: string };
  away_team?: { name: string };
  leagues?: { name: string };
}

export interface FixtureLineup {
  fixture_id: string;
  player_id: string;
  team_id: string;
  shirt_number?: number | null;
  lineup_role?: 'starter' | 'sub';
  created_at: string;
}

export interface MatchCheckin {
  id: string;
  fixture_id: string;
  user_id: string;
  checked_in_at: string;
}

export interface PlayerVote {
  id: string;
  fixture_id: string;
  player_id: string;
  user_id: string;
  vote: 'up' | 'down';
  created_at: string;
}

export interface PlayerRatingHistory {
  id: string;
  fixture_id: string;
  player_id: string;
  old_overall: number;
  new_overall: number;
  delta_overall: number;
  up_votes: number;
  down_votes: number;
  processed_at: string;
}
