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
