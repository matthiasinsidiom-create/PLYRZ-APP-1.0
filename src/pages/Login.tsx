import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { LogIn, UserPlus, Trophy } from 'lucide-react';

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
        const { data, error: signUpError } = await supabase.auth.signUp({
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
        
        if (data.user) {
          // Profile creation is usually handled by a trigger in Supabase, 
          // but we can also do it manually if needed.
          // For now, we'll assume the trigger handles it or we'll do a check.
          const isAdmin = email === "matthias.insidiom@gmail.com";
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              display_name: displayName || email.split('@')[0],
              user_type: isAdmin ? 'admin' : 'fan',
              is_admin: isAdmin
            });
          if (profileError) console.error('Profile creation error:', profileError);
        }
        alert('Registration successful! Please check your email for verification.');
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

  const handleGoogleLogin = async () => {
    const isIframe = window.self !== window.top;
    setError('');
    
    console.log('--- Google Login Attempt ---');
    console.log('Is in iframe:', isIframe);

    try {
      setLoading(true);
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });
      
      if (oauthError) throw oauthError;
      
      // If we're in an iframe, we might not actually redirect or it might be blocked
      // We'll set a small timeout to reset loading if nothing happens
      setTimeout(() => {
        if (loading) setLoading(false);
      }, 5000);

    } catch (err: any) {
      console.error('Login: Google login error:', err);
      setError("Google login failed. This is common inside the embedded preview. Please use Email/Password or open the app in a new tab.");
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
            src="/assets/plyrzlogo.png" 
            alt="PLYRZ Logo" 
            className="h-64 w-auto object-contain mb-8"
            referrerPolicy="no-referrer"
          />
          <p className="text-zinc-400 font-medium tracking-widest uppercase text-[10px]">The Premium Football Platform</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4 bg-black/40 p-8 rounded-3xl border border-white/10 backdrop-blur-xl">
          {isRegister && (
            <div className="space-y-2 text-left">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Display Name</label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="Your Name"
                required={isRegister}
              />
            </div>
          )}
          <div className="space-y-2 text-left">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="name@example.com"
              required
            />
          </div>
          <div className="space-y-2 text-left">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Password</label>
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
                {isRegister ? 'CREATE ACCOUNT' : 'SIGN IN'}
              </>
            )}
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-transparent px-2 text-zinc-500 font-bold tracking-widest">Optional</span></div>
          </div>

          <div className="space-y-3">
            <button 
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-zinc-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-zinc-700 transition-colors border border-white/5 disabled:opacity-50"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              GOOGLE LOGIN
            </button>
            <p className="text-[10px] text-zinc-500 font-medium leading-tight">
              Note: Google login may not work inside the embedded AI Studio preview. Please use email/password here.
            </p>
          </div>

          <button 
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-emerald-500 text-sm font-bold hover:underline mt-4"
          >
            {isRegister ? 'ALREADY HAVE AN ACCOUNT? SIGN IN' : "DON'T HAVE AN ACCOUNT? REGISTER"}
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
