import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Shield, 
  Users, 
  Calendar,
  Star, 
  QrCode, 
  ChevronRight,
  TrendingUp,
  Search,
  Loader2,
  AlertCircle,
  X,
  ArrowLeft,
  CheckCircle2,
  Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabaseService } from '../services/supabaseService';
import { Player, Fixture, Club, Team, PlayerStats } from '../types';
import { PlayerCard } from '../components/PlayerCard';
import { MatchCard } from '../components/MatchCard';

// --- MAIN DASHBOARD ---

export const Dashboard: React.FC = () => {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [playerData, setPlayerData] = useState<Player | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [topPlayers, setTopPlayers] = useState<Player[]>([]);
  const [loadingTopPlayers, setLoadingTopPlayers] = useState(true);
  const [checkins, setCheckins] = useState<string[]>(() => {
    try {
      if (profile) {
        const cached = localStorage.getItem(`checkins_${profile.id}`);
        return cached ? JSON.parse(cached) : [];
      }
    } catch (err) {
      console.error('Error reading checkins from localStorage:', err);
    }
    return [];
  });

  useEffect(() => {
    if (profile) {
      try {
        const cached = localStorage.getItem(`checkins_${profile.id}`);
        if (cached) {
          setCheckins(JSON.parse(cached));
        }
      } catch (err) {
        console.error('Error reading checkins from localStorage in useEffect:', err);
      }
    }
    loadDashboardData();
    loadTopPlayers();

    // Trigger deactivation of Gerersdorf players once for the admin
    if (isAdmin) {
      supabaseService.deactivateGerersdorfPlayers().then(res => {
        if (res?.success) {
          console.log('DEBUG: [ADMIN] FCU Gerersdorf players deactivation triggered successfully.');
        }
      });
    }
  }, [profile, isAdmin]);

  const [heroFixture, setHeroFixture] = useState<Fixture | null>(null);
  const [heroStatus, setHeroStatus] = useState<'live' | 'voting' | 'result' | 'none'>('none');
  const [mvpPlayer, setMvpPlayer] = useState<Player | null>(null);

  const loadDashboardData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Load all necessary data
      const [f, t, p] = await Promise.all([
        supabaseService.getFixtures(),
        supabaseService.getTeams(),
        supabaseService.getPlayers()
      ]);
      
      setFixtures(f); 
      setTeams(t);
      setPlayers(p);

      const now = new Date();
      let selectedHero: Fixture | null = null;
      let status: 'live' | 'voting' | 'result' | 'none' = 'none';
      let mvp: Player | null = null;

      // STRICT PRIORITY CHECK
      
      // 1. RECENT RESULT (Highest priority as it's the "News")
      const processedMatch = [...f]
        .filter(fixture => fixture.results_processed_at)
        .sort((a, b) => new Date(b.results_processed_at!).getTime() - new Date(a.results_processed_at!).getTime())[0];
      
      if (processedMatch) {
        selectedHero = processedMatch;
        status = 'result';
        
        // Fetch MVP
        const history = await supabaseService.getFixtureRatingHistory(processedMatch.id);
        if (history.length > 0) {
          const mvpEntry = history.reduce((prev, current) => 
            (prev.delta_overall > current.delta_overall) ? prev : current
          );
          mvp = p.find(player => player.id === mvpEntry.player_id) || null;
        }
      } 
      // 2. OPEN VOTING
      else {
        const votingMatch = f.find(fixture => {
          if (!fixture.voting_open_at || !fixture.voting_close_at) return false;
          const openAt = new Date(fixture.voting_open_at);
          const closeAt = new Date(fixture.voting_close_at);
          return now >= openAt && now <= closeAt && !fixture.results_processed_at;
        });

        if (votingMatch) {
          selectedHero = votingMatch;
          status = 'voting';
        } 
        // 3. LIVE MATCH
        else {
          const liveMatch = f.find(fixture => {
            const isLive = fixture.status === 'live';
            const kickoff = new Date(fixture.kickoff_at);
            const isStarted = now >= kickoff;
            return (isLive || (fixture.status === 'upcoming' && isStarted)) && !fixture.results_processed_at;
          });

          if (liveMatch) {
            selectedHero = liveMatch;
            status = 'live';
          }
        }
      }

      setHeroFixture(selectedHero);
      setHeroStatus(status);
      setMvpPlayer(mvp);
      
      // Debug log
      console.log('--- DASHBOARD HERO STATE ---');
      console.log('Status:', status);
      console.log('Fixture ID:', selectedHero?.id || 'none');
      console.log('---------------------------');

      // Load user check-ins
      const { data: userCheckins } = await supabaseService.getUserCheckins(profile.id);
      const checkinIds = userCheckins?.map(c => c.fixture_id) || [];
      setCheckins(checkinIds);
      
      if (profile.role === 'player') {
        const myPlayer = p.find(player => player.claimed_by_user_id === profile.id);
        if (myPlayer) setPlayerData(myPlayer);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderHeroBlock = () => {
    // 1. Result Hero
    if (heroStatus === 'result' && heroFixture) {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500/5 backdrop-blur-3xl border border-emerald-500/20 rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4">
            <div className="bg-emerald-500 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-3 h-3 text-black" />
              <span className="text-[10px] font-black text-black uppercase tracking-widest leading-none">RESULT BEREIT</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center w-full gap-6">
            {mvpPlayer && (
              <div className="w-full flex justify-center items-center h-[420px] -my-6">
                <div className="relative flex items-center justify-center pointer-events-none origin-center scale-[0.9]">
                  <PlayerCard player={mvpPlayer} />
                </div>
              </div>
            )}
            
            <div className="w-full space-y-6 text-center">
              <div className="space-y-1">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Top Spieler</h2>
                <div className="flex flex-col items-center gap-1">
                  <div className="text-sm font-black italic uppercase tracking-tight text-white">
                    {heroFixture.home_team?.clubs?.name} vs {heroFixture.away_team?.clubs?.name}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                    {heroFixture.home_team?.name}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    Runde {heroFixture.round_number || 1} • {new Date(heroFixture.kickoff_at).toLocaleDateString([], { day: '2-digit', month: 'long', year: 'numeric' })}
                  </div>
                </div>
                <p className="text-zinc-400 font-medium text-sm pt-2">{mvpPlayer?.full_name || 'Letztes Spiel'} hat am meisten überzeugt.</p>
              </div>

              <div className="flex items-center justify-center gap-3 py-3 bg-white/5 rounded-2xl border border-white/5 mx-auto max-w-[160px]">
                 <div className="flex items-center gap-3 whitespace-nowrap text-2xl font-black italic text-white tracking-tighter">
                   <span>{heroFixture.home_score}</span>
                   <span className="text-zinc-700">:</span>
                   <span>{heroFixture.away_score}</span>
                 </div>
              </div>

              <button 
                onClick={() => navigate(`/matches/${heroFixture.id}/result`)}
                className="w-full max-w-[320px] mx-auto bg-emerald-500 text-black font-black italic uppercase tracking-widest py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] active:scale-95"
              >
                ERGEBNIS ANSEHEN
              </button>
            </div>
          </div>
        </motion.div>
      );
    }

    // 2. Voting Hero
    if (heroStatus === 'voting' && heroFixture) {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/5 backdrop-blur-3xl border border-amber-500/20 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4">
            <div className="bg-amber-500 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg shadow-amber-500/20">
              <Star className="w-3 h-3 text-black fill-black" />
              <span className="text-[10px] font-black text-black uppercase tracking-widest leading-none">VOTING OPEN</span>
            </div>
          </div>

          <div className="space-y-4 text-center">
            <div className="space-y-1">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Deine Stimme zählt</h2>
              <p className="text-zinc-400 font-medium text-sm">Wer war dein Player of the Match?</p>
            </div>
            
            <div className="flex flex-col items-center gap-1 py-2">
              <div className="flex items-center justify-center gap-4 opacity-70">
                <span className="text-sm font-black italic uppercase text-white tracking-tight">{heroFixture.home_team?.clubs?.name}</span>
                <span className="text-zinc-700 font-black italic text-xs">VS</span>
                <span className="text-sm font-black italic uppercase text-white tracking-tight">{heroFixture.away_team?.clubs?.name}</span>
              </div>
              <div className="text-[9px] font-bold text-amber-500/80 uppercase tracking-widest">
                {heroFixture.home_team?.name} / {heroFixture.away_team?.name}
              </div>
            </div>

            <button 
              onClick={() => navigate(`/matches/${heroFixture.id}`)}
              className="w-full bg-amber-500 text-black font-black italic uppercase tracking-widest py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] active:scale-95"
            >
              <Star className="w-5 h-5 fill-black" />
              JETZT VOTEN
            </button>
          </div>
        </motion.div>
      );
    }

    // 3. Live Hero
    if (heroStatus === 'live' && heroFixture) {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/5 backdrop-blur-3xl border border-red-500/20 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4">
            <div className="bg-red-500 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg shadow-red-500/20">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">LIVE</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-6">
            <div className="flex items-center justify-center gap-8 w-full">
              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-white/5 p-3">
                  {heroFixture.home_team?.clubs?.logo_url ? (
                    <img src={heroFixture.home_team.clubs.logo_url} alt="" className="w-full h-full object-contain" />
                  ) : <Shield className="w-8 h-8 text-zinc-700" />}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs font-black italic uppercase text-white text-center line-clamp-1">{heroFixture.home_team?.clubs?.name}</span>
                  <span className="text-[8px] font-bold text-zinc-500 uppercase">{heroFixture.home_team?.name}</span>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-3 whitespace-nowrap text-4xl sm:text-5xl font-black italic tracking-tighter text-white">
                  <span>{heroFixture.home_score}</span>
                  <span className="text-zinc-700">-</span>
                  <span>{heroFixture.away_score}</span>
                </div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest italic">{heroFixture.match_phase === 'halftime' ? 'HZ' : heroFixture.match_phase === 'first_half' ? '1. HZ' : '2. HZ'}</div>
              </div>

              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-white/5 p-3">
                  {heroFixture.away_team?.clubs?.logo_url ? (
                    <img src={heroFixture.away_team.clubs.logo_url} alt="" className="w-full h-full object-contain" />
                  ) : <Shield className="w-8 h-8 text-zinc-700" />}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs font-black italic uppercase text-white text-center line-clamp-1">{heroFixture.away_team?.clubs?.name}</span>
                  <span className="text-[8px] font-bold text-zinc-500 uppercase">{heroFixture.away_team?.name}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => navigate(`/matches/${heroFixture.id}`)}
              className="w-full bg-white text-black font-black italic uppercase tracking-widest py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] active:scale-95"
            >
              ZUM SPIEL
            </button>
          </div>
        </motion.div>
      );
    }

    // 4. Empty State Hero
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-[3rem] p-10 text-center space-y-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800" />
        <div className="space-y-2">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-zinc-500">Keine Spiele aktiv</h2>
          <p className="text-zinc-600 font-medium">Aktuell finden keine Spiele statt. Schau später wieder vorbei!</p>
        </div>
        <button 
          onClick={() => navigate('/matches')}
          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black italic uppercase tracking-widest py-4 rounded-2xl border border-white/5 transition-all flex items-center justify-center gap-2"
        >
          <Calendar className="w-5 h-5" />
          MATCHES ANSEHEN
        </button>
      </motion.div>
    );
  };

  const loadTopPlayers = async () => {
    setLoadingTopPlayers(true);
    try {
      const top = await supabaseService.getTopPlayers(6);
      setTopPlayers(top);
    } catch (err) {
      console.error('Error loading top players:', err);
    } finally {
      setLoadingTopPlayers(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative text-white font-sans overflow-x-hidden bg-transparent">
      {/* Remove previous redundant dark overlay to restore App.tsx background */}

      {/* Header - Fixed Top Anchor */}
      <div className="fixed top-0 left-0 right-0 h-24 px-8 flex items-center justify-between bg-zinc-950/40 backdrop-blur-2xl z-50 border-b border-white/10">
        <div className="flex items-center">
          <img 
            src="https://upvzomofjjwaxkfogpuc.supabase.co/storage/v1/object/public/assets/logo/Logo1024.png" 
            alt="PLYRZ" 
            className="h-16 w-auto object-contain brightness-125 drop-shadow-[0_0_25px_rgba(16,185,129,0.4)]"
            
          />
        </div>
        
        <div className="flex items-center gap-5">
          {isAdmin && (
            <button 
              onClick={() => navigate('/admin')}
              className="w-10 h-10 bg-zinc-900 rounded-xl border border-white/10 flex items-center justify-center hover:border-emerald-500 hover:text-emerald-500 transition-all shadow-lg active:scale-95"
              title="Admin Panel"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}

          <div className="text-right hidden sm:block">
            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Angemeldet</div>
            <div className="text-xs font-bold text-white">{profile?.display_name}</div>
          </div>
          <div 
            onClick={() => navigate('/profile')}
            className="w-10 h-10 bg-zinc-900 rounded-full border border-white/10 overflow-hidden cursor-pointer hover:border-emerald-500 transition-all shadow-lg active:scale-95"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold uppercase text-xs">
                {profile?.display_name?.[0]}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area - Top Aligned */}
      <div className="relative z-10 w-full pt-[120px] pb-32">
        <div className="max-w-xl mx-auto px-5 space-y-12">
          
          {/* A. HERO SECTION (ONLY ONE) */}
          <section className="w-full">
            {renderHeroBlock()}
          </section>

          {/* B. MATCH LIST SECTION */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="space-y-0.5">
                <h2 className="text-sm font-black italic uppercase tracking-widest text-white">Spielplan</h2>
                <div className="h-1 w-12 bg-emerald-500/30 rounded-full" />
              </div>
              <button 
                onClick={() => navigate('/matches')}
                className="bg-zinc-900/40 hover:bg-zinc-800 text-emerald-500 text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full border border-white/5 transition-all"
              >
                SPIELPLAN
              </button>
            </div>

            <div className="grid gap-4">
              {fixtures
                .filter(f => f.id !== heroFixture?.id)
                .slice(0, 4)
                .map(f => (
                  <MatchCard 
                    key={f.id} 
                    fixture={f} 
                    onClick={() => navigate(`/matches/${f.id}`)}
                  />
                ))
              }
              
              {fixtures.filter(f => f.id !== heroFixture?.id).length === 0 && (
                <div className="py-12 text-center space-y-3 bg-zinc-900/10 rounded-[2rem] border border-dashed border-white/5">
                  <Calendar className="w-8 h-8 text-zinc-800 mx-auto" strokeWidth={1} />
                  <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Keine weiteren Termine</p>
                </div>
              )}
            </div>
          </section>

          {/* C. TOP PERFORMER CAROUSEL (NEW POSITION) */}
          <section className="space-y-6 overflow-hidden">
            <div className="flex items-center justify-between px-1">
              <div className="space-y-0.5">
                <h2 className="text-sm font-black italic uppercase tracking-widest text-white">Top Spieler</h2>
                <div className="h-1 w-12 bg-amber-500/30 rounded-full" />
              </div>
              <button 
                onClick={() => navigate('/leaderboard')}
                className="text-zinc-500 hover:text-white text-[9px] font-black uppercase tracking-widest transition-colors"
              >
                RANGLISTE
              </button>
            </div>
            
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-8 -mx-5 px-5">
              {topPlayers.slice(0, 6).map(p => (
                <div key={p.id} className="flex-shrink-0 w-[168px] h-[236px] relative">
                   <div className="absolute top-0 left-0 scale-[0.48] origin-top-left">
                    <PlayerCard 
                      player={p}
                      clubLogo={teams.find(t => t.id === p.team_id)?.clubs?.logo_url}
                      onClick={() => navigate(`/players/${p.id}`)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* D. OPTIONAL SECTIONS (BOTTOM ONLY) */}
          <div className="space-y-10 pt-4 opacity-90">
            {profile?.role === 'player' && playerData && (
              <section className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <div className="h-px flex-1 bg-white/5" />
                  <h2 className="text-[10px] font-black italic uppercase tracking-[0.2em] text-zinc-500">Deine Karte</h2>
                  <div className="h-px flex-1 bg-white/5" />
                </div>
                <div className="w-full flex justify-center items-center h-[420px] -my-10">
                  <div className="relative flex items-center justify-center scale-[0.9] origin-center">
                    <PlayerCard 
                      player={playerData} 
                      clubLogo={teams.find(t => t.id === playerData.team_id)?.clubs?.logo_url}
                      onClick={() => navigate(`/players/${playerData.id}`)}
                    />
                  </div>
                </div>
              </section>
            )}

            <div className="grid gap-10">
              {/* Stats Summary */}
              <section className="grid grid-cols-2 gap-4 pb-8">
                <div className="bg-zinc-900/10 p-5 rounded-3xl border border-white/5 flex flex-col justify-between h-24">
                  <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Stimmen Gesamt</div>
                  <div className="text-2xl font-black italic text-zinc-400">1.2k</div>
                </div>
                <div className="bg-zinc-900/10 p-5 rounded-3xl border border-white/5 flex flex-col justify-between h-24">
                  <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Ø Rating</div>
                  <div className="text-2xl font-black italic text-zinc-400">74.2</div>
                </div>
              </section>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
