import { supabase } from '../lib/supabase';
import { League, Club, Team, Player, Fixture, Profile, FixtureLineup, PlayerStats, PlayerRatingHistory } from '../types';

export const supabaseService = {
  // Profiles
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data as Profile;
  },

  async updateProfile(userId: string, updates: Partial<Profile>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data as Profile;
  },

  // --- ADMIN CRUD ---

  // Helper to check admin status with email fallback
  async checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');
    
    // Use maybeSingle to avoid error if profile doesn't exist yet
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
      
    if (profileError) console.error('DEBUG: [SERVICE] Profile fetch error:', profileError);

    // Admin if profile says so OR if it's the default admin email
    const isAdmin = (profile?.is_admin ?? false) || (user.email === "matthias.insidiom@gmail.com");
    
    console.log(`DEBUG: [SERVICE] Admin Check - User: ${user.email}, Profile Admin: ${profile?.is_admin}, Final isAdmin: ${isAdmin}`);
    
    if (!isAdmin) {
      throw new Error(`Unauthorized: Admin access required. User: ${user.email}, Profile Admin: ${profile?.is_admin ?? 'None'}`);
    }
    
    return { user, profile };
  },

  // Leagues
  async createLeague(league: Partial<League>) {
    const { data, error } = await supabase
      .from('leagues')
      .insert({ 
        name: league.name,
        region: league.region,
        level: league.level,
        is_active: league.is_active ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data as League;
  },

  async updateLeague(id: string, updates: Partial<League>) {
    const { data, error } = await supabase
      .from('leagues')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as League;
  },

  async deleteLeague(id: string) {
    console.log(`DEBUG: [SERVICE] Attempting to delete league: ${id}`);
    await this.checkAdmin();

    // 1. Delete dependent fixtures first
    const { data: fixtures, error: fixturesFetchError } = await supabase.from('fixtures').select('id').eq('league_id', id);
    if (fixturesFetchError) console.error('DEBUG: [SERVICE] Error fetching fixtures for league:', fixturesFetchError);
    
    if (fixtures && fixtures.length > 0) {
      console.log(`DEBUG: [SERVICE] Found ${fixtures.length} fixtures for league ${id}, deleting them first...`);
      for (const fixture of fixtures) {
        try {
          await this.deleteFixture(fixture.id);
        } catch (e) {
          console.warn(`DEBUG: [SERVICE] Non-fatal error deleting fixture ${fixture.id} during league cascade:`, e);
        }
      }
    }

    // 2. Delete dependent clubs first
    const { data: clubs, error: clubsFetchError } = await supabase.from('clubs').select('id').eq('league_id', id);
    if (clubsFetchError) console.error('DEBUG: [SERVICE] Error fetching clubs for league:', clubsFetchError);

    if (clubs && clubs.length > 0) {
      console.log(`DEBUG: [SERVICE] Found ${clubs.length} clubs for league ${id}, deleting them first...`);
      for (const club of clubs) {
        try {
          await this.deleteClub(club.id);
        } catch (e) {
          console.warn(`DEBUG: [SERVICE] Non-fatal error deleting club ${club.id} during league cascade:`, e);
        }
      }
    }

    // 3. Delete the league
    console.log(`DEBUG: [SERVICE] Executing final delete for league: ${id}`);
    const response = await supabase.from('leagues').delete().eq('id', id).select();
    
    console.log('DEBUG: [SERVICE] deleteLeague response', {
      status: response.status,
      error: response.error,
      data: response.data,
      count: response.data?.length
    });

    if (response.error) {
      console.error(`DEBUG: [SERVICE] Error deleting league ${id}:`, response.error);
      throw response.error;
    }
    
    if (!response.data || response.data.length === 0) {
      console.warn(`DEBUG: [SERVICE] No rows deleted for league ${id}. It may not exist or RLS blocked it.`);
    } else {
      console.log(`DEBUG: [SERVICE] Successfully deleted league ${id}`);
    }
    return true;
  },

  // Clubs
  async createClub(club: Partial<Club>) {
    console.log('DEBUG: [SERVICE] createClub payload:', club);
    const { data, error } = await supabase
      .from('clubs')
      .insert({ 
        league_id: club.league_id,
        name: club.name,
        short_name: club.short_name,
        logo_url: club.logo_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('DEBUG: [SERVICE] createClub error:', error);
      throw error;
    }

    console.log('DEBUG: [SERVICE] createClub result:', data);
    const createdClub = data as Club;

    // Automatically create default teams: Kampfmannschaft and Reserve
    const { teams, errors } = await this.createDefaultTeamsForClub(createdClub.id);

    return {
      club: createdClub,
      teams,
      teamErrors: errors
    };
  },

  async createDefaultTeamsForClub(clubId: string) {
    const defaultTeams = ['Kampfmannschaft', 'Reserve'];
    const teamResults = [];
    let teamErrors = [];

    console.log(`DEBUG: [SERVICE] Creating default teams for club ${clubId}: ${defaultTeams.join(', ')}`);

    for (const teamName of defaultTeams) {
      try {
        // Check if team already exists (though unlikely for a new club)
        const { data: existingTeam } = await supabase
          .from('teams')
          .select('id')
          .eq('club_id', clubId)
          .eq('name', teamName)
          .maybeSingle();

        if (existingTeam) {
          console.log(`DEBUG: [SERVICE] Team "${teamName}" already exists for club ${clubId}, skipping.`);
          continue;
        }

        const teamPayload = {
          club_id: clubId,
          name: teamName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        console.log(`DEBUG: [SERVICE] Creating default team payload:`, teamPayload);

        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .insert(teamPayload)
          .select()
          .single();

        if (teamError) {
          console.error(`DEBUG: [SERVICE] Error creating default team "${teamName}":`, teamError);
          teamErrors.push({ name: teamName, error: teamError });
        } else {
          console.log(`DEBUG: [SERVICE] Successfully created default team "${teamName}":`, teamData);
          teamResults.push(teamData);
        }
      } catch (e) {
        console.error(`DEBUG: [SERVICE] Unexpected error creating default team "${teamName}":`, e);
        teamErrors.push({ name: teamName, error: e });
      }
    }

    return {
      teams: teamResults,
      errors: teamErrors.length > 0 ? teamErrors : null
    };
  },

  async updateClub(id: string, updates: Partial<Club>) {
    const { data, error } = await supabase
      .from('clubs')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Club;
  },

  async deleteClub(id: string) {
    console.log(`DEBUG: [SERVICE] Attempting to delete club: ${id}`);
    await this.checkAdmin();

    // 1. Delete dependent teams first
    const { data: teams, error: teamsFetchError } = await supabase.from('teams').select('id').eq('club_id', id);
    if (teamsFetchError) console.error('DEBUG: [SERVICE] Error fetching teams for club:', teamsFetchError);

    if (teams && teams.length > 0) {
      console.log(`DEBUG: [SERVICE] Found ${teams.length} teams for club ${id}, deleting them first...`);
      for (const team of teams) {
        try {
          await this.deleteTeam(team.id);
        } catch (e) {
          console.warn(`DEBUG: [SERVICE] Non-fatal error deleting team ${team.id} during club cascade:`, e);
        }
      }
    }

    // 2. Delete the club
    console.log(`DEBUG: [SERVICE] Executing final delete for club: ${id}`);
    const response = await supabase.from('clubs').delete().eq('id', id).select();

    console.log('DEBUG: [SERVICE] deleteClub response', {
      status: response.status,
      error: response.error,
      data: response.data,
      count: response.data?.length
    });

    if (response.error) {
      console.error(`DEBUG: [SERVICE] Error deleting club ${id}:`, response.error);
      throw response.error;
    }

    if (!response.data || response.data.length === 0) {
      console.warn(`DEBUG: [SERVICE] No rows deleted for club ${id}. It may not exist or RLS blocked it.`);
    } else {
      console.log(`DEBUG: [SERVICE] Successfully deleted club ${id}`);
    }
    return true;
  },

  // Teams
  async createTeam(team: Partial<Team>) {
    const { data, error } = await supabase
      .from('teams')
      .insert({ 
        club_id: team.club_id,
        name: team.name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data as Team;
  },

  async updateTeam(id: string, updates: Partial<Team>) {
    const { data, error } = await supabase
      .from('teams')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Team;
  },

  async deleteTeam(id: string) {
    console.log(`DEBUG: [SERVICE] Attempting to delete team: ${id}`);
    await this.checkAdmin();

    // 1. Delete dependent players first
    const { data: players, error: playersFetchError } = await supabase.from('players').select('id').eq('team_id', id);
    if (playersFetchError) console.error('DEBUG: [SERVICE] Error fetching players for team:', playersFetchError);

    if (players && players.length > 0) {
      console.log(`DEBUG: [SERVICE] Found ${players.length} players for team ${id}, deleting them first...`);
      for (const player of players) {
        try {
          await this.deletePlayer(player.id);
        } catch (e) {
          console.warn(`DEBUG: [SERVICE] Non-fatal error deleting player ${player.id} during team cascade:`, e);
        }
      }
    }

    // 2. Delete dependent fixtures first (where team is home or away)
    const { data: homeFixtures } = await supabase.from('fixtures').select('id').eq('home_team_id', id);
    const { data: awayFixtures } = await supabase.from('fixtures').select('id').eq('away_team_id', id);
    
    // Deduplicate fixture IDs
    const fixtureIds = new Set([
      ...(homeFixtures?.map(f => f.id) || []),
      ...(awayFixtures?.map(f => f.id) || [])
    ]);
    
    if (fixtureIds.size > 0) {
      console.log(`DEBUG: [SERVICE] Found ${fixtureIds.size} unique fixtures for team ${id}, deleting them first...`);
      for (const fixtureId of fixtureIds) {
        try {
          await this.deleteFixture(fixtureId);
        } catch (e) {
          console.warn(`DEBUG: [SERVICE] Non-fatal error deleting fixture ${fixtureId} during team cascade:`, e);
        }
      }
    }

    // 3. Delete the team
    console.log(`DEBUG: [SERVICE] Executing final delete for team: ${id}`);
    const response = await supabase.from('teams').delete().eq('id', id).select();

    console.log('DEBUG: [SERVICE] deleteTeam response', {
      status: response.status,
      error: response.error,
      data: response.data,
      count: response.data?.length
    });

    if (response.error) {
      console.error(`DEBUG: [SERVICE] Error deleting team ${id}:`, response.error);
      throw response.error;
    }

    if (!response.data || response.data.length === 0) {
      console.warn(`DEBUG: [SERVICE] No rows deleted for team ${id}. It may not exist or RLS blocked it.`);
    } else {
      console.log(`DEBUG: [SERVICE] Successfully deleted team ${id}`);
    }
    return true;
  },

  // Players
  async createPlayer(player: Partial<Player>) {
    // 1. Create the player
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .insert({ 
        team_id: player.team_id,
        full_name: player.full_name,
        position: player.position,
        shirt_number: player.shirt_number,
        photo_url: player.photo_url,
        birth_year: player.birth_year,
        is_active: player.is_active ?? true,
        claimed_by_user_id: player.claimed_by_user_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (playerError) throw playerError;

    // 2. Create initial stats for the player
    const statsPayload = {
      player_id: playerData.id,
      overall: 50,
      tem: 50,
      sch: 50,
      pas: 50,
      dri: 50,
      def: 50,
      phy: 50,
      updated_at: new Date().toISOString()
    };
    const { error: statsError } = await supabase
      .from('player_stats')
      .insert(statsPayload);

    if (statsError) {
      console.error('CRITICAL WARNING: Player created but stats failed:', statsError);
      return { ...playerData, statsError: statsError.message } as Player & { statsError?: string };
    }

    return playerData as Player;
  },

  async updatePlayer(id: string, updates: Partial<Player>) {
    const { data, error } = await supabase
      .from('players')
      .update({
        team_id: updates.team_id,
        full_name: updates.full_name,
        position: updates.position,
        shirt_number: updates.shirt_number,
        photo_url: updates.photo_url,
        birth_year: updates.birth_year,
        is_active: updates.is_active,
        claimed_by_user_id: updates.claimed_by_user_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Player;
  },

  async deletePlayer(id: string) {
    console.log(`DEBUG: [SERVICE] Attempting to delete player: ${id}`);
    await this.checkAdmin();

    // 1. Delete player stats
    const statsResponse = await supabase.from('player_stats').delete().eq('player_id', id).select();
    console.log('DEBUG: [SERVICE] deletePlayer stats response', statsResponse);
    
    // 2. Delete player rating history
    const historyResponse = await supabase.from('player_rating_history').delete().eq('player_id', id).select();
    console.log('DEBUG: [SERVICE] deletePlayer history response', historyResponse);

    // 3. Delete fixture lineups
    const lineupResponse = await supabase.from('fixture_lineups').delete().eq('player_id', id).select();
    console.log('DEBUG: [SERVICE] deletePlayer lineup response', lineupResponse);

    // 4. Delete the player
    console.log(`DEBUG: [SERVICE] Executing final delete for player: ${id}`);
    const response = await supabase.from('players').delete().eq('id', id).select();
    console.log('DEBUG: [SERVICE] deletePlayer response', {
      status: response.status,
      error: response.error,
      data: response.data,
      count: response.data?.length
    });

    if (response.error) {
      console.error(`DEBUG: [SERVICE] Error deleting player ${id}:`, response.error);
      throw response.error;
    }

    if (!response.data || response.data.length === 0) {
      console.warn(`DEBUG: [SERVICE] No rows deleted for player ${id}. It may not exist or RLS blocked it.`);
    } else {
      console.log(`DEBUG: [SERVICE] Successfully deleted player ${id}`);
    }
    return true;
  },

  // Fixtures
  async createFixture(fixture: Partial<Fixture>) {
    console.log('DEBUG: createFixture payload:', fixture);
    const { data, error } = await supabase
      .from('fixtures')
      .insert({ 
        league_id: fixture.league_id,
        home_team_id: fixture.home_team_id,
        away_team_id: fixture.away_team_id,
        kickoff_at: fixture.kickoff_at,
        status: fixture.status || 'upcoming',
        venue_name: fixture.venue_name,
        home_score: fixture.home_score,
        away_score: fixture.away_score,
        checkin_code: fixture.checkin_code,
        checkin_opens_at: fixture.checkin_opens_at,
        checkin_closes_at: fixture.checkin_closes_at,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('DEBUG: createFixture error:', error);
      throw error;
    }
    console.log('DEBUG: createFixture success:', data);
    return data as Fixture;
  },

  async updateFixture(id: string, updates: Partial<Fixture>) {
    const { data, error } = await supabase
      .from('fixtures')
      .update({
        league_id: updates.league_id,
        home_team_id: updates.home_team_id,
        away_team_id: updates.away_team_id,
        kickoff_at: updates.kickoff_at,
        status: updates.status,
        venue_name: updates.venue_name,
        home_score: updates.home_score,
        away_score: updates.away_score,
        checkin_code: updates.checkin_code,
        checkin_opens_at: updates.checkin_opens_at,
        checkin_closes_at: updates.checkin_closes_at,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Fixture;
  },

  async deleteFixture(id: string) {
    console.log(`DEBUG: [SERVICE] Attempting to delete fixture: ${id}`);
    await this.checkAdmin();

    // 1. Delete fixture lineups
    const lineupResponse = await supabase.from('fixture_lineups').delete().eq('fixture_id', id).select();
    console.log('DEBUG: [SERVICE] deleteFixture lineups response', lineupResponse);

    // 2. Delete match checkins
    const checkinResponse = await supabase.from('match_checkins').delete().eq('fixture_id', id).select();
    console.log('DEBUG: [SERVICE] deleteFixture checkins response', checkinResponse);

    // 3. Delete player rating history linked to this fixture
    const historyResponse = await supabase.from('player_rating_history').delete().eq('fixture_id', id).select();
    console.log('DEBUG: [SERVICE] deleteFixture history response', historyResponse);

    // 4. Delete the fixture
    console.log(`DEBUG: [SERVICE] Executing final delete for fixture: ${id}`);
    const response = await supabase.from('fixtures').delete().eq('id', id).select();
    console.log('DEBUG: [SERVICE] deleteFixture response', {
      status: response.status,
      error: response.error,
      data: response.data,
      count: response.data?.length
    });

    if (response.error) {
      console.error(`DEBUG: [SERVICE] Error deleting fixture ${id}:`, response.error);
      throw response.error;
    }

    if (!response.data || response.data.length === 0) {
      console.warn(`DEBUG: [SERVICE] No rows deleted for fixture ${id}. It may not exist or RLS blocked it.`);
    } else {
      console.log(`DEBUG: [SERVICE] Successfully deleted fixture ${id}`);
    }
    return true;
  },

  // Lineups
  async getFixtureLineup(fixtureId: string) {
    const { data, error } = await supabase
      .from('fixture_lineups')
      .select('*')
      .eq('fixture_id', fixtureId);
    if (error) throw error;
    return data as FixtureLineup[];
  },

  async updateFixtureLineup(fixtureId: string, lineupEntries: any[]) {
    console.log(`DEBUG: [SERVICE] Attempting to update fixture lineup for fixture: ${fixtureId}`);
    await this.checkAdmin();

    // 1. Delete existing lineup for this fixture
    console.log(`DEBUG: [SERVICE] Deleting existing lineup for fixture: ${fixtureId}`);
    const { error: deleteError } = await supabase
      .from('fixture_lineups')
      .delete()
      .eq('fixture_id', fixtureId);
    
    if (deleteError) {
      console.error('DEBUG: [SERVICE] Error deleting existing lineup:', deleteError);
      throw deleteError;
    }

    // 2. Insert new lineup
    if (lineupEntries.length === 0) {
      console.log('DEBUG: [SERVICE] Lineup cleared for fixture', fixtureId);
      return [];
    }

    const entriesWithTimestamp = lineupEntries.map(entry => ({
      ...entry,
      created_at: new Date().toISOString()
    }));

    const { data, error: insertError } = await supabase
      .from('fixture_lineups')
      .insert(entriesWithTimestamp)
      .select();
    
    if (insertError) {
      console.error('DEBUG: [SERVICE] Error inserting new lineup:', insertError);
      throw insertError;
    }

    console.log(`DEBUG: [SERVICE] Successfully updated lineup for fixture ${fixtureId}, inserted ${data?.length} rows.`);
    return data as FixtureLineup[];
  },

  async getPlayersByTeam(teamId: string) {
    const { data, error } = await supabase
      .from('players')
      .select('*, player_stats(*)')
      .eq('team_id', teamId)
      .order('full_name');
    if (error) throw error;
    return data as (Player & { player_stats: PlayerStats[] })[];
  },

  // RPC Functions
  async claimPlayerCard(playerId: string) {
    const { data, error } = await supabase.rpc('claim_player_card', {
      p_player_id: playerId
    });
    if (error) throw error;
    return data;
  },

  async createMatchCheckin(fixtureId: string, checkinCode: string) {
    // TEMP: allow check-in after match for testing
    // Try the RPC first, as it handles the core logic and security
    const { data, error } = await supabase.rpc('create_match_checkin', {
      p_fixture_id: fixtureId,
      p_checkin_code: checkinCode
    });
    
    // If the RPC fails (likely due to status/time restrictions in production), 
    // we attempt a direct insert for testing purposes if the code is correct.
    if (error) {
      console.warn('RPC create_match_checkin failed, attempting direct insert for testing:', error.message);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw error;

      // Verify the check-in code manually
      const { data: fixture, error: fixtureError } = await supabase
        .from('fixtures')
        .select('checkin_code, status')
        .eq('id', fixtureId)
        .single();
      
      if (fixtureError || !fixture) throw error;

      if (fixture.checkin_code === checkinCode) {
        // Direct insert to bypass RPC restrictions (status/time)
        const { data: insertData, error: insertError } = await supabase
          .from('match_checkins')
          .insert({
            fixture_id: fixtureId,
            user_id: user.id,
            checked_in_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('Direct check-in insert also failed:', insertError);
          throw error; // Throw the original RPC error
        }
        return insertData;
      }
      
      throw error;
    }
    return data;
  },

  async submitPlayerVote(fixtureId: string, playerId: string, vote: 'up' | 'down') {
    const { data, error } = await supabase.rpc('submit_player_vote', {
      p_fixture_id: fixtureId,
      p_player_id: playerId,
      p_vote: vote
    });
    if (error) throw error;
    return data;
  },

  async getFixtureLineupWithPlayers(fixtureId: string) {
    console.log('supabaseService: Fetching lineup for fixture:', fixtureId);
    const { data, error } = await supabase
      .from('fixture_lineups')
      .select(`
        *,
        players (
          *,
          player_stats (*)
        ),
        teams (
          name,
          clubs (
            name
          )
        )
      `)
      .eq('fixture_id', fixtureId);
    
    if (error) {
      console.error('supabaseService: getFixtureLineupWithPlayers error:', error);
      throw error;
    }
    
    console.log(`supabaseService: Loaded ${data?.length || 0} lineup entries`);
    return data as any[];
  },

  async getUserVotesForFixture(userId: string, fixtureId: string) {
    const { data, error } = await supabase
      .from('player_votes')
      .select('*')
      .eq('user_id', userId)
      .eq('fixture_id', fixtureId);
    if (error) throw error;
    return data as any[];
  },

  async getVotesForFixture(fixtureId: string) {
    const { data, error } = await supabase
      .from('player_votes')
      .select('*')
      .eq('fixture_id', fixtureId);
    if (error) throw error;
    return data as any[];
  },

  async processFixtureRatings(fixtureId: string) {
    console.log(`DEBUG: [SERVICE] Starting rating processing for fixture: ${fixtureId}`);
    await this.checkAdmin();

    // 1. Get all players in the lineup
    const lineup = await this.getFixtureLineupWithPlayers(fixtureId);
    console.log(`DEBUG: [SERVICE] Number of lineup players: ${lineup.length}`);
    if (lineup.length === 0) {
      console.warn(`DEBUG: [SERVICE] No players found in lineup for fixture: ${fixtureId}`);
      throw new Error('No players in lineup for this fixture. Please add appearances first.');
    }

    // 2. Get all votes for this fixture
    const votes = await this.getVotesForFixture(fixtureId);
    console.log(`DEBUG: [SERVICE] Found ${votes.length} total votes for fixture: ${fixtureId}`);

    // 3. Check if already processed (by checking history)
    const { data: existingHistory, error: historyError } = await supabase
      .from('player_rating_history')
      .select('player_id')
      .eq('fixture_id', fixtureId);
    
    if (historyError) {
      console.error(`DEBUG: [SERVICE] Error fetching existing history:`, historyError);
      throw historyError;
    }
    
    const processedPlayerIds = new Set(existingHistory?.map(h => h.player_id) || []);
    console.log(`DEBUG: [SERVICE] ${processedPlayerIds.size} players already have rating history for this fixture.`);

    // 4. Get current stats for all players in lineup
    const playerIds = lineup.map(e => e.player_id);
    const { data: allStats, error: statsError } = await supabase
      .from('player_stats')
      .select('*')
      .in('player_id', playerIds);
    
    if (statsError) {
      console.error(`DEBUG: [SERVICE] Error fetching player stats:`, statsError);
      throw statsError;
    }
    
    const statsMap = new Map(allStats?.map(s => [s.player_id, s]));

    const results = [];
    let processedCount = 0;

    for (const entry of lineup) {
      const playerId = entry.player_id;
      
      // Skip if already processed
      if (processedPlayerIds.has(playerId)) {
        console.log(`DEBUG: [SERVICE] Skipping player ${playerId} as they are already processed.`);
        continue;
      }

      const playerVotes = votes.filter(v => v.player_id === playerId);
      const upVotes = playerVotes.filter(v => v.vote === 'up').length;
      const downVotes = playerVotes.filter(v => v.vote === 'down').length;
      const net = upVotes - downVotes;

      // MVP Logic:
      // net >= 3 => +2
      // net = 1 or 2 => +1
      // net = 0 => 0
      // net = -1 or -2 => -1
      // net <= -3 => -2
      let delta = 0;
      if (net >= 3) delta = 2;
      else if (net >= 1) delta = 1;
      else if (net === 0) delta = 0;
      else if (net >= -2) delta = -1;
      else delta = -2;

      const currentStats = statsMap.get(playerId);
      const oldOverall = currentStats?.overall || 50;
      let newOverall = oldOverall + delta;
      
      // Clamp between 30 and 95
      newOverall = Math.max(30, Math.min(95, newOverall));

      console.log(`DEBUG: [SERVICE] Processing player ${playerId}: Up: ${upVotes}, Down: ${downVotes}, Net: ${net}, Delta: ${delta}, Old: ${oldOverall}, New: ${newOverall}`);

      // Update stats using upsert to ensure row exists
      const { error: updateError } = await supabase
        .from('player_stats')
        .upsert({ 
          player_id: playerId,
          overall: newOverall,
          updated_at: new Date().toISOString()
        }, { onConflict: 'player_id' });
      
      if (updateError) {
        console.error(`DEBUG: [SERVICE] Update result for player_stats (${playerId}): FAILED`, updateError);
        continue; // Skip history if update failed
      } else {
        console.log(`DEBUG: [SERVICE] Update result for player_stats (${playerId}): SUCCESS`);
      }

      // Insert history
      const { data: history, error: insertHistoryError } = await supabase
        .from('player_rating_history')
        .insert({
          fixture_id: fixtureId,
          player_id: playerId,
          old_overall: oldOverall,
          new_overall: newOverall,
          delta_overall: delta,
          up_votes: upVotes,
          down_votes: downVotes,
          processed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertHistoryError) {
        console.error(`DEBUG: [SERVICE] Insert result for player_rating_history (${playerId}): FAILED`, insertHistoryError);
      } else {
        console.log(`DEBUG: [SERVICE] Insert result for player_rating_history (${playerId}): SUCCESS`, history);
        results.push(history);
        processedCount++;
      }
    }

    console.log(`DEBUG: [SERVICE] Total processed players: ${processedCount}`);
    console.log(`DEBUG: [SERVICE] Finished processing ratings for fixture: ${fixtureId}`);
    return results;
  },

  async getProcessedCounts(fixtureIds: string[]) {
    if (fixtureIds.length === 0) return {};
    const { data, error } = await supabase
      .from('player_rating_history')
      .select('fixture_id, player_id')
      .in('fixture_id', fixtureIds);
    
    if (error) throw error;
    
    const counts: Record<string, number> = {};
    data?.forEach(h => {
      counts[h.fixture_id] = (counts[h.fixture_id] || 0) + 1;
    });
    return counts;
  },

  // Queries
  async getLeagues() {
    const { data, error } = await supabase.from('leagues').select('*').order('name');
    if (error) throw error;
    return data as League[];
  },

  async getClubs(leagueId?: string) {
    let query = supabase.from('clubs').select('*, leagues(name)').order('name');
    if (leagueId) query = query.eq('league_id', leagueId);
    const { data, error } = await query;
    if (error) throw error;
    return data as Club[];
  },

  async getTeams(clubId?: string) {
    let query = supabase.from('teams').select('*, clubs(name)').order('name');
    if (clubId) query = query.eq('club_id', clubId);
    const { data, error } = await query;
    if (error) throw error;
    return data as Team[];
  },

  async getPlayers(teamId?: string) {
    let query = supabase.from('players').select('*, teams(name, clubs(logo_url)), player_stats(*)').order('full_name');
    if (teamId) query = query.eq('team_id', teamId);
    const { data, error } = await query;
    if (error) throw error;
    return data as (Player & { teams: { name: string, clubs: { logo_url: string } }, player_stats: PlayerStats[] })[];
  },

  async getTopPlayers(limit: number = 6) {
    const { data, error } = await supabase
      .from('players')
      .select('*, teams(name, clubs(logo_url)), player_stats!inner(*)')
      .order('overall', { foreignTable: 'player_stats', ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data as (Player & { teams: { name: string, clubs: { logo_url: string } }, player_stats: PlayerStats[] })[];
  },

  async getPlayerById(id: string) {
    const { data, error } = await supabase
      .from('players')
      .select('*, teams(name, club_id, clubs(name, logo_url)), player_stats(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as (Player & { teams: Team & { clubs: Club }, player_stats: PlayerStats[] });
  },

  async getFixtures() {
    const { data, error } = await supabase
      .from('fixtures')
      .select('*, home_team:teams!home_team_id(name, club_id, clubs(name)), away_team:teams!away_team_id(name, club_id, clubs(name)), leagues(name)')
      .order('kickoff_at', { ascending: false });
    if (error) throw error;
    return data as Fixture[];
  },

  async getFixtureById(id: string) {
    console.log('supabaseService: getFixtureById called with id:', id);
    const { data, error } = await supabase
      .from('fixtures')
      .select('*, home_team:teams!home_team_id(name, club_id, clubs(name)), away_team:teams!away_team_id(name, club_id, clubs(name)), leagues(name)')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('supabaseService: getFixtureById error:', error);
      throw error;
    }
    
    console.log('supabaseService: getFixtureById success:', data?.id);
    return data as Fixture;
  },

  async getPlayersByClubs(clubIds: string[]) {
    // We use !inner to ensure we only get players who belong to a team that belongs to one of the clubs
    // Note: Filtering on joined tables in PostgREST requires the !inner hint and the correct path
    const { data, error } = await supabase
      .from('players')
      .select('*, teams!inner(name, club_id, clubs(name))')
      .filter('teams.club_id', 'in', `(${clubIds.join(',')})`)
      .order('full_name');
    
    if (error) throw error;
    return data as any[];
  },

  async getUserCheckins(userId: string) {
    return await supabase
      .from('match_checkins')
      .select('fixture_id')
      .eq('user_id', userId);
  },

  async getPlayerRatingHistory(playerId: string) {
    const { data, error } = await supabase
      .from('player_rating_history')
      .select('*, fixtures(kickoff_at)')
      .eq('player_id', playerId)
      .order('processed_at', { ascending: false });
    if (error) throw error;
    return data as (PlayerRatingHistory & { fixtures: { kickoff_at: string } })[];
  }
};
