import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { clearPasswordRecovery, signOut } = useAuth();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });
      
      if (updateError) throw updateError;
      
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    clearPasswordRecovery();
    // After password reset, user might be logged in with a recovery session,
    // or we might want to force them to login again just to be sure.
    // We'll just let them proceed to the app if they have a valid session, 
    // or they will be on the login screen if we sign them out.
    // Let's just proceed to the app since they are logged in with the new password.
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-white font-sans">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md space-y-8 text-center"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4">
            <KeyRound className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black tracking-tighter italic uppercase text-white">NEUES PASSWORT</h2>
          <p className="text-zinc-400 font-medium tracking-widest uppercase text-[10px]">VERGEBE EIN NEUES PASSWORT FÜR DEINEN ACCOUNT</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4 bg-black/40 p-8 rounded-3xl border border-white/10 backdrop-blur-xl">
          {success ? (
            <div className="space-y-6">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                <p className="text-emerald-500 font-bold mb-2">PASSWORT ERFOLGREICH GEÄNDERT</p>
                <p className="text-zinc-400 text-sm">Dein neues Passwort wurde gespeichert. Du kannst die App jetzt nutzen.</p>
              </div>
              <button 
                type="button"
                onClick={handleFinish}
                className="w-full bg-emerald-500 text-black font-black py-4 rounded-xl hover:bg-emerald-400 transition-colors"
              >
                WEITER ZUR APP
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2 text-left">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Neues Passwort</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Mindestens 6 Zeichen"
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
                  'PASSWORT SPEICHERN'
                )}
              </button>
            </>
          )}
        </form>
      </motion.div>
    </div>
  );
};
