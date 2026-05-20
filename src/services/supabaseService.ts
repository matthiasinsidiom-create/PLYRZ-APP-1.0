import { supabase } from '../lib/supabase';
import { appConfig } from '../lib/config';
import { calculateDistance } from '../lib/geo';
import { League, Club, Team, Player, Fixture, Profile, FixtureLineup, PlayerStats, PlayerRatingHistory, MatchEvent, ClubAdmin } from '../types';
import { mapPlayerWithStats } from '../lib/stats';
import { User } from '@supabase/supabase-js';

// Local cache for the current user to improve reliability in iframes
let cachedUser: User | null = null;

// Initialize the cache and listen for changes
supabase.auth.getSession().then(({ data: { session } }) => {
  cachedUser = session?.user ?? null;
});

supabase.auth.onAuthStateChange((_event, session) => {
  cachedUser = session?.user ?? null;
  console.log('DEBUG: [SERVICE] Auth state changed in service:', { event: _event, hasUser: !!cachedUser });
});

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

  // Helper to check admin status with optional fixture context
  async checkAdmin(fixtureId?: string) {
    // Try cached user first
    let user = cachedUser;
    if (!user) {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }
    
    if (!user) {
      throw new Error("Nicht authentifiziert");
    }

    // Super Admin Check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === 'admin' || user.email === "matthias.insidiom@gmail.com";
    
    if (isSuperAdmin) {
      cachedUser = user;
      return { user, profile, isSuperAdmin: true };
    }

    // If fixtureId is provided, check if user is a club admin for that fixture
    if (fixtureId) {
      const hasAccess = await this.canManageFixture(fixtureId);
      if (hasAccess) {
        cachedUser = user;
        return { user, profile, isSuperAdmin: false };
      }
    }
    
    throw new Error("Nicht autorisiert");
  },

  async isUserAdmin() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      
      if (session.user.email?.toLowerCase() === "matthias.insidiom@gmail.com") return true;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
        
      return profile?.role === 'admin';
    } catch (e) {
      return false;
    }
  },

  async isMainAdmin() {
    return this.isUserAdmin();
  },

  async getUserVisibilityContext() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { isMainAdmin: false, leagueIds: [], clubIds: [], onboarding_completed: false };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, selected_league_id, favorite_club_id, onboarding_completed')
      .eq('id', session.user.id)
      .maybeSingle();

    const isMainAdmin = profile?.role === 'admin' || session.user.email?.toLowerCase() === "matthias.insidiom@gmail.com";

    if (isMainAdmin) {
      return { isMainAdmin: true, leagueIds: [], clubIds: [], onboarding_completed: true };
    }

    const leagueIds = new Set<string>();
    const clubIds = new Set<string>();

    if (profile?.selected_league_id) leagueIds.add(profile.selected_league_id);
    if (profile?.favorite_club_id) clubIds.add(profile.favorite_club_id);

    const { data: clubAdmins } = await supabase
      .from('club_admins')
      .select('club_id, clubs(league_id)')
      .eq('user_id', session.user.id)
      .eq('is_active', true);

    if (clubAdmins) {
      clubAdmins.forEach(ca => {
        if (ca.club_id) clubIds.add(ca.club_id);
        if ((ca.clubs as any)?.league_id) leagueIds.add((ca.clubs as any).league_id);
      });
    }

    return {
      isMainAdmin: false,
      leagueIds: Array.from(leagueIds),
      clubIds: Array.from(clubIds),
      onboarding_completed: profile?.onboarding_completed || false
    };
  },

  async getClubAdminAccess() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const { data, error } = await supabase
        .from('club_admins')
        .select(`
          *,
          clubs (*)
        `)
        .eq('user_id', session.user.id)
        .eq('is_active', true);

      if (error) throw error;
      return data as ClubAdmin[];
    } catch (e) {
      console.error('DEBUG: [SERVICE] getClubAdminAccess error:', e);
      return [];
    }
  },

  async canManageFixture(fixtureId: string) {
    try {
      const isAdmin = await this.isMainAdmin();
      if (isAdmin) return true;

      const access = await this.getClubAdminAccess();
      if (access.length === 0) return false;

      const { data: fixture, error } = await supabase
        .from('fixtures')
        .select('home_team_id, away_team_id, match_type')
        .eq('id', fixtureId)
        .single();

      if (error || !fixture) return false;

      // Check if user is admin for home or away club
      // First, get the clubs for those teams
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, club_id')
        .in('id', [fixture.home_team_id, fixture.away_team_id]);

      if (teamsError || !teams) return false;

      const homeClubId = teams.find(t => t.id === fixture.home_team_id)?.club_id;
      const awayClubId = teams.find(t => t.id === fixture.away_team_id)?.club_id;

      return access.some(a => 
        (a.club_id === homeClubId || a.club_id === awayClubId) &&
        (a.team_scope === 'all' || a.team_scope === fixture.match_type)
      );
    } catch (e) {
      return false;
    }
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
    await this.checkAdmin();
    console.log('DEBUG: [SERVICE] createClub payload:', club);
    const { data, error } = await supabase
      .from('clubs')
      .insert({ 
        league_id: club.league_id,
        name: club.name,
        short_name: club.short_name,
        logo_url: club.logo_url,
        latitude: club.latitude,
        longitude: club.longitude,
        radius_meters: club.radius_meters,
        pitch_name: club.pitch_name,
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
    await this.checkAdmin();
    console.log('DEBUG: [SERVICE] updateClub payload:', { id, updates });
    const { data, error } = await supabase
      .from('clubs')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('DEBUG: [SERVICE] updateClub error:', error);
      throw error;
    }
    console.log('DEBUG: [SERVICE] updateClub success:', data);
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
  async createPlayer(player: Partial<Player>, initialStats?: Partial<PlayerStats>) {
    console.log('DEBUG: [SERVICE] createPlayer started');
    await this.checkAdmin();
    
    // 1. Create the player - only include fields that are likely in the schema
    const playerInsertData: any = { 
      team_id: player.team_id,
      full_name: player.full_name,
      position: player.position,
      jersey_number: player.jersey_number,
      photo_url: player.photo_url,
      birth_year: player.birth_year,
      is_active: player.is_active ?? true,
      nationality: player.nationality,
      card_layout: player.card_layout,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Only add claimed_by_user_id if it's explicitly provided
    if (player.claimed_by_user_id !== undefined) {
      playerInsertData.claimed_by_user_id = player.claimed_by_user_id;
    }
    
    console.log('DEBUG: [SERVICE] createPlayer - Player Payload:', playerInsertData);

    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .insert(playerInsertData)
      .select()
      .single();
    
    if (playerError) {
      console.error('DEBUG: [SERVICE] createPlayer - Player Insert Error:', playerError);
      const detailedError = new Error(playerError.message);
      (detailedError as any).details = playerError.details;
      (detailedError as any).hint = playerError.hint;
      (detailedError as any).code = playerError.code;
      throw detailedError;
    }

    if (!playerData) {
      console.error('DEBUG: [SERVICE] createPlayer - No data returned after insert');
      throw new Error('Player creation failed: No data returned from database.');
    }

    console.log('DEBUG: [SERVICE] createPlayer - Player Insert Success:', playerData);

    // 2. Create initial stats for the player
    const statsPayload: any = {
      player_id: playerData.id,
      overall: initialStats?.overall ?? 50,
      tem: initialStats?.tem ?? 50,
      sch: initialStats?.sch ?? 50,
      pas: initialStats?.pas ?? 50,
      dri: initialStats?.dri ?? 50,
      def: initialStats?.def ?? 50,
      phy: initialStats?.phy ?? 50,
      updated_at: new Date().toISOString()
    };
    
    console.log('DEBUG: [SERVICE] createPlayer - Stats Payload:', statsPayload);
    const { error: statsError } = await supabase
      .from('player_stats')
      .insert(statsPayload);

    if (statsError) {
      console.error('DEBUG: [SERVICE] createPlayer - Stats Insert Error:', statsError);
      // If stats fail, it's a major issue for the app's functionality, so we throw
      throw new Error(`Player created but stats initialization failed: ${statsError.message}`);
    }

    console.log('DEBUG: [SERVICE] createPlayer - Stats Insert Success');
    return playerData as Player;
  },

  async updatePlayer(id: string, updates: Partial<Player>, statsUpdates?: Partial<PlayerStats>) {
    console.log('DEBUG: [SERVICE] updatePlayer started for ID:', id);
    await this.checkAdmin();
    
    const playerUpdateData: any = {
      team_id: updates.team_id,
      full_name: updates.full_name,
      position: updates.position,
      jersey_number: updates.jersey_number,
      photo_url: updates.photo_url,
      birth_year: updates.birth_year,
      is_active: updates.is_active,
      nationality: updates.nationality,
      card_layout: updates.card_layout,
      updated_at: new Date().toISOString()
    };

    if (updates.claimed_by_user_id !== undefined) {
      playerUpdateData.claimed_by_user_id = updates.claimed_by_user_id;
    }
    
    console.log('DEBUG: [SERVICE] updatePlayer - Player Update Payload:', playerUpdateData);

    const { data, error } = await supabase
      .from('players')
      .update(playerUpdateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('DEBUG: [SERVICE] updatePlayer - Player Update Error:', error);
      const detailedError = new Error(error.message);
      (detailedError as any).details = error.details;
      (detailedError as any).hint = error.hint;
      (detailedError as any).code = error.code;
      throw detailedError;
    }

    console.log('DEBUG: [SERVICE] updatePlayer - Player Update Success:', data);

    if (statsUpdates) {
      const statsUpsertData: any = {
        player_id: id,
        overall: statsUpdates.overall,
        tem: statsUpdates.tem,
        sch: statsUpdates.sch,
        pas: statsUpdates.pas,
        dri: statsUpdates.dri,
        def: statsUpdates.def,
        phy: statsUpdates.phy,
        updated_at: new Date().toISOString()
      };

      console.log('DEBUG: [SERVICE] updatePlayer - Stats Upsert Payload:', statsUpsertData);
      
      const { error: statsError } = await supabase
        .from('player_stats')
        .upsert(statsUpsertData, { onConflict: 'player_id' });
      
      if (statsError) {
        console.error('DEBUG: [SERVICE] updatePlayer - Stats Upsert Error:', statsError);
        throw new Error(`Player updated but stats update failed: ${statsError.message}`);
      } else {
        console.log('DEBUG: [SERVICE] updatePlayer - Stats Upsert Success');
      }
    }

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

  // Global Settings
  async getGlobalSettings(key: string) {
    console.log(`DEBUG: [SERVICE] getGlobalSettings request for key: ${key}`);
    const { data, error } = await supabase
      .from('global_settings')
      .select('*')
      .eq('key', key)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.warn(`DEBUG: [SERVICE] Error fetching global setting "${key}":`, error);
    }
    
    console.log(`DEBUG: [SERVICE] getGlobalSettings response for key ${key}:`, data);
    return data?.value;
  },

  async clearAllPlayerLayouts() {
    console.log('DEBUG: [SERVICE] clearAllPlayerLayouts started');
    await this.checkAdmin();
    // Update all players to have empty card_layout
    const { error } = await supabase
      .from('players')
      .update({ card_layout: {} })
      .not('id', 'is', null); // Match all rows safely
    if (error) {
      console.error('DEBUG: [SERVICE] Error clearing player layouts:', error);
      throw error;
    }
  },

  async updateGlobalSettings(key: string, value: any) {
    await this.checkAdmin();
    
    // First, try to upsert with onConflict. This is the most efficient way if the constraint exists.
    const { data, error } = await supabase
      .from('global_settings')
      .upsert({ 
        key, 
        value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })
      .select()
      .maybeSingle(); // Use maybeSingle to avoid error if it returns nothing for some reason
    
    if (error) {
      console.warn(`DEBUG: [SERVICE] Upsert failed for key "${key}", attempting manual update/insert fallback:`, error);
      
      // Fallback: Try update first
      const { data: updateData, error: updateError } = await supabase
        .from('global_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key)
        .select()
        .maybeSingle();
        
      if (updateError) {
        console.error(`DEBUG: [SERVICE] Manual update fallback failed for key "${key}":`, updateError);
        throw updateError;
      }
      
      if (updateData) {
        console.log(`DEBUG: [SERVICE] Manual update fallback success for key ${key}:`, updateData);
        return updateData;
      }
      
      // If no row was updated, try insert
      const { data: insertData, error: insertError } = await supabase
        .from('global_settings')
        .insert({ key, value, updated_at: new Date().toISOString() })
        .select()
        .single();
        
      if (insertError) {
        console.error(`DEBUG: [SERVICE] Manual insert fallback failed for key "${key}":`, insertError);
        throw insertError;
      }
      
      console.log(`DEBUG: [SERVICE] Manual insert fallback success for key ${key}:`, insertData);
      return insertData;
    }
    
    console.log(`DEBUG: [SERVICE] updateGlobalSettings success for key ${key}:`, data);
    return data;
  },

  async uploadPlayerPhoto(file: File) {
    await this.checkAdmin();
    console.log('DEBUG: [SERVICE] uploadPlayerPhoto started for file:', file.name);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `players/photos/${fileName}`;

    console.log('DEBUG: [SERVICE] uploadPlayerPhoto uploading to path:', filePath);
    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(filePath, file);

    if (uploadError) {
      console.error('DEBUG: [SERVICE] uploadPlayerPhoto upload error:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('assets')
      .getPublicUrl(filePath);

    console.log('DEBUG: [SERVICE] uploadPlayerPhoto success, publicUrl:', data.publicUrl);
    return data.publicUrl;
  },

  async uploadClubLogo(file: File) {
    await this.checkAdmin();
    console.log('DEBUG: [SERVICE] uploadClubLogo started for file:', file.name);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `clubs/logos/${fileName}`;

    console.log('DEBUG: [SERVICE] uploadClubLogo uploading to path:', filePath);
    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(filePath, file);

    if (uploadError) {
      console.error('DEBUG: [SERVICE] uploadClubLogo upload error:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('assets')
      .getPublicUrl(filePath);

    console.log('DEBUG: [SERVICE] uploadClubLogo success. Public URL:', data.publicUrl);
    return data.publicUrl;
  },

  // Match Events
  async getMatchEvents(fixtureId: string) {
    const { data, error } = await supabase
      .from('match_events')
      .select('*')
      .eq('fixture_id', fixtureId);
    if (error) throw error;
    return data as MatchEvent[];
  },

  async createMatchEvent(event: Partial<MatchEvent>) {
    if (!event.fixture_id) throw new Error("Fixture ID erforderlich");
    await this.checkAdmin(event.fixture_id);
    const { data, error } = await supabase
      .from('match_events')
      .insert({
        ...event,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data as MatchEvent;
  },

  async deleteMatchEvent(id: string) {
    const { data: event } = await supabase.from('match_events').select('fixture_id').eq('id', id).single();
    if (event) {
      await this.checkAdmin(event.fixture_id);
    } else {
      await this.checkAdmin();
    }
    const { error } = await supabase
      .from('match_events')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  async deleteMatchEvents(fixtureId: string) {
    await this.checkAdmin(fixtureId);
    const { error } = await supabase
      .from('match_events')
      .delete()
      .eq('fixture_id', fixtureId);
    if (error) throw error;
    return true;
  },

  async syncMatchEvents(fixtureId: string, events: Partial<MatchEvent>[]) {
    await this.checkAdmin(fixtureId);
    
    // 1. Delete existing events
    const { error: deleteError } = await supabase
      .from('match_events')
      .delete()
      .eq('fixture_id', fixtureId);
    
    if (deleteError) throw deleteError;

    if (events.length === 0) return [];

    // 2. Insert new events
    const { data, error: insertError } = await supabase
      .from('match_events')
      .insert(events.map(e => ({
        fixture_id: fixtureId,
        player_id: e.player_id,
        team_id: e.team_id,
        event_type: e.event_type,
        minute: e.minute,
        extra_minute: e.extra_minute || 0,
        created_at: new Date().toISOString()
      })))
      .select();

    if (insertError) throw insertError;
    return data as MatchEvent[];
  },

  async getPlayersByClub(clubId: string) {
    // 1. Get all teams for the club
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id')
      .eq('club_id', clubId);
    
    if (teamsError) throw teamsError;
    if (!teams || teams.length === 0) return [];

    const teamIds = teams.map(t => t.id);

    // 2. Get all players for these teams
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*, teams(name, club_id, clubs(logo_url))')
      .in('team_id', teamIds)
      .order('full_name');
    
    if (playersError) throw playersError;
    if (!playersData || playersData.length === 0) return [];

    // 3. Fetch stats
    const playerIds = playersData.map(p => p.id);
    const { data: statsData, error: statsError } = await supabase
      .from('player_stats')
      .select('*')
      .in('player_id', playerIds);

    const statsByPlayer: Record<string, PlayerStats[]> = {};
    statsData?.forEach(stat => {
      if (!statsByPlayer[stat.player_id]) {
        statsByPlayer[stat.player_id] = [];
      }
      statsByPlayer[stat.player_id].push(stat);
    });

    const globalLayout = await this.getGlobalSettings('default_player_card_layout');

    const playersWithStats = playersData.map(p => {
      const pLayout = p.card_layout || {};
      const hasSpecificLayout = Object.keys(pLayout).length > 0;
      return {
        ...p,
        card_layout: hasSpecificLayout ? pLayout : globalLayout,
        player_stats: statsByPlayer[p.id] || []
      };
    });

    return mapPlayerWithStats(playersWithStats);
  },

  // Fixtures
  async createFixture(fixture: Partial<Fixture>) {
    console.log('DEBUG: createFixture payload:', fixture);
    
    // Extract only the fields that belong to the fixtures table
    const { id, created_at, updated_at, home_team, away_team, leagues, ...rest } = fixture as any;
    
    const insertData: any = { 
      ...rest,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('fixtures')
      .insert(insertData)
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
    console.log(`DEBUG: [SERVICE] updateFixture called for ID: ${id}`, updates);
    
    // Check permission for this fixture
    await this.checkAdmin(id);
    
    // 1. Fetch current fixture to check existing voting window and status
    const { data: currentFixture, error: fetchError } = await supabase
      .from('fixtures')
      .select('status, voting_open_at, voting_close_at')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      console.error(`DEBUG: [SERVICE] Error fetching current fixture ${id}:`, fetchError);
      throw fetchError;
    }

    // 2. Prepare final updates, extracting only valid database fields
    const { id: _, created_at, updated_at, home_team, away_team, leagues, ...rest } = updates as any;
    
    const finalUpdates: any = {
      ...rest,
      updated_at: new Date().toISOString()
    };

    // Note: Voting window automation (voting_open_at, voting_close_at) 
    // is now managed entirely by a backend PostgreSQL trigger (handle_fixture_voting_window).
    // The trigger automatically sets the window based on match_type when status changes to 'finished'.

    const { data, error } = await supabase
      .from('fixtures')
      .update(finalUpdates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error(`DEBUG: [SERVICE] Error updating fixture ${id}:`, error);
      throw error;
    }

    if (finalUpdates.status === 'finished' && currentFixture?.status !== 'finished') {
      try {
        const { data: pushData, error: pushError } = await supabase.functions.invoke('send-fixture-push', {
          body: { type: 'voting_open', fixtureId: id }
        });
        console.log('[PUSH] voting_open sent', pushData, pushError);
      } catch (pushError) {
        console.warn('[PUSH] voting_open failed but flow continues', pushError);
      }
    }
    
    console.log(`DEBUG: [SERVICE] updateFixture success for ID: ${id}`);
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
    const isAdmin = await this.isUserAdmin();
    if (!isAdmin) {
      const { data: fixture } = await supabase.from('fixtures').select('kickoff_at, status').eq('id', fixtureId).single();
      if (fixture) {
        if (!fixture.kickoff_at && fixture.status !== 'live') {
          console.log(`DEBUG: [SERVICE] Hiding fixture_lineups for non-admin because kickoff_at missing and not live`);
          return [];
        } else if (fixture.kickoff_at && new Date(fixture.kickoff_at) > new Date() && fixture.status !== 'live') {
          console.log(`DEBUG: [SERVICE] Hiding fixture_lineups for non-admin because match has not started`);
          return [];
        }
      } else {
        return [];
      }
    }

    console.log(`DEBUG: [SERVICE] getFixtureLineup called for fixture_id=${fixtureId}`);
    // Temporarily removing join to test if rows are returned
    const { data, error } = await supabase
      .from('fixture_lineups')
      .select('*')
      .eq('fixture_id', fixtureId);
    
    if (error) {
      console.error('DEBUG: [SERVICE] getFixtureLineup error:', error);
      throw error;
    }

    console.log(`DEBUG: [SERVICE] fixture_lineups raw data for ${fixtureId}:`, JSON.stringify(data, null, 2));

    if (!data || data.length === 0) {
      console.log(`DEBUG: [SERVICE] fixture_lineups returned 0 rows for fixture_id=${fixtureId}`);
    } else {
      console.log(`DEBUG: [SERVICE] fixture_lineups returned ${data.length} rows`);
      
      // If rows exist, fetch players separately to be safe
      const playerIds = data.map(d => d.player_id);
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .in('id', playerIds);
      
      if (playersError) {
        console.error('DEBUG: [SERVICE] Error fetching players separately:', playersError);
      } else {
        console.log(`DEBUG: [SERVICE] Fetched ${playersData?.length} players separately`);
        // Map players back to lineup entries
        data.forEach(entry => {
          entry.players = playersData?.find(p => p.id === entry.player_id);
        });
      }
    }

    return data as FixtureLineup[];
  },

  async getFixtureLineupBulk(fixtureIds: string[]) {
    if (fixtureIds.length === 0) return [];

    const isAdmin = await this.isUserAdmin();
    let allowedFixtureIds = fixtureIds;
    if (!isAdmin) {
      const { data: fixtures } = await supabase.from('fixtures').select('id, kickoff_at, status').in('id', fixtureIds);
      if (fixtures) {
        allowedFixtureIds = fixtures.filter(f => 
          f.status === 'live' || (f.kickoff_at && new Date(f.kickoff_at) <= new Date())
        ).map(f => f.id);
      } else {
        allowedFixtureIds = [];
      }
    }

    if (allowedFixtureIds.length === 0) return [];

    const { data, error } = await supabase
      .from('fixture_lineups')
      .select('fixture_id')
      .in('fixture_id', allowedFixtureIds);
    if (error) throw error;
    return data as { fixture_id: string }[];
  },

  async getFixtureRatingHistoryBulk(fixtureIds: string[]) {
    if (fixtureIds.length === 0) return [];
    const { data, error } = await supabase
      .from('player_rating_history')
      .select('fixture_id')
      .in('fixture_id', fixtureIds);
    if (error) throw error;
    return data as { fixture_id: string }[];
  },

  async updateFixtureLineup(fixtureId: string, lineupEntries: any[]) {
    console.log(`DEBUG: [SERVICE] Attempting to update fixture lineup for fixture: ${fixtureId}`);
    await this.checkAdmin(fixtureId);

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

    // 3. Update player default jersey numbers if they have changed
    console.log('DEBUG: [SERVICE] Updating player default jersey numbers...');
    for (const entry of lineupEntries) {
      if (entry.jersey_number !== null && entry.jersey_number !== undefined) {
        try {
          await supabase
            .from('players')
            .update({ jersey_number: entry.jersey_number, updated_at: new Date().toISOString() })
            .eq('id', entry.player_id);
        } catch (e) {
          console.warn(`DEBUG: [SERVICE] Failed to update default jersey for player ${entry.player_id}:`, e);
        }
      }
    }

    // 4. Note: If fixture is finished and has no voting window, 
    // it will be handled by the backend PostgreSQL trigger `handle_fixture_voting_window` 
    // whenever the fixture record itself is updated/created to 'finished'.

    console.log(`DEBUG: [SERVICE] Successfully updated lineup for fixture ${fixtureId}, inserted ${data?.length} rows.`);
    return data as FixtureLineup[];
  },

  async getPlayersByTeam(teamId: string) {
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .order('full_name');
    
    if (playersError) throw playersError;
    
    if (!playersData || playersData.length === 0) return [];

    const playerIds = playersData.map(p => p.id);
    const { data: statsData, error: statsError } = await supabase
      .from('player_stats')
      .select('*')
      .in('player_id', playerIds);

    const statsByPlayer: Record<string, PlayerStats[]> = {};
    statsData?.forEach(stat => {
      if (!statsByPlayer[stat.player_id]) {
        statsByPlayer[stat.player_id] = [];
      }
      statsByPlayer[stat.player_id].push(stat);
    });

    const globalLayout = await this.getGlobalSettings('default_player_card_layout');

    const playersWithStats = playersData.map(p => {
      const pLayout = p.card_layout || {};
      const hasSpecificLayout = Object.keys(pLayout).length > 0;
      return {
        ...p,
        card_layout: hasSpecificLayout ? pLayout : globalLayout,
        player_stats: statsByPlayer[p.id] || []
      };
    });

    return mapPlayerWithStats(playersWithStats);
  },

  // RPC Functions
  async claimPlayerCard(playerId: string) {
    const { data, error } = await supabase.rpc('claim_player_card', {
      p_player_id: playerId
    });
    if (error) throw error;
    return data;
  },

  async createMatchCheckinWithGPS(fixtureId: string, latitude: number, longitude: number) {
    console.log(`DEBUG: [GPS] Attempting GPS check-in for fixture ${fixtureId} at ${latitude}, ${longitude}`);
    
    const { data, error } = await supabase.rpc('check_in_to_match', {
      p_fixture_id: fixtureId,
      p_user_lat: latitude,
      p_user_lon: longitude
    });
    
    if (error) {
      console.error('DEBUG: [GPS] RPC check_in_to_match failed:', error);
      throw error;
    }

    if (data && data.success === false) {
      throw new Error(data.error || 'Check-in failed');
    }

    return data;
  },

  async getMatchCheckin(fixtureId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('match_checkins')
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (error) {
      console.error('DEBUG: [SERVICE] Error fetching match check-in:', error);
      return null;
    }

    // Check if check-in is still valid
    if (data && new Date(data.expires_at) < new Date()) {
      return null;
    }

    return data;
  },

  async submitPlayerVote(fixtureId: string, playerId: string, vote: 'up' | 'down' | 'neutral') {
    console.log(`DEBUG: [VOTE] Submitting vote for fixture ${fixtureId}, player ${playerId}, vote: ${vote}`);
    
    // 1. Check for completion first (Frontend safety)
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: completion } = await supabase
        .from('fixture_vote_completions')
        .select('fixture_id')
        .eq('fixture_id', fixtureId)
        .eq('user_id', userData.user.id)
        .maybeSingle();
      
      if (completion) {
        console.warn(`DEBUG: [VOTE] Blocked: User ${userData.user.id} already completed voting for ${fixtureId}`);
        throw new Error('Voting already completed for this fixture');
      }
    }

    // Fetch fixture to check voting window
    const { data: fixture, error: fixtureError } = await supabase
      .from('fixtures')
      .select('voting_open_at, voting_close_at')
      .eq('id', fixtureId)
      .single();
    
    if (fixtureError) {
      console.error(`DEBUG: [VOTE] Error fetching fixture ${fixtureId}:`, fixtureError);
      throw fixtureError;
    }
    
    const now = new Date();
    const openAt = fixture.voting_open_at ? new Date(fixture.voting_open_at) : null;
    const closeAt = fixture.voting_close_at ? new Date(fixture.voting_close_at) : null;

    console.log(`DEBUG: [VOTE] Window check - Now: ${now.toISOString()}, Open: ${openAt?.toISOString()}, Close: ${closeAt?.toISOString()}`);

    if (openAt && now < openAt) {
      console.warn(`DEBUG: [VOTE] Voting not yet open for ${fixtureId}`);
      throw new Error('Voting has not started yet.');
    }
    if (closeAt && now > closeAt) {
      console.warn(`DEBUG: [VOTE] Voting already closed for ${fixtureId}`);
      throw new Error('Voting has closed for this match.');
    }

    const { data, error } = await supabase.rpc('submit_player_vote', {
      p_fixture_id: fixtureId,
      p_player_id: playerId,
      p_vote: vote,
      p_bypass_checkin: !appConfig.GPS_VOTING_REQUIRED
    });
    
    if (error) {
      console.error(`DEBUG: [VOTE] RPC submit_player_vote FAILED:`, error);
      // Handle the specific error from our updated RPC
      if (error.message?.includes('already completed')) {
        throw new Error('Voting already completed for this fixture');
      }
      throw error;
    }

    if (data && data.success === false) {
      if (data.error?.includes('already completed')) {
        throw new Error('Voting already completed for this fixture');
      }
      throw new Error(data.error || 'Voting failed');
    }
    
    console.log(`DEBUG: [VOTE] RPC success:`, data);
    return data;
  },

  async checkVoteCompletion(fixtureId: string, userId: string) {
    console.log(`DEBUG: [SERVICE] Checking vote completion for user ${userId} and fixture ${fixtureId}`);
    const { data, error } = await supabase
      .from('fixture_vote_completions')
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.error('DEBUG: [SERVICE] Error checking vote completion:', error);
      return false;
    }
    
    if (data) {
      console.log(`DEBUG: [SERVICE] Vote completion FOUND for user ${userId} and fixture ${fixtureId}:`, data);
    } else {
      console.log(`DEBUG: [SERVICE] No vote completion found for user ${userId} and fixture ${fixtureId}`);
    }
    
    return !!data;
  },

  async markVoteAsCompleted(fixtureId: string, userId: string) {
    console.log(`DEBUG: [SERVICE] Marking vote as completed for user ${userId} and fixture ${fixtureId}`);
    const { data, error } = await supabase
      .from('fixture_vote_completions')
      .upsert({
        fixture_id: fixtureId,
        user_id: userId,
        completed_at: new Date().toISOString()
      }, { 
        onConflict: 'fixture_id,user_id',
        ignoreDuplicates: true 
      })
      .select();
    
    if (error) {
      console.error('DEBUG: [SERVICE] Error marking vote as completed:', error);
      throw error;
    }
    
    console.log(`DEBUG: [SERVICE] Successfully marked vote as completed:`, data);
    return data;
  },

  async getFixtureLineupWithPlayers(fixtureId: string) {
    console.log('DEBUG: [SERVICE] getFixtureLineupWithPlayers started', { fixtureId });
    const { data: lineupData, error: lineupError } = await supabase
      .from('fixture_lineups')
      .select(`
        *,
        players (
          *,
          teams (
            name,
            club_id,
            clubs (
              name,
              logo_url
            )
          )
        ),
        teams (
          name,
          clubs (
            name,
            logo_url
          )
        )
      `)
      .eq('fixture_id', fixtureId);
    
    if (lineupError) {
      console.error('DEBUG: [SERVICE] getFixtureLineupWithPlayers error:', lineupError);
      throw lineupError;
    }
    
    if (lineupData && lineupData.length > 0) {
      console.log(`DEBUG: [SERVICE] Loaded ${lineupData.length} raw lineup entries`);
      
      // STRICT FILTERING: active only
      const isAdmin = await this.isUserAdmin();
      const filteredLineupData = (lineupData || []).filter(entry => {
        const p = entry.players;
        if (!p) return false;
        if (isAdmin) return true;
        return p.is_active === true;
      });

      console.log(`DEBUG: [FILTER] getFixtureLineupWithPlayers: Raw: ${lineupData.length}, Filtered: ${filteredLineupData.length}`);
      
      if (filteredLineupData.length === 0) return [];

      // Fetch stats separately for all players in the filtered lineup
      const playerIds = filteredLineupData.map(e => e.player_id).filter(Boolean);
      const { data: statsData, error: statsError } = await supabase
        .from('player_stats')
        .select('*')
        .in('player_id', playerIds);
      
      if (statsError) {
        console.error('DEBUG: [SERVICE] Error fetching stats separately for lineup:', statsError);
      }

      const statsByPlayer: Record<string, PlayerStats[]> = {};
      statsData?.forEach(stat => {
        if (!statsByPlayer[stat.player_id]) {
          statsByPlayer[stat.player_id] = [];
        }
        statsByPlayer[stat.player_id].push(stat);
      });

      const globalLayout = await this.getGlobalSettings('default_player_card_layout');

      filteredLineupData.forEach(entry => {
        if (entry.players) {
          // Check global layout
          const pLayout = entry.players.card_layout || {};
          const hasSpecificLayout = Object.keys(pLayout).length > 0;
          entry.players.card_layout = hasSpecificLayout ? pLayout : globalLayout;

          // Manually merge stats
          entry.players.player_stats = statsByPlayer[entry.player_id] || [];
          entry.players = mapPlayerWithStats(entry.players);
          console.log(`DEBUG: [SERVICE] Lineup Player ${entry.players.full_name} latest stats:`, entry.players.current_stats, `Rows: ${entry.players.player_stats.length}`);
        }
      });
      return filteredLineupData as any[];
    }
    return [];
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

  async getUserTeamIdForFixture(fixtureId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const profile = await this.getProfile(user.id);
    if (!profile) return null;

    console.log(`DEBUG: [V1-SERVICE] Detecting team for user ${user.id} in fixture ${fixtureId}`);

    if (profile.role === 'player') {
      // First, check if this user has a claimed player
      const { data: player } = await supabase
        .from('players')
        .select('id, team_id')
        .eq('claimed_by_user_id', user.id)
        .maybeSingle();
      
      if (player) {
        console.log(`DEBUG: [V1-SERVICE] User is a player (ID: ${player.id}, Default Team: ${player.team_id})`);
        
        // Check if they are in the lineup for this specific fixture
        const { data: lineupEntry } = await supabase
          .from('fixture_lineups')
          .select('team_id')
          .eq('fixture_id', fixtureId)
          .eq('player_id', player.id)
          .maybeSingle();
        
        if (lineupEntry) {
          console.log(`DEBUG: [V1-SERVICE] Player found in fixture lineup. Using team_id: ${lineupEntry.team_id}`);
          return lineupEntry.team_id;
        }

        // Fallback: Check if their default team is one of the teams in the fixture
        const { data: fixture } = await supabase
          .from('fixtures')
          .select('home_team_id, away_team_id')
          .eq('id', fixtureId)
          .single();
        
        if (fixture) {
          if (player.team_id === fixture.home_team_id) {
            console.log(`DEBUG: [V1-SERVICE] Player not in lineup, but default team matches Home Team: ${fixture.home_team_id}`);
            return fixture.home_team_id;
          }
          if (player.team_id === fixture.away_team_id) {
            console.log(`DEBUG: [V1-SERVICE] Player not in lineup, but default team matches Away Team: ${fixture.away_team_id}`);
            return fixture.away_team_id;
          }
        }
        console.log(`DEBUG: [V1-SERVICE] Player team ${player.team_id} does not match either team in fixture ${fixtureId}`);
      } else {
        console.log(`DEBUG: [V1-SERVICE] User has player role but no claimed player record found.`);
      }
    }

    if (profile.role === 'fan' && profile.favorite_club_id) {
      console.log(`DEBUG: [V1-SERVICE] User is a fan with favorite club: ${profile.favorite_club_id}`);
      const { data: fixture } = await supabase
        .from('fixtures')
        .select('home_team_id, away_team_id, home_team:teams!home_team_id(club_id), away_team:teams!away_team_id(club_id)')
        .eq('id', fixtureId)
        .single();
      
      if (!fixture) return null;

      if ((fixture.home_team as any)?.club_id === profile.favorite_club_id) {
        console.log(`DEBUG: [V1-SERVICE] Fan favorite club matches Home Team club. Using team_id: ${fixture.home_team_id}`);
        return fixture.home_team_id;
      }
      if ((fixture.away_team as any)?.club_id === profile.favorite_club_id) {
        console.log(`DEBUG: [V1-SERVICE] Fan favorite club matches Away Team club. Using team_id: ${fixture.away_team_id}`);
        return fixture.away_team_id;
      }
      console.log(`DEBUG: [V1-SERVICE] Fan favorite club ${profile.favorite_club_id} is not playing in this fixture.`);
    }

    return null;
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
    console.log(`DEBUG: [SERVICE] Starting manual rating processing for fixture: ${fixtureId}`);
    await this.checkAdmin(fixtureId);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Authentication required');

    try {
      console.log(`DEBUG: [SERVICE] Invoking edge function 'match-processor'...`);
      const { data, error: invokeError } = await supabase.functions.invoke('match-processor', {
        body: { 
          fixtureId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (invokeError) {
        console.error(`DEBUG: [SERVICE] Edge function invocation error:`, invokeError);
        throw new Error(invokeError.message || 'Failed to invoke match processor');
      }

      const result = data?.backendResult ?? data;

      if (!result) {
        console.warn(`DEBUG: [SERVICE] Edge function returned no data (null) but no error.`);
        return { success: false, message: 'No response from processor' };
      }

      console.log(`DEBUG: [SERVICE] Raw response from edge function/backendResult:`, result);

      if (result.success === false) {
        console.error(`DEBUG: [SERVICE] Edge function returned success: false`, result);
        let errorMessage = result.error || 'Failed to process ratings';
        if (result.details) {
            errorMessage += ` - Details: ${typeof result.details === 'string' ? result.details : JSON.stringify(result.details).substring(0, 300)}`;
        }
        throw new Error(errorMessage);
      }

      return result;
    } catch (error: any) {
      console.error(`DEBUG: [SERVICE] Critical Network or Execution Error processing ratings:`, error);
      throw error;
    }
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

  async getFixtureRatingHistory(fixtureId: string) {
    const { data: historyData, error: historyError } = await supabase
      .from('player_rating_history')
      .select('*, players(*, teams(name, clubs(logo_url)))')
      .eq('fixture_id', fixtureId)
      .order('delta_overall', { ascending: false })
      .order('new_overall', { ascending: false });
    
    if (historyError) throw historyError;

    if (!historyData || historyData.length === 0) return [];

    // Fetch stats separately for all players in the history
    const playerIds = historyData.map(h => h.player_id);
    const { data: statsData, error: statsError } = await supabase
      .from('player_stats')
      .select('*')
      .in('player_id', playerIds);
    
    if (statsError) {
      console.error('DEBUG: [SERVICE] Error fetching stats for history:', statsError);
    }

    const statsByPlayer: Record<string, PlayerStats[]> = {};
    statsData?.forEach(stat => {
      if (!statsByPlayer[stat.player_id]) {
        statsByPlayer[stat.player_id] = [];
      }
      statsByPlayer[stat.player_id].push(stat);
    });

    const globalLayout = await this.getGlobalSettings('default_player_card_layout');

    const results = historyData.map(h => {
      if (h.players) {
        const pLayout = h.players.card_layout || {};
        const hasSpecificLayout = Object.keys(pLayout).length > 0;
        h.players.card_layout = hasSpecificLayout ? pLayout : globalLayout;

        h.players.player_stats = statsByPlayer[h.player_id] || [];
        h.players = mapPlayerWithStats(h.players);
      }
      return h;
    });

    return results as any[];
  },

  // Queries
  async getLeagues() {
    const visibility = await this.getUserVisibilityContext();
    let query = supabase.from('leagues').select('*').order('name');
    
    if (!visibility.isMainAdmin && visibility.onboarding_completed) {
      if (visibility.leagueIds.length > 0) {
        query = query.in('id', visibility.leagueIds);
      } else {
        return [];
      }
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data as League[];
  },

  async getClubs(leagueId?: string) {
    const visibility = await this.getUserVisibilityContext();

    if (leagueId && !visibility.isMainAdmin && visibility.onboarding_completed && !visibility.leagueIds.includes(leagueId)) {
      console.warn(`DEBUG: [SECURITY] User attempted to fetch clubs for unauthorized league: ${leagueId}`);
      return [];
    }

    let query = supabase.from('clubs').select('*, leagues(name)').order('name');
    
    if (leagueId) {
      query = query.eq('league_id', leagueId);
    } else if (!visibility.isMainAdmin && visibility.onboarding_completed) {
      if (visibility.leagueIds.length > 0) {
        query = query.in('league_id', visibility.leagueIds);
      } else {
        return [];
      }
    }
    
    const { data, error } = await query;
    if (error) throw error;

    return data as Club[];
  },

  async getTeams(clubId?: string, leagueId?: string) {
    const visibility = await this.getUserVisibilityContext();

    if (leagueId && !visibility.isMainAdmin && visibility.onboarding_completed && !visibility.leagueIds.includes(leagueId)) {
      console.warn(`DEBUG: [SECURITY] User attempted to fetch teams for unauthorized league: ${leagueId}`);
      return [];
    }

    let query = supabase.from('teams').select('*, clubs!inner(name, logo_url, league_id)').order('name');
    
    if (clubId) query = query.eq('club_id', clubId);
    
    if (leagueId) {
      query = query.eq('clubs.league_id', leagueId);
    } else if (!visibility.isMainAdmin && visibility.onboarding_completed) {
      if (visibility.leagueIds.length > 0) {
        query = query.in('clubs.league_id', visibility.leagueIds);
      } else {
        return [];
      }
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data as Team[];
  },

  async getPlayers(teamId?: string, leagueId?: string) {
    console.log('DEBUG: [SERVICE] getPlayers started', { teamId, leagueId });
    const visibility = await this.getUserVisibilityContext();
    
    // Security check: restrict explicitly requested league
    if (leagueId && !visibility.isMainAdmin && visibility.onboarding_completed && !visibility.leagueIds.includes(leagueId)) {
      console.warn(`DEBUG: [SECURITY] User attempted to fetch players for unauthorized league: ${leagueId}`);
      return []; // Early exit
    }

    // 1. Fetch players
    let playersQuery = supabase
      .from('players')
      .select('*, teams!inner(name, club_id, clubs!inner(name, logo_url, league_id))')
      .order('full_name');
    
    if (teamId) playersQuery = playersQuery.eq('team_id', teamId);
    if (leagueId) {
      playersQuery = playersQuery.eq('teams.clubs.league_id', leagueId);
    } else if (!visibility.isMainAdmin && visibility.onboarding_completed) {
      if (visibility.leagueIds.length > 0) {
        playersQuery = playersQuery.in('teams.clubs.league_id', visibility.leagueIds);
      } else {
        return []; // Non-admin with no leagues sees no players
      }
    }
    
    const { data: rawPlayersData, error: playersError } = await playersQuery;
    
    if (playersError) {
      console.error('DEBUG: [SERVICE] getPlayers error:', playersError);
      throw playersError;
    }

    if (!rawPlayersData || rawPlayersData.length === 0) return [];

    // Apply strict filters: active only AND exclude Gerersdorf (unless Admin)
    const playersData = rawPlayersData.filter(p => {
      if (visibility.isMainAdmin) return true;
      const isActive = p.is_active === true;
      const isGerersdorf = p.teams?.clubs?.name?.includes('Gerersdorf');
      return isActive && !isGerersdorf;
    });

    console.log(`DEBUG: [FILTER] getPlayers: Total loaded: ${rawPlayersData.length}, Selected: ${playersData.length}`);

    // 2. Fetch all stats for these players separately to ensure they are loaded
    const playerIds = playersData.map(p => p.id);
    console.log(`DEBUG: [SERVICE] Fetching stats for ${playerIds.length} players:`, playerIds);

    // DEBUG: Check if we can fetch ANY stats at all to diagnose RLS
    const { data: anyStats, error: anyStatsError } = await supabase
      .from('player_stats')
      .select('*')
      .limit(5);
    
    console.log(`DEBUG: [SERVICE] RLS Check - Can fetch any stats? Count: ${anyStats?.length || 0}, Error:`, anyStatsError);

    const { data: statsData, error: statsError } = await supabase
      .from('player_stats')
      .select('*')
      .in('player_id', playerIds);

    if (statsError) {
      console.error('DEBUG: [SERVICE] Error fetching stats separately:', statsError);
    }

    console.log(`DEBUG: [SERVICE] Stats rows found for these players: ${statsData?.length || 0}`);

    // 3. Group stats by player_id
    const statsByPlayer: Record<string, PlayerStats[]> = {};
    statsData?.forEach(stat => {
      if (!statsByPlayer[stat.player_id]) {
        statsByPlayer[stat.player_id] = [];
      }
      statsByPlayer[stat.player_id].push(stat);
    });

    // 4. Fetch global default layout
    const globalLayout = await this.getGlobalSettings('default_player_card_layout');

    // 5. Merge stats into players manually and inject global layout if missing
    const playersWithStats = playersData.map(p => {
      const pLayout = p.card_layout || {};
      const hasSpecificLayout = Object.keys(pLayout).length > 0;
      
      return {
        ...p,
        card_layout: hasSpecificLayout ? pLayout : globalLayout,
        player_stats: statsByPlayer[p.id] || []
      };
    });

    // 6. Map with current_stats
    const mapped = mapPlayerWithStats(playersWithStats);
    
    mapped.forEach(p => {
      if (p.player_stats.length === 0) {
        console.warn(`DEBUG: [SERVICE] Player ${p.full_name} (${p.id}) has 0 stats rows!`);
      } else {
        console.log(`DEBUG: [SERVICE] Player ${p.full_name} resolved stats:`, p.current_stats, `Rows: ${p.player_stats.length}`);
      }
    });

    return mapped;
  },

  async getTopPlayers(limit: number = 6) {
    console.log('DEBUG: [SERVICE] getTopPlayers started', { limit });
    
    try {
      // Fetch all players with their stats to ensure we have the latest for everyone
      // This is the most reliable way to ensure consistency across the app
      const allPlayers = await this.getPlayers();
      
      const sorted = allPlayers
        .sort((a, b) => (b.current_stats?.overall || 0) - (a.current_stats?.overall || 0))
        .slice(0, limit);
        
      console.log(`DEBUG: [SERVICE] getTopPlayers returning ${sorted.length} unique top players`);
      return sorted as (Player & { teams: { name: string, clubs: { logo_url: string } }, player_stats: PlayerStats[], current_stats: PlayerStats })[];
    } catch (err) {
      console.error('DEBUG: [SERVICE] Unexpected error in getTopPlayers:', err);
      return [];
    }
  },

  async getPlayerById(id: string) {
    console.log('DEBUG: [SERVICE] getPlayerById started', { id });
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('*, teams(name, club_id, clubs(name, logo_url, league_id))')
      .eq('id', id)
      .single();
    
    if (playerError) {
      console.error('DEBUG: [SERVICE] getPlayerById error:', playerError);
      throw playerError;
    }

    if (playerData) {
      // Fetch stats separately for the player
      const { data: statsData, error: statsError } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_id', id);
      
      if (statsError) {
        console.error('DEBUG: [SERVICE] Error fetching stats for single player:', statsError);
      }

      // Fetch global default layout
      const globalLayout = await this.getGlobalSettings('default_player_card_layout');
      const pLayout = playerData.card_layout || {};
      const hasSpecificLayout = Object.keys(pLayout).length > 0;

      const playerWithStats = {
        ...playerData,
        card_layout: hasSpecificLayout ? pLayout : globalLayout,
        player_stats: statsData || []
      };

      const mapped = mapPlayerWithStats(playerWithStats);
      
      // STRICT FILTERING: Check if active and matches visibility logic
      const visibility = await this.getUserVisibilityContext();

      if (!visibility.isMainAdmin) {
        if (!mapped.is_active) {
          console.log(`DEBUG: [FILTER] getPlayerById: Player ${mapped.full_name} is INACTIVE. Excluding.`);
          return null;
        }

        const involvesGerersdorf = mapped.teams?.clubs?.name?.includes('Gerersdorf');
        if (involvesGerersdorf) {
          return null;
        }

        // Check if player's league is in user's leagueIds
        const playerLeagueId = (mapped.teams as any)?.clubs?.league_id;
        if (playerLeagueId && visibility.onboarding_completed && !visibility.leagueIds.includes(playerLeagueId)) {
          console.warn(`DEBUG: [SECURITY] Refusing to serve player outside allowed leagues`);
          return null;
        }
      }

      console.log(`DEBUG: [SERVICE] Player ${mapped.full_name} resolved stats:`, mapped.current_stats, `Rows: ${mapped.player_stats.length}`);
      return mapped;
    }

    return null;
  },

  async getFixtures(leagueId?: string) {
    // Fetch session for filtering
    const visibility = await this.getUserVisibilityContext();

    if (leagueId && !visibility.isMainAdmin && visibility.onboarding_completed && !visibility.leagueIds.includes(leagueId)) {
      console.warn(`DEBUG: [SECURITY] User attempted to fetch fixtures for unauthorized league: ${leagueId}`);
      return [];
    }

    let query = supabase
      .from('fixtures')
      .select('*, home_team:teams!home_team_id(name, club_id, clubs(name, logo_url)), away_team:teams!away_team_id(name, club_id, clubs(name, logo_url)), leagues(name), fixture_lineups(count), match_events(*)')
      .order('kickoff_at', { ascending: false });
      
    if (leagueId) {
      query = query.eq('league_id', leagueId);
    } else if (!visibility.isMainAdmin && visibility.onboarding_completed) {
      if (visibility.leagueIds.length > 0) {
        query = query.in('league_id', visibility.leagueIds);
      } else {
        return [];
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    
    // Filter out Gerersdorf fixtures for normal users
    const filteredData = (data || []).filter(f => {
      if (visibility.isMainAdmin) return true;
      const homeClub = f.home_team?.clubs?.name;
      const awayClub = f.away_team?.clubs?.name;
      const involvesGerersdorf = homeClub?.includes('Gerersdorf') || awayClub?.includes('Gerersdorf');
      return !involvesGerersdorf;
    });

    console.log(`DEBUG: [FILTER] getFixtures: Total loaded: ${data?.length || 0}, Filtered: ${filteredData.length}`);

    // Map the count from fixture_lineups
    const mappedData = filteredData.map(f => {
      let lineup_count = f.fixture_lineups?.[0]?.count || 0;
      if (!visibility.isMainAdmin) {
         const isStarted = f.status === 'live' || (f.kickoff_at && new Date(f.kickoff_at) <= new Date());
         if (!isStarted) {
             lineup_count = 0;
         }
      }
      return {
        ...f,
        lineup_count
      };
    });
    
    return mappedData as any[];
  },

  async getOpenVotingFixtures(leagueId?: string) {
    const visibility = await this.getUserVisibilityContext();
    const now = new Date().toISOString();
    console.log(`DEBUG: [SERVICE] getOpenVotingFixtures started at ${now}`);

    if (leagueId && !visibility.isMainAdmin && visibility.onboarding_completed && !visibility.leagueIds.includes(leagueId)) {
      console.warn(`DEBUG: [SECURITY] User attempted to fetch open voting fixtures for unauthorized league: ${leagueId}`);
      return [];
    }

    // 1. Fetch candidate fixtures
    let query = supabase
      .from('fixtures')
      .select('*, home_team:teams!home_team_id(name, club_id, clubs(name, logo_url)), away_team:teams!away_team_id(name, club_id, clubs(name, logo_url)), leagues(name), match_events(*)')
      .eq('status', 'finished')
      .is('results_processed_at', null)
      .not('voting_close_at', 'is', null)
      .gt('voting_close_at', now)
      .order('kickoff_at', { ascending: false });

    if (leagueId) {
      query = query.eq('league_id', leagueId);
    } else if (!visibility.isMainAdmin && visibility.onboarding_completed) {
      if (visibility.leagueIds.length > 0) {
        query = query.in('league_id', visibility.leagueIds);
      } else {
        return [];
      }
    }
    
    const { data: fixtures, error: fixturesError } = await query;

    if (fixturesError) {
      console.error('DEBUG: [SERVICE] Error fetching candidate fixtures:', fixturesError);
      throw fixturesError;
    }

    // No restrictive filtering for finished fixtures
    const filteredFixtures = (fixtures || []);
/*
    const isAdmin = await this.isUserAdmin();
    const filteredFixtures = (fixtures || []).filter(f => {
      if (isAdmin) return true;
      const homeClub = f.home_team?.clubs?.name;
      const awayClub = f.away_team?.clubs?.name;
      const involvesGerersdorf = homeClub?.includes('Gerersdorf') || awayClub?.includes('Gerersdorf');
      return !involvesGerersdorf;
    });
*/

    console.log(`DEBUG: [FILTER] getOpenVotingFixtures: Total candidate raw: ${fixtures?.length || 0}, Filtered: ${filteredFixtures.length}`);
    if (filteredFixtures.length === 0) return [];

    // 2. Verify lineup existence
    const fixtureIds = filteredFixtures.map(f => f.id);
    const { data: lineups, error: lineupsError } = await supabase
      .from('fixture_lineups')
      .select('fixture_id')
      .in('fixture_id', fixtureIds);

    if (lineupsError) throw lineupsError;

    const lineupFixtureIds = new Set(lineups?.map(l => l.fixture_id) || []);
    
    return filteredFixtures.filter(f => lineupFixtureIds.has(f.id)) as any[];
  },

  async deactivateGerersdorfPlayers() {
    console.log('DEBUG: [SERVICE] deactivateGerersdorfPlayers started');
    try {
      const clubs = await this.getClubs();
      const gerersdorf = clubs.find(c => c.name.includes('Gerersdorf'));
      
      if (!gerersdorf) {
        console.log('DEBUG: [SERVICE] FCU Gerersdorf not found in clubs.');
        return { success: false, message: 'Club not found' };
      }

      console.log('DEBUG: [SERVICE] Found Gerersdorf ID:', gerersdorf.id);
      
      const teams = await this.getTeams(gerersdorf.id);
      const teamIds = teams.map(t => t.id);
      
      if (teamIds.length === 0) {
        console.log('DEBUG: [SERVICE] No teams found for Gerersdorf.');
        return { success: true, message: 'No teams to update' };
      }

      const { error } = await supabase
        .from('players')
        .update({ is_active: false })
        .in('team_id', teamIds);

      if (error) throw error;
      console.log('DEBUG: [SERVICE] Successfully marked Gerersdorf players as inactive.');
      
      return { success: true, clubId: gerersdorf.id };
    } catch (err) {
      console.error('DEBUG: [SERVICE] Error in deactivateGerersdorfPlayers:', err);
      throw err;
    }
  },

  async getFixtureById(id: string) {
    console.log('supabaseService: getFixtureById called with id:', id);
    const { data, error } = await supabase
      .from('fixtures')
      .select('*, home_team:teams!home_team_id(name, club_id, clubs(name, logo_url, latitude, longitude, radius_meters, pitch_name)), away_team:teams!away_team_id(name, club_id, clubs(name, logo_url)), leagues(name), match_events(*)')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('supabaseService: getFixtureById error:', error);
      throw error;
    }
    
    if (data) {
      return data;
    }

    console.log('supabaseService: getFixtureById success:', data?.id);
    return data as Fixture;
  },

  async getFixtureStats(fixtureId: string) {
    const { count: checkinsCount, error: checkinsError } = await supabase
      .from('match_checkins')
      .select('*', { count: 'exact', head: true })
      .eq('fixture_id', fixtureId);
    
    if (checkinsError) throw checkinsError;

    const { count: votesCount, error: votesError } = await supabase
      .from('player_votes')
      .select('*', { count: 'exact', head: true })
      .eq('fixture_id', fixtureId);
    
    if (votesError) throw votesError;

    return {
      checkins: checkinsCount || 0,
      votes: votesCount || 0
    };
  },

  async getPlayersByClubs(clubIds: string[]) {
    console.log('DEBUG: [SERVICE] getPlayersByClubs started', { clubIds });
    // We use !inner to ensure we only get players who belong to a team that belongs to one of the clubs
    // Note: Filtering on joined tables in PostgREST requires the !inner hint and the correct path
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*, teams!inner(name, club_id, clubs(name))')
      .filter('teams.club_id', 'in', `(${clubIds.join(',')})`)
      .order('full_name');
    
    if (playersError) throw playersError;
    
    if (!playersData || playersData.length === 0) return [];

    const playerIds = playersData.map(p => p.id);
    const { data: statsData, error: statsError } = await supabase
      .from('player_stats')
      .select('*')
      .in('player_id', playerIds);

    if (statsError) {
      console.error('DEBUG: [SERVICE] Error fetching stats for clubs:', statsError);
    }

    const statsByPlayer: Record<string, PlayerStats[]> = {};
    statsData?.forEach(stat => {
      if (!statsByPlayer[stat.player_id]) {
        statsByPlayer[stat.player_id] = [];
      }
      statsByPlayer[stat.player_id].push(stat);
    });

    const playersWithStats = playersData.map(p => ({
      ...p,
      player_stats: statsByPlayer[p.id] || []
    }));

    return mapPlayerWithStats(playersWithStats);
  },

  async getUserCheckins(userId: string) {
    const nowIso = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('match_checkins')
      .select('fixture_id')
      .eq('user_id', userId)
      .gt('expires_at', nowIso);
      
    if (error) {
      console.error(`DEBUG: [SERVICE] Error in getUserCheckins:`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
    }
    
    return { data, error };
  },

  async sendNotification(userId: string, title: string, message: string, data?: any) {
    console.log(`[NOTIFICATION] To: ${userId}, Title: ${title}, Message: ${message}`, data);
    
    // Attempt to save to a notifications table if it exists
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          data,
          read: false,
          created_at: new Date().toISOString()
        });
      
      if (error) {
        if (error.code === '42P01') {
          console.log('[NOTIFICATION] Table "notifications" does not exist, skipping database insert.');
        } else {
          console.error('[NOTIFICATION] Error saving notification:', error);
        }
      }
    } catch (err) {
      console.error('[NOTIFICATION] Unexpected error:', err);
    }
  },

  async notifyAllFans(title: string, message: string, data?: any) {
    console.log(`[NOTIFICATION] To ALL FANS, Title: ${title}, Message: ${message}`, data);
    
    try {
      // Get all fan profiles
      const { data: fans, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'fan');
      
      if (fetchError) throw fetchError;
      
      if (fans && fans.length > 0) {
        const notifications = fans.map(fan => ({
          user_id: fan.id,
          title,
          message,
          data,
          read: false,
          created_at: new Date().toISOString()
        }));
        
        const { error: insertError } = await supabase
          .from('notifications')
          .insert(notifications);
          
        if (insertError && insertError.code !== '42P01') {
          console.error('[NOTIFICATION] Error saving bulk notifications:', insertError);
        }
      }
    } catch (err) {
      console.error('[NOTIFICATION] Unexpected error in notifyAllFans:', err);
    }
  },

  async getPlayerRatingHistory(playerId: string) {
    const { data, error } = await supabase
      .from('player_rating_history')
      .select('*, fixtures(kickoff_at, home_team:home_team_id(name, clubs(name)), away_team:away_team_id(name, clubs(name)))')
      .eq('player_id', playerId)
      .order('processed_at', { ascending: false });
    if (error) throw error;
    return data as (PlayerRatingHistory & { 
      fixtures: { 
        kickoff_at: string, 
        home_team: { name: string, clubs: { name: string } }, 
        away_team: { name: string, clubs: { name: string } } 
      } 
    })[];
  },

  async savePushToken(token: string, platform: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[PUSH] session user id', session?.user?.id);

      const userId = session?.user?.id;
      if (!userId) {
        console.error('[PUSH] No user ID in session');
        return { error: 'No session' };
      }

      console.log('[PUSH] saving token payload', {
        userId,
        platform,
        tokenStart: token.slice(0, 30)
      });

      const { data, error } = await supabase
        .from('push_tokens')
        .upsert(
          { 
            user_id: userId, 
            token, 
            platform,
            updated_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString() 
          },
          { onConflict: 'user_id,platform' }
        )
        .select();

      console.log('[PUSH] save result', { data, error });

      if (error) {
        console.error('DEBUG: [SERVICE] savePushToken error:', error);
      } else {
        console.log('DEBUG: [SERVICE] savePushToken success');
      }
      return { data, error };
    } catch (err: any) {
      console.error('DEBUG: [SERVICE] savePushToken unexpected error:', err);
      return { error: err };
    }
  },

  async startMatch(id: string) {
    const nowIso = new Date().toISOString();
    const { error } = await supabase.rpc('start_match', { p_fixture_id: id });
    if (error) {
      return this.updateFixture(id, { 
        status: 'live',
        match_phase: 'first_half', 
        first_half_started_at: nowIso 
      });
    }
  },

  async startHalftime(id: string) {
    const nowIso = new Date().toISOString();
    const { error } = await supabase.rpc('start_halftime', { p_fixture_id: id });
    if (error) {
      return this.updateFixture(id, { 
        status: 'live',
        match_phase: 'halftime', 
        halftime_started_at: nowIso 
      });
    }
  },

  async startSecondHalf(id: string) {
    const nowIso = new Date().toISOString();
    const { error } = await supabase.rpc('start_second_half', { p_fixture_id: id });
    if (error) {
      return this.updateFixture(id, { 
        status: 'live',
        match_phase: 'second_half', 
        second_half_started_at: nowIso 
      });
    }
  },

  async finishMatch(id: string) {
    const nowIso = new Date().toISOString();
    const { error } = await supabase.rpc('finish_match', { p_fixture_id: id });
    if (error) {
      return this.updateFixture(id, { 
        status: 'finished',
        match_phase: 'finished', 
        finished_at: nowIso 
      });
    }
  },

  async addMatchEvent(event: Partial<MatchEvent>) {
    return this.createMatchEvent(event);
  }
};
