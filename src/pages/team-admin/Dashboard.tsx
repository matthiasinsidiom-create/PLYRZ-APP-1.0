import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Shield, 
  Calendar, 
  ChevronRight, 
  User, 
  Settings,
  Layout,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Fixture, ClubAdmin } from '../../types';
import SafeAreaWrapper from '../../components/SafeAreaWrapper';
import { MatchCard } from '../../components/MatchCard';

export const TeamAdminDashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [access, setAccess] = useState<ClubAdmin[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeamAdminData();
  }, []);

  const loadTeamAdminData = async () => {
    setLoading(true);
    try {
      const [clubAccess, isMainAdmin] = await Promise.all([
        supabaseService.getClubAdminAccess(),
        supabaseService.isMainAdmin()
      ]);
      setAccess(clubAccess);

      if (clubAccess.length > 0 || isMainAdmin) {
        // Actually, let's just get all fixtures for the current round or upcoming
        const { data, error: fetchError } = await supabase
          .from('fixtures')
          .select('*, home_team:home_team_id(id, name, club_id, clubs(name, logo_url)), away_team:away_team_id(id, name, club_id, clubs(name, logo_url)), leagues(name)')
          .order('kickoff_at', { ascending: true })
          .limit(50);

          if (fetchError) throw fetchError;

          // Filter fixtures based on access
          const filtered = (data || []).filter(f => {
            if (isMainAdmin) return true;
            
            const hClubId = f.home_team?.club_id;
            const aClubId = f.away_team?.club_id;
            
            return clubAccess.some(a => 
              (a.club_id === hClubId || a.club_id === aClubId) &&
              (a.team_scope === 'all' || a.team_scope === f.match_type)
            );
          });

          setFixtures(filtered);
      }
    } catch (err) {
      console.error('Error loading team admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    supabaseService.isMainAdmin().then(setIsSuperAdmin);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (access.length === 0 && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Shield className="w-16 h-16 text-zinc-700 mb-4" />
        <h1 className="text-xl font-bold mb-2">Kein Zugriff</h1>
        <p className="text-zinc-500 text-sm mb-6">Du hast keine Berechtigung für den Team-Admin Bereich.</p>
        <button 
          onClick={() => navigate('/')}
          className="bg-zinc-800 text-white px-6 py-2 rounded-lg"
        >
          Zurück zum Dashboard
        </button>
      </div>
    );
  }

  return (
    <SafeAreaWrapper>
      <div className="p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Team Admin</p>
            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase italic">
              Dashboard
            </h1>
          </div>
          <button 
            onClick={() => navigate('/profile')}
            className="w-10 h-10 bg-zinc-900 border border-white/10 rounded-full flex items-center justify-center"
          >
            <User className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Club Info */}
        <div className="grid grid-cols-1 gap-4">
          {access.map(a => (
            <div key={a.id} className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center overflow-hidden border border-white/10">
                {a.clubs?.logo_url ? (
                  <img src={a.clubs.logo_url} alt={a.clubs.name} className="w-8 h-8 object-contain" />
                ) : (
                  <Shield className="w-6 h-6 text-zinc-700" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-white">{a.clubs?.name}</h3>
                <p className="text-xs text-zinc-400 uppercase tracking-wider">
                  {a.team_scope === 'all' ? 'Alle Teams' : a.team_scope === 'kampfmannschaft' ? 'Kampfmannschaft' : 'Reserve'}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Fixtures */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Deine Spiele</h2>
          </div>
          
          <div className="space-y-4">
            {fixtures.length === 0 ? (
              <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-2xl text-center">
                <Calendar className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">Keine Spiele gefunden.</p>
              </div>
            ) : (
              fixtures.map(f => (
                <div 
                  key={f.id}
                  className="bg-zinc-900 border border-white/5 overflow-hidden rounded-[2rem] p-5 space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                        f.status === 'live' ? 'bg-red-500 text-white animate-pulse' :
                        f.status === 'finished' ? 'bg-zinc-800 text-zinc-400' :
                        f.status === 'cancelled' ? 'bg-zinc-800 text-red-500' :
                        'bg-emerald-500/20 text-emerald-500'
                      }`}>
                        {f.status === 'live' ? 'Live' : f.status === 'upcoming' ? 'Upcoming' : f.status === 'cancelled' ? 'Abgesagt' : 'Beendet'}
                      </span>
                      <span className="text-[8px] text-zinc-500 font-mono uppercase tracking-widest">
                        {new Date(f.kickoff_at).toLocaleDateString('de-DE')} • {new Date(f.kickoff_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 py-2">
                    <div className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center p-2.5 border border-white/5">
                        {f.home_team?.clubs?.logo_url ? (
                          <img src={f.home_team.clubs.logo_url} className="w-full h-full object-contain" />
                        ) : <Shield className="w-6 h-6 text-zinc-600" />}
                      </div>
                      <span className="text-[10px] font-black uppercase text-center leading-tight truncate w-full">{f.home_team?.name}</span>
                    </div>
                    
                    <div className="flex flex-col items-center">
                      <div className="text-xl font-black italic tracking-tighter text-white opacity-40">VS</div>
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center p-2.5 border border-white/5">
                        {f.away_team?.clubs?.logo_url ? (
                          <img src={f.away_team.clubs.logo_url} className="w-full h-full object-contain" />
                        ) : <Shield className="w-6 h-6 text-zinc-600" />}
                      </div>
                      <span className="text-[10px] font-black uppercase text-center leading-tight truncate w-full">{f.away_team?.name}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button 
                      onClick={() => navigate(`/team-admin/lineup/${f.id}`)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-black font-black italic uppercase tracking-widest py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 text-[10px]"
                    >
                      <Layout className="w-4 h-4" />
                      Aufstellung
                    </button>
                    {f.status !== 'cancelled' && f.status !== 'finished' && (
                      <button 
                        onClick={async () => {
                          if (confirm('Soll dieses Spiel wirklich auf "Abgesagt" gesetzt werden?')) {
                            const { error } = await supabase.from('fixtures').update({ status: 'cancelled' }).eq('id', f.id);
                            if (error) alert(error.message);
                            else loadTeamAdminData();
                          }
                        }}
                        className="bg-zinc-800 hover:bg-zinc-700 text-red-500 font-black italic uppercase tracking-widest py-3 rounded-xl transition-all border border-white/5 shadow-lg active:scale-95 flex items-center justify-center gap-2 text-[10px]"
                      >
                        <AlertCircle className="w-4 h-4" />
                        Absagen
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </SafeAreaWrapper>
  );
};
