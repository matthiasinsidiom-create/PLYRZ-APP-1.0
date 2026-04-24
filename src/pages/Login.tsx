import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { LogIn, UserPlus } from 'lucide-react';

export const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
            },
            emailRedirectTo: window.location.origin
          }
        });
        if (signUpError) throw signUpError;
        
        alert('Registrierung erfolgreich! Bitte überprüfe deine E-Mails zur Verifizierung.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setError(err.message);
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
            referrerPolicy="no-referrer"
          />
          <p className="text-zinc-400 font-medium tracking-widest uppercase text-[10px]">Die Premium Fußball Plattform</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4 bg-black/40 p-8 rounded-3xl border border-white/10 backdrop-blur-xl">
          {isRegister && (
            <div className="space-y-2 text-left">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Anzeigename</label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="Dein Name"
                required={isRegister}
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
          <div className="space-y-2 text-left">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Passwort</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm font-medium">{error}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 text-black font-black py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-400 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-black border-t-transparent rounded-full" />
            ) : (
              <>
                {isRegister ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                {isRegister ? 'ACCOUNT ERSTELLEN' : 'ANMELDEN'}
              </>
            )}
          </button>

          <button 
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-emerald-500 text-sm font-bold hover:underline mt-4"
          >
            {isRegister ? 'BEREITS EIN KONTO? ANMELDEN' : "NOCH KEIN KONTO? REGISTRIEREN"}
          </button>
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
