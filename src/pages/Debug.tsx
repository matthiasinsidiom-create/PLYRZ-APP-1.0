import React from 'react';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { appConfig } from '../lib/config';

export const Debug: React.FC = () => {
  const supabaseUrl = appConfig.supabaseUrl;
  const supabaseAnonKey = appConfig.supabaseAnonKey;

  return (
    <div className="min-h-screen bg-transparent p-8 text-zinc-300 font-mono text-sm">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-black italic uppercase tracking-tight text-white">Environment Debug</h1>
          <p className="text-zinc-500">Diagnostic information for client-side environment variables.</p>
        </div>

        <div className="grid gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-bold uppercase text-xs tracking-widest opacity-50">Supabase Configuration</h2>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>VITE_SUPABASE_URL</span>
                <div className="flex items-center gap-2">
                  {supabaseUrl ? (
                    <>
                      <span className="text-emerald-500 text-xs">{supabaseUrl}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </>
                  ) : (
                    <>
                      <span className="text-rose-500 text-xs">MISSING</span>
                      <XCircle className="w-4 h-4 text-rose-500" />
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span>VITE_SUPABASE_ANON_KEY</span>
                <div className="flex items-center gap-2">
                  {supabaseAnonKey ? (
                    <>
                      <span className="text-emerald-500 text-xs">PRESENT (HIDDEN)</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </>
                  ) : (
                    <>
                      <span className="text-rose-500 text-xs">MISSING</span>
                      <XCircle className="w-4 h-4 text-rose-500" />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-bold uppercase text-xs tracking-widest opacity-50">Configuration Status</h2>
            <div className="text-xs text-zinc-400">
              Using hardcoded configuration from <code className="text-white">src/lib/config.ts</code>
            </div>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 flex gap-4">
          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
          <div className="space-y-1">
            <p className="text-amber-500 font-bold text-xs uppercase tracking-wider">How to fix</p>
            <p className="text-zinc-400 text-xs leading-relaxed">
              If variables are missing above, go to the project <span className="text-white font-bold">Settings</span> and add them with the <span className="text-white font-bold">VITE_</span> prefix. 
              The application uses a custom Express/Vite setup, and variables must be explicitly defined in <span className="text-white font-bold">vite.config.ts</span> to be injected into the client bundle.
            </p>
            <button 
              onClick={() => {
                localStorage.removeItem('demo_mode');
                window.location.reload();
              }}
              className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-lg transition-colors"
            >
              Reset Demo Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
