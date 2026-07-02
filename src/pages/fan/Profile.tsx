import React from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Settings, 
  LogOut, 
  Shield, 
  Trophy, 
  Star,
  Crown,
  ChevronRight,
  Mail,
  Calendar,
  RotateCcw,
  Bell
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../../services/supabaseService';
import { 
  getPushState, 
  onPushStateChange, 
  setupPushNotifications, 
  sendTestPush,
  PushDebugState 
} from '../../lib/pushNotifications';

const PushDebug: React.FC = () => {
  const [debugState, setDebugState] = React.useState<PushDebugState>(getPushState());
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    return onPushStateChange((state) => {
      setDebugState(state);
    });
  }, []);

  const handleReRegister = async () => {
    await setupPushNotifications();
  };

  const handleTestPush = async () => {
    setSending(true);
    await sendTestPush();
    setSending(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/80 border border-white/5 rounded-[2rem] p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-emerald-500" />
          <h3 className="text-sm font-black italic uppercase tracking-tighter text-emerald-500">Push Debug</h3>
        </div>
        <span className={`w-2 h-2 rounded-full ${debugState.lastSuccess ? 'bg-emerald-500' : 'bg-red-500'}`} />
      </div>

      <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        <div>
          <p className="text-zinc-600 mb-1">Native / Platform</p>
          <p className="text-white">{debugState.isNative ? 'YES' : 'NO'} / {debugState.platform}</p>
        </div>
        <div>
          <p className="text-zinc-600 mb-1">Permission</p>
          <p className="text-white">{debugState.permissionStatus}</p>
        </div>
        <div>
          <p className="text-zinc-600 mb-1">Setup / Register</p>
          <p className="text-white">{debugState.started ? 'YES' : 'NO'} / {debugState.registerCalled ? 'YES' : 'NO'}</p>
        </div>
        <div>
          <p className="text-zinc-600 mb-1">Token Received</p>
          <p className="text-white">{debugState.tokenReceived ? 'YES' : 'NO'}</p>
        </div>
        <div className="col-span-2">
          <p className="text-zinc-600 mb-1">Token Start</p>
          <p className="text-white font-mono break-all">{debugState.tokenStart || 'N/A'}</p>
        </div>
        <div className="col-span-2">
          <p className="text-zinc-600 mb-1">Session User ID</p>
          <p className="text-white font-mono break-all text-[8px]">{debugState.userId || 'NONE'}</p>
        </div>
        <div className="col-span-2">
          <p className="text-zinc-600 mb-1">Last Attempt</p>
          <p className="text-white">{debugState.lastAttempt ? new Date(debugState.lastAttempt).toLocaleString() : 'NEVER'}</p>
        </div>
        {debugState.lastError && (
          <div className="col-span-2 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
            <p className="text-red-500 mb-1">Error</p>
            <p className="text-red-400 font-mono text-[8px] break-all">{debugState.lastError}</p>
          </div>
        )}
        {debugState.testPushResult && (
          <div className={`col-span-2 p-2 rounded-lg border ${debugState.testPushResult.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <p className={`text-[8px] font-black uppercase mb-1 ${debugState.testPushResult.success ? 'text-emerald-500' : 'text-red-500'}`}>Test Push Result</p>
            <p className="text-white font-mono text-[8px] break-all">Data: {JSON.stringify(debugState.testPushResult.data)}</p>
            {debugState.testPushResult.error && <p className="text-red-400 font-mono text-[8px] break-all mt-1">Error: {JSON.stringify(debugState.testPushResult.error)}</p>}
            <p className="text-zinc-600 text-[6px] mt-1 italic uppercase font-black">{new Date(debugState.testPushResult.timestamp).toLocaleString()}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleReRegister}
          className="py-3 bg-zinc-800 hover:bg-zinc-700 border border-white/5 rounded-xl text-[10px] font-black uppercase italic tracking-widest transition-all active:scale-95"
        >
          Push erneut registrieren
        </button>
        <button
          onClick={handleTestPush}
          disabled={sending}
          className={`py-3 ${sending ? 'bg-zinc-700 opacity-50' : 'bg-emerald-600 hover:bg-emerald-500'} border border-white/5 rounded-xl text-[10px] font-black uppercase italic tracking-widest transition-all active:scale-95 text-white`}
        >
          {sending ? 'Sendet...' : 'Test-Push senden'}
        </button>
      </div>
    </motion.div>
  );
};

export const Profile: React.FC = () => {
  const { profile, user, signOut, refreshProfile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [resetting, setResetting] = React.useState(false);

  if (!profile || !user) return null;

  const handleResetTutorial = async () => {
    setResetting(true);
    try {
      await supabaseService.updateProfile(user.id, { onboarding_completed: false });
      await refreshProfile();
      navigate('/onboarding');
    } catch (err) {
      console.error('Error resetting tutorial:', err);
    } finally {
      setResetting(false);
    }
  };

  const menuItems = [
    { id: 'premium', label: 'PLYRZ Premium', icon: Crown, path: '/premium', color: 'text-amber-500' },
    { id: 'logic', label: 'Rating-Logik', icon: Star, path: '/rating-logic' },
    { id: 'settings', label: 'Einstellungen', icon: Settings, path: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-transparent text-white font-sans pb-28">
      {/* Header */}
      <div className="p-6 pt-[10px] flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-50 border-b border-white/5">
        <h1 className="text-xl font-black italic tracking-tighter uppercase">Profil</h1>
        <div className="flex items-center gap-2">
          <img 
            src="https://upvzomofjjwaxkfogpuc.supabase.co/storage/v1/object/public/assets/logo/Logo1024.png" 
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
                <div className={`w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center transition-colors ${item.color ? 'group-hover:bg-amber-500/10' : 'group-hover:bg-emerald-500/10'}`}>
                  <item.icon className={`w-5 h-5 transition-colors ${item.color || 'text-zinc-500 group-hover:text-emerald-500'}`} />
                </div>
                <span className={`text-sm font-bold uppercase tracking-tight italic ${item.color || ''}`}>
                  {item.label}
                </span>
              </div>
              <ChevronRight className={`w-5 h-5 transition-colors ${item.color || 'text-zinc-700 group-hover:text-emerald-500'}`} />
            </motion.button>
          ))}
        </div>

        {/* Push Debug (Admin Only) */}
        {isAdmin && <PushDebug />}

        {/* Rechtliches */}
        <div className="space-y-4 pt-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 pl-4">Rechtliches & Support</h3>
          <div className="space-y-2">
            <a 
              href="https://www.plyrz.at/datenschutz" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between group hover:border-emerald-500/50 transition-all"
            >
              <span className="text-sm font-bold uppercase tracking-tight italic text-zinc-300 group-hover:text-white transition-colors">
                Datenschutz
              </span>
              <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-emerald-500 transition-colors" />
            </a>
            <a 
              href="https://www.plyrz.at/impressum" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between group hover:border-emerald-500/50 transition-all"
            >
              <span className="text-sm font-bold uppercase tracking-tight italic text-zinc-300 group-hover:text-white transition-colors">
                Impressum
              </span>
              <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-emerald-500 transition-colors" />
            </a>
            <a 
              href="mailto:support@plyrz.at" 
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between group hover:border-emerald-500/50 transition-all"
            >
              <span className="text-sm font-bold uppercase tracking-tight italic text-zinc-300 group-hover:text-white transition-colors">
                Support kontaktieren
              </span>
              <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-emerald-500 transition-colors" />
            </a>
          </div>
        </div>

        {/* Sign Out */}
        <button
          onClick={() => signOut()}
          className="w-full bg-red-500/10 border border-red-500/20 text-red-500 font-black italic uppercase tracking-tighter py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all"
        >
          <LogOut className="w-5 h-5" />
          Abmelden
        </button>

        {/* Footer Info */}
        <div className="text-center space-y-1 pt-4">
          <p className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.3em]">
            PLYRZ APP VERSION 1.0.4
          </p>
          <div className="flex items-center justify-center gap-2 text-[8px] font-black text-zinc-800 uppercase tracking-widest">
            <Calendar className="w-2 h-2" />
            Mitglied seit {new Date(profile.created_at).toLocaleDateString('de-DE')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
