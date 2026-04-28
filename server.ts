import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { supabaseAdmin } from "./src/lib/supabaseAdmin";
import { processFixtureRatings } from "./src/services/matchProcessor";
import { runAutoProcessor } from "./src/services/backgroundProcessor";

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  const PORT = 3000;

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      message: "Supabase migration in progress",
      env: {
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? 'Present' : 'Missing',
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? `Present (Length: ${process.env.SUPABASE_SERVICE_ROLE_KEY.length}, Starts with: ${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10)}...)` : 'Missing',
        NODE_ENV: process.env.NODE_ENV
      }
    });
  });

  // Middleware to ensure JSON for automation routes and log them
  app.use("/api/automation", (req, res, next) => {
    const originalJson = res.json;
    res.json = function(body) {
      console.log(`DEBUG: [SERVER] Outgoing JSON response for ${req.method} ${req.url}:`, JSON.stringify(body));
      return originalJson.call(this, body);
    };
    next();
  });

  // Secure Automation Endpoint for Supabase Cron
  app.post("/api/automation/run-processor", async (req, res) => {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-me';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      const response = { 
        success: false, 
        error: "Unauthorized" 
      };
      console.warn('DEBUG: [AUTOMATION] Unauthorized attempt to trigger processor. Returning:', JSON.stringify(response));
      return res.status(401).json(response);
    }

    // NEW BEHAVIOR: Automatic processing is disabled from the critical path.
    // We return success but do nothing, as results must now be processed manually by an admin.
    const response = { 
      success: true, 
      message: "Automatic processing is currently disabled. Results must be processed manually by an admin." 
    };
    console.log('DEBUG: [AUTOMATION] Automatic processing is disabled. Returning:', JSON.stringify(response));
    return res.status(200).json(response);
  });

  // Secure Admin Endpoint for Manual Result Processing
  app.post("/api/admin/process-fixture-results", async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[ADMIN-ROUTE][${requestId}] Incoming request: ${req.method} ${req.url}`);
    console.log(`[ADMIN-ROUTE][${requestId}] Headers: ${JSON.stringify(req.headers)}`);
    console.log(`[ADMIN-ROUTE][${requestId}] Body: ${JSON.stringify(req.body)}`);
    
    // Set response header to JSON immediately to be safe
    res.setHeader('Content-Type', 'application/json');

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn(`[ADMIN-ROUTE][${requestId}] Missing or invalid Authorization header`);
        return res.status(401).json({ success: false, error: "Authentication required" });
      }

      const token = authHeader.split(' ')[1];
      const { fixtureId } = req.body;

      if (!fixtureId) {
        return res.status(400).json({ success: false, error: "fixtureId is required" });
      }

      // 1. Verify user is admin
      let user;
      try {
        const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !authUser) throw new Error("Invalid session or expired token");
        user = authUser;
      } catch (authErr: any) {
        console.warn(`[ADMIN-ROUTE][${requestId}] Auth verification failed:`, authErr.message);
        return res.status(401).json({ success: false, error: `Authentication failed: ${authErr.message}` });
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      const isAdmin = profile?.role === 'admin' || user.email === "matthias.insidiom@gmail.com";
      if (!isAdmin) {
        console.warn(`[ADMIN-ROUTE][${requestId}] User ${user.email} is not an admin`);
        return res.status(403).json({ success: false, error: "Admin access required" });
      }

      // 2. Verify fixture state
      const { data: fixture, error: fixtureError } = await supabaseAdmin
        .from('fixtures')
        .select('*')
        .eq('id', fixtureId)
        .single();
      
      if (fixtureError || !fixture) {
        return res.status(404).json({ success: false, error: "Fixture not found" });
      }

      if (fixture.status !== 'finished') {
        return res.status(400).json({ success: false, error: "Fixture must be finished/closed to process results" });
      }

      // 3. Call processor
      console.log(`[ADMIN-ROUTE][${requestId}] Calling processFixtureRatings for ${fixtureId}`);
      
      try {
        const results = await processFixtureRatings(supabaseAdmin, fixtureId);
        console.log(`[ADMIN-ROUTE][${requestId}] Successfully processed ${results?.length || 0} results`);

        const processedCount = results?.length || 0;
        const responseJson = { 
          success: true, 
          processed: processedCount > 0,
          fixtureId: fixtureId,
          message: processedCount > 0 ? "Match processed successfully" : "No fixtures needed processing",
          processedCount: processedCount
        };
        console.log(`[ADMIN-ROUTE][${requestId}] Returning JSON: ${JSON.stringify(responseJson)}`);

        return res.status(200).json(responseJson);
      } catch (procErr: any) {
        console.error(`[ADMIN-ROUTE][${requestId}] Internal Processor Failure:`, procErr);
        const errorJson = {
          success: false, 
          error: `Processor error: ${procErr.message || 'Unknown processing error'}`,
          fixtureId
        };
        console.log(`[ADMIN-ROUTE][${requestId}] Returning JSON Error: ${JSON.stringify(errorJson)}`);
        return res.status(500).json(errorJson);
      }

    } catch (err: any) {
      console.error(`[ADMIN-ROUTE][${requestId}] Global Catch:`, err);
      const errorJson = { 
        success: false, 
        error: `Server error: ${err.message || 'Unexpected failure'}` 
      };
      console.log(`[ADMIN-ROUTE][${requestId}] Returning JSON Error: ${JSON.stringify(errorJson)}`);
      return res.status(500).json(errorJson);
    }
  });

  // Admin trigger for manual processing of all pending matches
  app.post("/api/admin/process-pending", async (req, res) => {
    try {
      const now = new Date().toISOString();
      
      // Find finished fixtures where voting has closed and results haven't been processed
      const { data: fixtures, error } = await supabaseAdmin
        .from('fixtures')
        .select('id, voting_close_at')
        .eq('status', 'finished')
        .is('results_processed_at', null)
        .not('voting_close_at', 'is', null)
        .lt('voting_close_at', now);

      if (error) throw error;

      if (!fixtures || fixtures.length === 0) {
        return res.json({ message: "No pending fixtures to process" });
      }

      const results = [];
      for (const fixture of fixtures) {
        try {
          const processed = await processFixtureRatings(supabaseAdmin, fixture.id);
          results.push({ id: fixture.id, success: true, count: processed.length });
        } catch (err) {
          console.error(`Error processing fixture ${fixture.id}:`, err);
          results.push({ id: fixture.id, success: false, error: err instanceof Error ? err.message : String(err) });
        }
      }

      res.json({ processed: results });
    } catch (err) {
      console.error('Error in manual process-pending:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // API 404 handler - Ensure all /api/* routes return JSON
  app.all("/api/*", (req, res) => {
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
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
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

    // Startup Test: Verify supabaseAdmin permissions
    console.log('DEBUG: [SERVER] Comparing keys...');
    
    // --- AUTOMATIC BACKGROUND PROCESSOR ---
    // Runs every 60 seconds to process matches where voting has closed
    setInterval(async () => {
      try {
        const now = new Date().toISOString();
        console.log(`DEBUG: [AUTO-PROCESSOR] Checking for pending fixtures at ${now}...`);
        
        const { data: fixtures, error } = await supabaseAdmin
          .from('fixtures')
          .select('id, voting_close_at')
          .eq('status', 'finished')
          .is('results_processed_at', null)
          .not('voting_close_at', 'is', null)
          .lt('voting_close_at', now);

        if (error) {
          console.error('DEBUG: [AUTO-PROCESSOR] Error fetching pending fixtures:', error);
          return;
        }

        if (fixtures && fixtures.length > 0) {
          console.log(`DEBUG: [AUTO-PROCESSOR] Found ${fixtures.length} fixtures to process.`);
          for (const fixture of fixtures) {
            try {
              console.log(`DEBUG: [AUTO-PROCESSOR] Processing fixture ${fixture.id}...`);
              const results = await processFixtureRatings(supabaseAdmin, fixture.id);
              console.log(`DEBUG: [AUTO-PROCESSOR] SUCCESS for fixture ${fixture.id}. ${results?.length || 0} players updated.`);
            } catch (err: any) {
              console.error(`DEBUG: [AUTO-PROCESSOR] FAILED for fixture ${fixture.id}:`, err?.message || err);
              if (err?.stack) console.error(err.stack);
            }
          }
        }
      } catch (err: any) {
        console.error('DEBUG: [AUTO-PROCESSOR] Critical interval error:', err?.message || err);
        if (err?.stack) console.error(err.stack);
      }
    }, 60000); // 1 minute interval

    try {
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      
      console.log(`DEBUG: [SERVER] Key Comparison:`);
      console.log(`  - Anon Key: ${anonKey.substring(0, 10)}...${anonKey.substring(anonKey.length - 10)} (Length: ${anonKey.length})`);
      console.log(`  - Service Key: ${serviceKey.substring(0, 10)}...${serviceKey.substring(serviceKey.length - 10)} (Length: ${serviceKey.length})`);
      console.log(`  - Keys Match: ${anonKey === serviceKey}`);
      console.log(`  - supabaseAdmin internal key length: ${(supabaseAdmin as any).supabaseKey?.length}`);
      
      if (anonKey === serviceKey && anonKey !== '') {
        console.error('DEBUG: [SERVER] CRITICAL WARNING: SUPABASE_SERVICE_ROLE_KEY is identical to VITE_SUPABASE_ANON_KEY. This will cause permission errors in administrative tasks!');
      }
      
      const testResult = {
        timestamp: new Date().toISOString(),
        keysMatch: anonKey === serviceKey,
        anonKeyStart: anonKey.substring(0, 20),
        serviceKeyStart: serviceKey.substring(0, 20),
        anonKeyEnd: anonKey.substring(anonKey.length - 20),
        serviceKeyEnd: serviceKey.substring(serviceKey.length - 20),
        env: {
          url: !!process.env.VITE_SUPABASE_URL,
          urlValue: process.env.VITE_SUPABASE_URL,
          key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          keyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
          nodeEnv: process.env.NODE_ENV
        }
      };

      // Write to a file so we can read it via tool
      const fs = await import('fs');
      fs.writeFileSync('startup_test_result.json', JSON.stringify(testResult, null, 2));
      console.log('DEBUG: [SERVER] Startup test result written to startup_test_result.json');

    } catch (err) {
      console.error('DEBUG: [SERVER] Startup permission test EXCEPTION:', err);
      const fs = await import('fs');
      fs.writeFileSync('startup_test_result.json', JSON.stringify({ 
        timestamp: new Date().toISOString(),
        crashed: true, 
        error: err instanceof Error ? err.message : String(err) 
      }, null, 2));
    }
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
