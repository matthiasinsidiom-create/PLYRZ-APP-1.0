import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { LogIn, UserPlus } from 'lucide-react';

export const Login: React.FC = () => {
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const mapAuthError = (errMessage: string) => {
    const msg = errMessage.toLowerCase();
    if (msg.includes('email not confirmed')) return 'Bitte bestätige zuerst deine E-Mail-Adresse. Prüfe deinen Posteingang.';
    if (msg.includes('invalid login credentials')) return 'E-Mail oder Passwort ist falsch.';
    if (msg.includes('user already registered')) return 'Diese E-Mail-Adresse wird bereits verwendet.';
    if (msg.includes('password should be at least')) return 'Das Passwort muss mindestens 6 Zeichen lang sein.';
    return errMessage;
  };

  const getRedirectUrl = () => {
    // If it's Capacitor/native, use a custom URL scheme or let Supabase use its default SITE_URL.
    // For web preview, window.location.origin is fine.
    if (window.location.origin.includes('localhost') || window.location.origin.startsWith('capacitor://')) {
      return undefined; // Let Supabase use the configured SITE_URL
    }
    return window.location.origin;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      if (view === 'register') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
            },
            emailRedirectTo: getRedirectUrl()
          }
        });
        if (signUpError) throw signUpError;
        
        setSuccessMsg('Bitte bestätige deine E-Mail-Adresse. Danach kannst du dich einloggen.');
        setView('login');
        setPassword('');
      } else if (view === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getRedirectUrl()
        });
        if (resetError) throw resetError;
        
        setSuccessMsg('Eine E-Mail zum Zurücksetzen deines Passworts wurde versendet.');
        setView('login');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setError(mapAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-white font-sans">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md space-y-8 text-center"
      >
        <div className="flex flex-col items-center gap-2">
          <img 
            src="https://upvzomofjjwaxkfogpuc.supabase.co/storage/v1/object/public/assets/logo/Logo1024.png" 
            alt="PLYRZ Logo" 
            className="h-64 w-auto object-contain mb-8"
            
          />
          <p className="text-zinc-400 font-medium tracking-widest uppercase text-[10px]">Die Premium Fußball Plattform</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4 bg-black/40 p-8 rounded-3xl border border-white/10 backdrop-blur-xl">
          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-left">
              <p className="text-emerald-500 text-sm font-medium">{successMsg}</p>
            </div>
          )}

          {view === 'register' && (
            <div className="space-y-2 text-left">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Anzeigename</label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="Dein Name"
                required={view === 'register'}
              />
            </div>
          )}
          <div className="space-y-2 text-left">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">E-Mail</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="name@beispiel.de"
              required
            />
          </div>
          
          {view !== 'forgot' && (
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Passwort</label>
                {view === 'login' && (
                  <button 
                    type="button" 
                    onClick={() => { setView('forgot'); setError(''); setSuccessMsg(''); }}
                    className="text-[10px] text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-wider"
                  >
                    Passwort vergessen?
                  </button>
                )}
              </div>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
                required={view !== 'forgot'}
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm font-medium">{error}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 text-black font-black py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-400 transition-colors disabled:opacity-50 mt-4"
          >
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-black border-t-transparent rounded-full" />
            ) : (
              <>
                {view === 'register' ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                {view === 'register' ? 'ACCOUNT ERSTELLEN' : view === 'forgot' ? 'ZURÜCKSETZEN' : 'ANMELDEN'}
              </>
            )}
          </button>

          <div className="flex flex-col gap-2 pt-4 border-t border-white/5">
            {view !== 'login' && (
              <button 
                type="button"
                onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }}
                className="text-zinc-400 text-sm font-bold hover:text-white transition-colors"
              >
                ZURÜCK ZUR ANMELDUNG
              </button>
            )}
            {view === 'login' && (
              <button 
                type="button"
                onClick={() => { setView('register'); setError(''); setSuccessMsg(''); }}
                className="text-emerald-500 text-sm font-bold hover:text-emerald-400 transition-colors"
              >
                NOCH KEIN KONTO? REGISTRIEREN
              </button>
            )}
          </div>
        </form>

        <div className="pt-12 text-[10px] text-zinc-700 font-mono space-y-1">
          <p>Origin: {window.location.origin}</p>
          <p>Hash: {window.location.hash ? 'Present' : 'None'}</p>
          <p>Search: {window.location.search ? 'Present' : 'None'}</p>
        </div>
      </motion.div>
    </div>
  );
};
