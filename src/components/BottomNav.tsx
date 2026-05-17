import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  Calendar, 
  ThumbsUp, 
  Trophy, 
  User,
  ShieldAlert
} from 'lucide-react';
import { supabaseService } from '../services/supabaseService';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasAdminAccess, setHasAdminAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const [isAdmin, clubAccess] = await Promise.all([
        supabaseService.isUserAdmin(),
        supabaseService.getClubAdminAccess()
      ]);
      setHasAdminAccess(isAdmin || clubAccess.length > 0);
    };
    checkAccess();
  }, []);

  const tabs = [
    { id: 'home', label: 'Start', icon: Home, path: '/' },
    { id: 'matches', label: 'Spiele', icon: Calendar, path: '/matches' },
    { id: 'vote', label: 'Voten', icon: ThumbsUp, path: '/vote' },
    { id: 'leaderboard', label: 'Ranking', icon: Trophy, path: '/leaderboard' },
    { id: 'profile', label: 'Profil', icon: User, path: '/profile' },
  ];

  if (hasAdminAccess) {
    // Insert Team Admin before profile
    tabs.splice(4, 0, { id: 'team-admin', label: 'Admin', icon: ShieldAlert, path: '/team-admin' });
  }

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-4 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent pointer-events-none">
      <div className="max-w-md mx-auto bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-2 flex items-center justify-between shadow-2xl pointer-events-auto">
        {tabs.map((tab) => {
          const Active = isActive(tab.path);
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-1 flex-1 py-2 rounded-2xl transition-all duration-300 ${
                Active 
                  ? 'text-emerald-500 bg-emerald-500/10' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className={`w-5 h-5 ${Active ? 'animate-pulse' : ''}`} />
              <span className="text-[9px] font-black uppercase tracking-tighter">
                {tab.label}
              </span>
              {Active && (
                <div className="w-1 h-1 bg-emerald-500 rounded-full mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
