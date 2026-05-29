import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { supabaseAdmin } from "./src/lib/supabaseAdmin.ts";

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // Intercept JSON parsing errors to always return JSON
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      console.error("Express JSON parsing error:", err.message);
      return res.status(400).json({ success: false, error: "Invalid JSON payload" });
    }
    next();
  });
  
  const PORT = 3000;

  app.use((req, res, next) => {
    console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      success: true, 
      server: "plyrz-backend-running",
      message: "Supabase migration in progress",
      env: {
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? 'Present' : 'Missing',
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? `Present (Length: ${process.env.SUPABASE_SERVICE_ROLE_KEY.length}, Starts with: ${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10)}...)` : 'Missing',
        NODE_ENV: process.env.NODE_ENV
      }
    });
  });

  // Server-side fallback leagues definition to use if DB queries fail
  const FALLBACK_LEAGUES = [
    { id: '340514f7-1a67-4b8a-a40c-5969ac68d2fb', name: '1. Klasse West/Mitte', is_active: true, created_at: '', updated_at: '' },
    { id: '97ab9fcb-31bb-4872-b944-78d3224e5409', name: '2. Klasse Donau', is_active: true, created_at: '', updated_at: '' }
  ];

  // Helper to validate UUID formats to prevent Postgres syntax exceptions
  const isValidUUID = (val: any): boolean => {
    if (typeof val !== 'string') return false;
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(val);
  };

  // Proxy endpoints to bypass remote RLS/table grant issues on read operations
  app.get("/api/proxy/leagues", async (req, res) => {
    try {
      console.log("[PROXY] Fetching leagues...");
      const { data, error } = await supabaseAdmin.from('leagues').select('*').order('name');
      if (error) {
        console.warn("[PROXY] Error fetching leagues, using server fallback leagues:", error);
        return res.json(FALLBACK_LEAGUES);
      }
      res.json(data);
    } catch (e: any) {
      console.warn("[PROXY] Exception fetching leagues, using server fallback leagues:", e);
      res.json(FALLBACK_LEAGUES);
    }
  });

  // Securely resolve user visibility, roles, registration & onboarding context on the server using admin privs
  app.get("/api/proxy/user-context", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string' || !isValidUUID(userId)) {
        return res.status(400).json({ error: "Valid userId parameter is required" });
      }

      console.log("[PROXY] Resolving user context for:", userId);

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error("[PROXY] Error fetching user profile:", profileError);
        return res.status(500).json({ error: profileError.message });
      }

      // If no profile exists yet, return default fan context
      if (!profile) {
        return res.json({
          isMainAdmin: false,
          leagueIds: FALLBACK_LEAGUES.map(l => l.id),
          clubIds: [],
          onboarding_completed: false,
          favorite_club_id: null,
          selected_league_id: null,
          role: 'fan'
        });
      }

      const isMainAdmin = profile.role === 'admin' || (profile.email && profile.email.toLowerCase() === "matthias.insidiom@gmail.com");

      if (isMainAdmin) {
        return res.json({
          isMainAdmin: true,
          leagueIds: [],
          clubIds: [],
          onboarding_completed: true,
          favorite_club_id: null,
          selected_league_id: null,
          role: profile.role || 'admin',
          profile
        });
      }

      const leagueIds = new Set<string>();
      const clubIds = new Set<string>();

      if (profile.selected_league_id && profile.selected_league_id !== "null" && profile.selected_league_id !== "undefined") {
        leagueIds.add(profile.selected_league_id);
      }
      if (profile.favorite_club_id && profile.favorite_club_id !== "null" && profile.favorite_club_id !== "undefined") {
        clubIds.add(profile.favorite_club_id);
      }

      // If they are a player, resolve claimed player's club and league using admin privileges
      if (profile.role === 'player') {
        const { data: claimedPlayer, error: claimedError } = await supabaseAdmin
          .from('players')
          .select('id, team_id, teams(club_id, clubs(league_id))')
          .eq('claimed_by_user_id', userId)
          .maybeSingle();

        if (!claimedError && claimedPlayer?.teams) {
          const teamsData: any = claimedPlayer.teams;
          if (teamsData.club_id) clubIds.add(teamsData.club_id);
          if (teamsData.clubs?.league_id) leagueIds.add(teamsData.clubs.league_id);
        }
      }

      // Fetch club admin access entries
      const { data: clubAdmins } = await supabaseAdmin
        .from('club_admins')
        .select('club_id, clubs(league_id)')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (clubAdmins) {
        clubAdmins.forEach(ca => {
          if (ca.club_id) clubIds.add(ca.club_id);
          if ((ca.clubs as any)?.league_id) leagueIds.add((ca.clubs as any).league_id);
        });
      }

      // Failsafe fallback if no leagues could be resolved
      if (leagueIds.size === 0) {
        console.log(`[PROXY] No leagues resolved for user ${userId}, applying fallbacks.`);
        FALLBACK_LEAGUES.forEach(l => {
          if (l.is_active) leagueIds.add(l.id);
        });
      }

      res.json({
        isMainAdmin: false,
        leagueIds: Array.from(leagueIds),
        clubIds: Array.from(clubIds),
        onboarding_completed: profile.onboarding_completed || false,
        favorite_club_id: profile.favorite_club_id || null,
        selected_league_id: profile.selected_league_id || null,
        role: profile.role || 'fan',
        profile
      });
    } catch (e: any) {
      console.error("[PROXY] Exception in user-context:", e);
      res.status(500).json({ error: e.message || "Unknown error" });
    }
  });

  app.get("/api/proxy/clubs", async (req, res) => {
    try {
      const { league_id } = req.query;
      console.log("[PROXY] Fetching clubs, league_id:", league_id);
      let query = supabaseAdmin.from('clubs').select('*').order('name');
      if (league_id && league_id !== "null" && league_id !== "undefined" && isValidUUID(league_id)) {
        query = query.eq('league_id', league_id as string);
      }
      const { data, error } = await query;
      if (error) {
        console.error("[PROXY] Error fetching clubs:", error);
        return res.status(500).json({ error: error.message });
      }
      res.json(data);
    } catch (e: any) {
      console.error("[PROXY] Exception fetching clubs:", e);
      res.status(500).json({ error: e.message || "Unknown error" });
    }
  });

  app.get("/api/proxy/teams", async (req, res) => {
    try {
      const { club_id, league_id } = req.query;
      console.log("[PROXY] Fetching teams, club_id:", club_id, "league_id:", league_id);
      let query = supabaseAdmin.from('teams').select('*, clubs!inner(name, logo_url, league_id)').order('name');
      if (club_id && club_id !== "null" && club_id !== "undefined" && isValidUUID(club_id)) {
        query = query.eq('club_id', club_id as string);
      }
      if (league_id && league_id !== "null" && league_id !== "undefined" && isValidUUID(league_id)) {
        query = query.eq('clubs.league_id', league_id as string);
      }
      const { data, error } = await query;
      if (error) {
        console.error("[PROXY] Error fetching teams:", error);
        return res.status(500).json({ error: error.message });
      }
      res.json(data);
    } catch (e: any) {
      console.error("[PROXY] Exception fetching teams:", e);
      res.status(500).json({ error: e.message || "Unknown error" });
    }
  });

  app.get("/api/proxy/players", async (req, res) => {
    try {
      const { team_id, league_id } = req.query;
      console.log("[PROXY] Fetching players, team_id:", team_id, "league_id:", league_id);
      let playersQuery = supabaseAdmin
        .from('players')
        .select('*, teams!inner(name, club_id, clubs!inner(name, logo_url, league_id))')
        .order('full_name');
        
      if (team_id && team_id !== "null" && team_id !== "undefined" && isValidUUID(team_id)) {
        playersQuery = playersQuery.eq('team_id', team_id as string);
      }
      if (league_id && league_id !== "null" && league_id !== "undefined" && isValidUUID(league_id)) {
        playersQuery = playersQuery.eq('teams.clubs.league_id', league_id as string);
      }
      
      const { data: rawPlayersData, error: playersError } = await playersQuery;
      if (playersError) {
        console.error("[PROXY] Error fetching players:", playersError);
        return res.status(500).json({ error: playersError.message });
      }
      
      if (!rawPlayersData || rawPlayersData.length === 0) {
        return res.json([]);
      }
      
      // Fetch stats for these players separately
      const playerIds = rawPlayersData.map(p => p.id);
      const { data: statsData, error: statsError } = await supabaseAdmin
        .from('player_stats')
        .select('*')
        .in('player_id', playerIds);
        
      if (statsError) {
        console.error("[PROXY] Error fetching player stats:", statsError);
      }
      
      const statsByPlayer: Record<string, any[]> = {};
      statsData?.forEach(stat => {
        if (!statsByPlayer[stat.player_id]) {
          statsByPlayer[stat.player_id] = [];
        }
        statsByPlayer[stat.player_id].push(stat);
      });
      
      const playersWithStats = rawPlayersData.map(p => ({
        ...p,
        player_stats: statsByPlayer[p.id] || []
      }));
      
      res.json(playersWithStats);
    } catch (e: any) {
      console.error("[PROXY] Exception fetching players:", e);
      res.status(500).json({ error: e.message || "Unknown error" });
    }
  });

  app.get("/api/proxy/fixtures", async (req, res) => {
    try {
      const { league_id } = req.query;
      console.log("[PROXY] Fetching fixtures, league_id:", league_id);
      let query = supabaseAdmin
        .from('fixtures')
        .select('*, home_team:teams!home_team_id(name, club_id, clubs(name, logo_url)), away_team:teams!away_team_id(name, club_id, clubs(name, logo_url)), fixture_lineups(count), match_events(*)')
        .order('kickoff_at', { ascending: false });
        
      if (league_id && league_id !== "null" && league_id !== "undefined" && isValidUUID(league_id)) {
        query = query.eq('league_id', league_id as string);
      }
      
      const { data, error } = await query;
      if (error) {
        console.error("[PROXY] Error fetching fixtures:", error);
        return res.status(500).json({ error: error.message });
      }
      res.json(data);
    } catch (e: any) {
      console.error("[PROXY] Exception fetching fixtures:", e);
      res.status(500).json({ error: e.message || "Unknown error" });
    }
  });

  app.get("/api/proxy/player-stats", async (req, res) => {
    try {
      const { player_id } = req.query;
      console.log("[PROXY] Fetching player stats, player_id:", player_id);
      let query = supabaseAdmin.from('player_stats').select('*');
      if (player_id && player_id !== "null" && player_id !== "undefined" && isValidUUID(player_id)) {
        query = query.eq('player_id', player_id as string);
      }
      const { data, error } = await query;
      if (error) {
        console.error("[PROXY] Error fetching player stats:", error);
        return res.status(500).json({ error: error.message });
      }
      res.json(data);
    } catch (e: any) {
      console.error("[PROXY] Exception fetching player stats:", e);
      res.status(500).json({ error: e.message || "Unknown error" });
    }
  });

  // API 404 handler - Ensure all /api/* routes return JSON
  app.all("/api/*", (req, res) => {
    console.log(`[SERVER] API 404: ${req.method} ${req.url}`);
    res.status(404).json({ 
      success: false, 
      error: `Route ${req.method} ${req.url} not found` 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log(`[SERVER] Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    // The catch-all must be the absolute final route for SPA
    app.get('*', (req, res, next) => {
      // Avoid catching /api routes that were missed
      if (req.url.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('--- Server Environment Check ---');
    console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'Present' : 'Missing');
    console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? `Present (Starts with: ${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10)}...)` : 'Missing');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('-------------------------------');

  });

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. This is common during rapid restarts. The server will attempt to recover.`);
    } else {
      console.error('Server error:', e);
    }
  });
}

startServer();
