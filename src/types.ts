export type UserType = 'admin' | 'player' | 'fan';
export type PlayerPosition = 'Torwart' | 'Abwehr' | 'Mittelfeld' | 'Sturm';

export interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string;
  role: 'admin' | 'player' | 'fan';
  is_admin?: boolean;
  onboarding_completed?: boolean;
  favorite_club_id?: string;
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
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  pitch_name?: string;
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
  clubs?: { name: string; logo_url?: string };
}

export interface PlayerStats {
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
  jersey_number?: number;
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
  round_number?: number;
  venue_name?: string;
  home_score?: number;
  away_score?: number;
  checkin_code?: string;
  checkin_opens_at?: string;
  checkin_closes_at?: string;
  voting_open_at?: string;
  voting_close_at?: string;
  results_processed_at?: string;
  match_type?: 'reserve' | 'kampfmannschaft';
  match_phase?: 'first_half' | 'halftime' | 'second_half' | 'full_time';
  first_half_started_at?: string;
  halftime_started_at?: string;
  second_half_started_at?: string;
  created_at: string;
  updated_at: string;
  home_team?: { name: string, clubs?: { name: string, logo_url?: string } };
  away_team?: { name: string, clubs?: { name: string, logo_url?: string } };
  leagues?: { name: string };
}

export interface FixtureLineup {
  fixture_id: string;
  player_id: string;
  team_id: string;
  jersey_number?: number | null;
  lineup_role?: 'starter' | 'sub';
  created_at: string;
  players?: Player;
}

export interface MatchCheckin {
  id: string;
  fixture_id: string;
  user_id: string;
  club_id?: string;
  user_latitude?: number;
  user_longitude?: number;
  venue_latitude?: number;
  venue_longitude?: number;
  radius_meters?: number;
  distance_meters?: number;
  is_within_radius: boolean;
  checked_in_at: string;
  expires_at: string;
}

export interface PlayerVote {
  id: string;
  fixture_id: string;
  player_id: string;
  user_id: string;
  vote: 'up' | 'down' | 'neutral';
  created_at: string;
}

export interface PlayerRatingHistory {
  id: string;
  fixture_id: string;
  player_id: string;
  old_overall: number;
  new_overall: number;
  delta_overall: number;
  positive_votes: number;
  negative_votes: number;
  neutral_votes: number;
  expected_score?: number;
  actual_score?: number;
  participation_multiplier: number;
  vote_impact: number;
  result_impact: number;
  event_impact: number;
  goal_count: number;
  assists?: number;
  yellow_count: number;
  red_count: number;
  rating_version?: string;
  processed_at: string;
  created_at?: string;
  is_mvp?: boolean;
  mvp_score?: number;
  vote_score?: number;
  raw_delta?: number;
  final_delta?: number;
  mvp_bonus?: number;
}

export interface MatchEvent {
  id: string;
  fixture_id: string;
  player_id: string | null;
  assist_player_id?: string | null;
  team_id?: string | null;
  event_type: 'starting_xi' | 'sub_in' | 'sub_out' | 'goal' | 'assist' | 'yellow_card' | 'red_card' | 'clean_sheet' | 'penalty_saved' | 'penalty_missed' | 'opponent_goal';
  minute?: number | null;
  extra_minute?: number | null;
  opponent_jersey_number?: string | null;
  related_player_id?: string | null;
  created_at: string;
}
