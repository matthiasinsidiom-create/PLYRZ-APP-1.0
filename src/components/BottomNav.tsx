import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Home, 
  Calendar, 
  ThumbsUp, 
  Trophy, 
  User,
  ShieldAlert
} from 'lucide-react';
import { supabaseService } from '../services/supabaseService';

interface BottomNavProps {
  hasAdminAccess?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ hasAdminAccess: externalHasAdminAccess }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [internalHasAdminAccess, setInternalHasAdminAccess] = useState(false);

  useEffect(() => {
    // If external prop is provided, we use it directly
    if (externalHasAdminAccess !== undefined) {
      setInternalHasAdminAccess(externalHasAdminAccess);
      return;
    }

    const checkAccess = async () => {
      if (!user) {
        setInternalHasAdminAccess(false);
        return;
      }
      try {
        const [isAdminResult, clubAccess] = await Promise.all([
          supabaseService.isUserAdmin(),
          supabaseService.getClubAdminAccess()
        ]);
        setInternalHasAdminAccess(isAdminResult || clubAccess.length > 0);
      } catch (err) {
        setInternalHasAdminAccess(false);
      }
    };
    checkAccess();
  }, [user, externalHasAdminAccess]);

  const hasAccess = internalHasAdminAccess;

  const tabs = [
    { id: 'home', label: 'Start', icon: Home, path: '/' },
    { id: 'matches', label: 'Spiele', icon: Calendar, path: '/matches' },
    { id: 'vote', label: 'Voten', icon: ThumbsUp, path: '/vote' },
    { id: 'leaderboard', label: 'Ranking', icon: Trophy, path: '/leaderboard' },
  ];

  if (hasAccess) {
    tabs.push({ id: 'team-admin', label: 'Admin', icon: ShieldAlert, path: '/team-admin' });
  }

  tabs.push({ id: 'profile', label: 'Profil', icon: User, path: '/profile' });

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
