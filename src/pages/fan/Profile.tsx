import React from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Settings, 
  LogOut, 
  Shield, 
  Trophy, 
  Star,
  ChevronRight,
  Mail,
  Calendar
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const Profile: React.FC = () => {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();

  if (!profile || !user) return null;

  const menuItems = [
    { id: 'settings', label: 'Account Settings', icon: Settings, path: '/settings' },
    { id: 'claim', label: 'Claim Player Profile', icon: Shield, path: '/claim' },
    { id: 'achievements', label: 'Achievements', icon: Trophy, path: '/achievements' },
    { id: 'stats', label: 'My Stats', icon: Star, path: '/stats' },
  ];

  return (
    <div className="min-h-screen bg-transparent text-white font-sans pb-32">
      {/* Header */}
      <div className="p-6 flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-50 border-b border-white/5">
        <h1 className="text-xl font-black italic tracking-tighter uppercase">Profile</h1>
        <div className="flex items-center gap-2">
          <img 
            src="/assets/plyrzlogo.png" 
            alt="PLYRZ Logo" 
            className="h-24 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Profile Info */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <div className="w-24 h-24 bg-zinc-900 rounded-[2rem] border-2 border-emerald-500/20 flex items-center justify-center overflow-hidden shadow-2xl">
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.display_name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-10 h-10 text-zinc-700" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center border-4 border-zinc-950">
              <Star className="w-4 h-4 text-black fill-black" />
            </div>
          </div>
          
          <div className="space-y-1">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">
              {profile.display_name}
            </h2>
            <div className="flex items-center justify-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
              <Mail className="w-3 h-3" />
              {user.email}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-4 text-center space-y-1">
            <div className="text-2xl font-black italic text-emerald-500">12</div>
            <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Matches Played</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-4 text-center space-y-1">
            <div className="text-2xl font-black italic text-emerald-500">8.4</div>
            <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Avg Rating</div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="space-y-2">
          {menuItems.map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(item.path)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between group hover:border-emerald-500/50 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                  <item.icon className="w-5 h-5 text-zinc-500 group-hover:text-emerald-500 transition-colors" />
                </div>
                <span className="text-sm font-bold uppercase tracking-tight italic">
                  {item.label}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-emerald-500 transition-colors" />
            </motion.button>
          ))}
        </div>

        {/* Sign Out */}
        <button
          onClick={() => signOut()}
          className="w-full bg-red-500/10 border border-red-500/20 text-red-500 font-black italic uppercase tracking-tighter py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>

        {/* Footer Info */}
        <div className="text-center space-y-1 pt-4">
          <p className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.3em]">
            PLYRZ APP VERSION 1.0.4
          </p>
          <div className="flex items-center justify-center gap-2 text-[8px] font-black text-zinc-800 uppercase tracking-widest">
            <Calendar className="w-2 h-2" />
            Joined {new Date(profile.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
