import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth, AuthProvider } from './context/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminLeagues from './pages/admin/Leagues';
import AdminClubs from './pages/admin/Clubs';
import AdminTeams from './pages/admin/Teams';
import AdminPlayers from './pages/admin/Players';
import AdminFixtures from './pages/admin/Fixtures';
import AdminLineups from './pages/admin/Lineups';
import { PlayerClaim } from './pages/PlayerClaim';
import { MatchList } from './pages/fan/MatchList';
import { MatchDetail } from './pages/fan/MatchDetail';
import MatchResult from './pages/fan/MatchResult';
import PlayerList from './pages/fan/PlayerList';
import PlayerDetail from './pages/fan/PlayerDetail';
import { Leaderboard } from './pages/Leaderboard';
import { Profile } from './pages/fan/Profile';
import { VoteList } from './pages/fan/VoteList';
import { BottomNav } from './components/BottomNav';
import { Debug } from './pages/Debug';
import { motion } from 'framer-motion';

const AppContent: React.FC = () => {
  const { user, profile, loading, isAdmin, profileError, refreshProfile, signOut } = useAuth();
  const location = useLocation();
  const [showForceStart, setShowForceStart] = React.useState(false);
  
  React.useEffect(() => {
    console.log('AppContent: Auth state updated', { 
      hasUser: !!user, 
      hasProfile: !!profile, 
      loading, 
      isAdmin, 
      hasProfileError: !!profileError 
    });
  }, [user, profile, loading, isAdmin, profileError]);
  
  React.useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setShowForceStart(true), 6000);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mb-8"
        />
        <p className="text-zinc-500 font-medium animate-pulse">Initializing PLYRZ...</p>
        
        {showForceStart && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12 space-y-4"
          >
            <p className="text-xs text-zinc-600 max-w-xs mx-auto">
              Taking longer than expected? This can happen in some browser environments.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="text-emerald-500 text-sm font-bold hover:underline"
            >
              REFRESH PAGE
            </button>
            
            <button 
              onClick={() => {
                // Force loading false to show login screen
                window.location.href = window.location.origin + '/login';
              }}
              className="text-zinc-500 text-xs font-bold hover:underline block mx-auto mt-2"
            >
              GO TO LOGIN
            </button>

            <div className="pt-4 text-[10px] text-zinc-700 font-mono space-y-1">
              <p>Origin: {window.location.origin}</p>
              <p>Hash: {window.location.hash ? 'Present' : 'None'}</p>
              <p>Search: {window.location.search ? 'Present' : 'None'}</p>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Handle missing profile or profile fetch error
  if (!profile || profileError) {
    const isPermissionError = profileError?.message?.toLowerCase().includes('permission denied') || 
                              profileError?.code === '42501';
    
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md space-y-6"
        >
          <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">
              {isPermissionError ? '🔒' : '⚠️'}
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter italic">
            {isPermissionError ? 'ACCESS DENIED' : 'PROFILE ISSUE'}
          </h1>
          
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-xl text-left space-y-2">
            <p className="text-zinc-400 text-sm">
              {isPermissionError 
                ? "Your account is authenticated, but we don't have permission to read your profile data from the database. This is likely due to Supabase Row Level Security (RLS) policies."
                : profileError 
                  ? "We encountered an error while trying to fetch your profile information."
                  : "We couldn't find a profile record for your account in our database."}
            </p>
            
            {profileError && (
              <div className="pt-2 border-t border-white/5">
                <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-1">Error Details</p>
                <p className="text-xs font-mono text-red-400/80 break-all bg-black/30 p-2 rounded">
                  {profileError.message || JSON.stringify(profileError)}
                </p>
              </div>
            )}
          </div>

          {isPermissionError && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-left">
              <p className="text-emerald-400 text-xs font-bold mb-1">💡 FOR THE DEVELOPER:</p>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                You need to enable RLS policies for the <code className="text-emerald-300">profiles</code> table in your Supabase dashboard. 
                Ensure users have <code className="text-emerald-300">SELECT</code> and <code className="text-emerald-300">INSERT</code> permissions for their own rows.
              </p>
            </div>
          )}
          
          <div className="space-y-3 pt-4">
            <button 
              onClick={() => refreshProfile()}
              className="w-full bg-emerald-500 text-black font-black py-4 rounded-xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
              RETRY FETCHING PROFILE
            </button>
            <button 
              onClick={() => signOut()}
              className="w-full bg-zinc-800 text-white font-bold py-4 rounded-xl hover:bg-zinc-700 transition-colors border border-white/5"
            >
              SIGN OUT
            </button>
          </div>

          <div className="pt-4 text-[10px] text-zinc-700 font-mono">
            ID: {user.id}
          </div>
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/debug" element={<Debug />} />
          
          {/* Admin Routes */}
          {isAdmin && (
            <>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/leagues" element={<AdminLeagues />} />
              <Route path="/admin/clubs" element={<AdminClubs />} />
              <Route path="/admin/teams" element={<AdminTeams />} />
              <Route path="/admin/players" element={<AdminPlayers />} />
              <Route path="/admin/fixtures" element={<AdminFixtures />} />
              <Route path="/admin/lineups" element={<AdminLineups />} />
            </>
          )}
          
          <Route path="/claim" element={<PlayerClaim />} />
          <Route path="/matches" element={<MatchList />} />
          <Route path="/matches/:id" element={<MatchDetail />} />
          <Route path="/matches/:id/result" element={<MatchResult />} />
          <Route path="/players" element={<PlayerList />} />
          <Route path="/players/:id" element={<PlayerDetail />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/vote" element={<VoteList />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      
      {/* Only show bottom nav for fan routes, not admin or login */}
      {!location.pathname.startsWith('/admin') && (
        <BottomNav />
      )}
    </div>
  );
};

export default function App() {
  console.log('App: Rendering BrowserRouter...');
  return (
    <div 
      className="h-screen w-full bg-zinc-950 overflow-hidden"
      style={{
        backgroundImage: 'linear-gradient(rgba(9, 9, 11, 0.8), rgba(9, 9, 11, 0.8)), url("/assets/background.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <div className="h-full w-full overflow-auto selection:bg-emerald-500 selection:text-white">
            <AppContent />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
