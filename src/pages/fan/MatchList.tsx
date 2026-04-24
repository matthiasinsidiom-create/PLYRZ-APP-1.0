import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Shield, 
  ChevronRight,
  ChevronLeft,
  Loader2,
  Trophy,
  ArrowLeft,
  CheckCircle2,
  Timer
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../../services/supabaseService';
import { useAuth } from '../../context/AuthContext';
import { Fixture } from '../../types';

export const MatchList: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [maxRound, setMaxRound] = useState<number>(1);
  const [hasInitializedRound, setHasInitializedRound] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadFixtures();
  }, []);

  const loadFixtures = async () => {
    try {
      console.log('DEBUG: [MATCHES] Loading fixtures...');
      const f = await supabaseService.getFixtures();
      setFixtures(f);
      
      if (f.length > 0) {
        const rounds = f.map(fixture => fixture.round_number).filter(Boolean) as number[];
        if (rounds.length > 0) {
          const maxR = Math.max(...rounds);
          setMaxRound(maxR);
          console.log('DEBUG: [MATCHES] Max round found:', maxR);
          
          if (!hasInitializedRound) {
            // Find the "current" round: first round that has non-finished matches
            // or the last finished round if all are finished
            const liveOrUpcoming = f.find(fixture => fixture.status === 'live' || fixture.status === 'upcoming');
            let initialRound = 1;
            
            if (liveOrUpcoming && liveOrUpcoming.round_number) {
              initialRound = liveOrUpcoming.round_number;
              console.log('DEBUG: [MATCHES] Initializing to active round:', initialRound);
            } else {
              initialRound = maxR;
              console.log('DEBUG: [MATCHES] All matches finished, initializing to last round:', initialRound);
            }
            
            setSelectedRound(initialRound);
            setHasInitializedRound(true);
          }
        }
      }
      console.log('DEBUG: [MATCHES] Fixtures loaded:', f.length);
    } catch (err) {
      console.error('DEBUG: [MATCHES] Error loading fixtures:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMatchMinute = (kickoffAt: string) => {
    const kickoff = new Date(kickoffAt).getTime();
    const diff = Math.floor((now.getTime() - kickoff) / (1000 * 60));
    if (diff <= 0) return '1\'';
    if (diff > 90) return '90+\'';
    return `${diff}'`;
  };

  const filteredFixtures = fixtures
    .filter(f => (f.round_number || 1) === selectedRound)
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());

  useEffect(() => {
    if (!loading) {
      console.log(`DEBUG: [MATCHES] Selected Round: ${selectedRound}, Fixtures count: ${filteredFixtures.length}`);
    }
  }, [selectedRound, filteredFixtures.length, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white font-sans pb-24">
      {/* Round Header */}
      <div className="sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-50 border-b border-white/5 shadow-2xl">
        <div className="p-4 flex items-center justify-between max-w-2xl mx-auto">
          <img 
            src="https://upvzomofjjwaxkfogpuc.supabase.co/storage/v1/object/public/assets/logo/Logo1024.png" 
            alt="PLYRZ" 
            className="h-6 w-auto object-contain opacity-80"
            referrerPolicy="no-referrer"
          />
          
          <div className="flex items-center gap-6 bg-zinc-900/50 rounded-2xl px-4 py-2 border border-white/5 shadow-inner">
            <button 
              onClick={() => setSelectedRound(prev => Math.max(1, prev - 1))}
              disabled={selectedRound <= 1}
              className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 transition-all active:scale-90"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center min-w-[80px]">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600 leading-none mb-1">Spieltag</span>
              <span className="text-sm font-black italic uppercase tracking-tighter text-white">Runde {selectedRound}</span>
            </div>

            <button 
              onClick={() => setSelectedRound(prev => Math.min(maxRound, prev + 1))}
              disabled={selectedRound >= maxRound}
              className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 transition-all active:scale-90"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="w-6" /> {/* Spacer */}
        </div>
      </div>

      {/* Fixture List */}
      <div className="max-w-2xl mx-auto mt-2 px-4">
        <AnimatePresence mode="wait">
          <motion.div 
            key={selectedRound}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            {filteredFixtures.length > 0 ? (
              filteredFixtures.map((fixture) => {
                const isLive = fixture.status === 'live';
                const isFinished = fixture.status === 'finished';
                const isUpcoming = fixture.status === 'upcoming';
                const isCancelled = fixture.status === 'cancelled';
                const isVoting = isFinished && !fixture.results_processed_at && fixture.voting_close_at && new Date() < new Date(fixture.voting_close_at);

                return (
                  <button
                    key={fixture.id}
                    onClick={() => navigate(`/matches/${fixture.id}`)}
                    className={`w-full flex items-center justify-between gap-4 p-4 rounded-2xl transition-all active:scale-[0.98] relative overflow-hidden group border ${
                      isLive 
                        ? 'bg-red-500/5 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]' 
                        : isVoting
                        ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                        : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-900/60'
                    }`}
                  >
                    {isLive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />}
                    {isVoting && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}

                    {/* TEAMS STACKED */}
                    <div className="flex-1 flex flex-col gap-3 min-w-0">
                      {/* Home Team */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/5 shadow-lg">
                          {(fixture as any).home_team?.clubs?.logo_url ? (
                            <img src={(fixture as any).home_team.clubs.logo_url} alt="" className="w-5 h-5 object-contain" referrerPolicy="no-referrer" />
                          ) : <Shield className="w-4 h-4 text-zinc-600" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">
                            {(fixture as any).home_team?.name}
                          </span>
                          <span className="text-sm font-black italic uppercase tracking-tight text-zinc-100 truncate">
                            {(fixture as any).home_team?.clubs?.name}
                          </span>
                        </div>
                      </div>

                      {/* Away Team */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/5 shadow-lg">
                          {(fixture as any).away_team?.clubs?.logo_url ? (
                            <img src={(fixture as any).away_team.clubs.logo_url} alt="" className="w-5 h-5 object-contain" referrerPolicy="no-referrer" />
                          ) : <Shield className="w-4 h-4 text-zinc-600" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">
                            {(fixture as any).away_team?.name}
                          </span>
                          <span className="text-sm font-black italic uppercase tracking-tight text-zinc-100 truncate">
                            {(fixture as any).away_team?.clubs?.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SCORE / STATUS AREA */}
                    <div className="flex flex-col items-end justify-center min-w-[85px] border-l border-white/5 pl-4">
                      <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2 text-right">
                        {new Date(fixture.kickoff_at).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      </div>
                      {isLive ? (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1 bg-red-500 px-2 py-0.5 rounded-full">
                            <Timer className="w-3 h-3 text-white" />
                            <span className="text-[10px] font-black text-white">{getMatchMinute(fixture.kickoff_at)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-black italic tracking-tighter text-white">{fixture.home_score}</span>
                            <span className="text-zinc-600 font-bold">-</span>
                            <span className="text-2xl font-black italic tracking-tighter text-white">{fixture.away_score}</span>
                          </div>
                          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-red-500 animate-pulse">Live</span>
                        </div>
                      ) : isUpcoming ? (
                        <div className="flex flex-col items-end">
                          <span className="text-lg font-black italic text-white tracking-tighter">
                            {new Date(fixture.kickoff_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Beginn</span>
                        </div>
                      ) : isCancelled ? (
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Abgesagt</span>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-black italic tracking-tighter text-zinc-300">{fixture.home_score}</span>
                            <span className="text-zinc-700 font-bold">-</span>
                            <span className="text-xl font-black italic tracking-tighter text-zinc-300">{fixture.away_score}</span>
                          </div>
                          <span className={`text-[8px] font-black uppercase tracking-widest ${isVoting ? 'text-emerald-500 animate-pulse' : 'text-zinc-600'}`}>
                            {isVoting ? 'Voten' : 'Beendet'}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-24 text-center space-y-4">
                <div className="w-16 h-16 bg-zinc-900/50 rounded-3xl flex items-center justify-center mx-auto border border-white/5 backdrop-blur-sm">
                  <Calendar className="w-8 h-8 text-zinc-800" />
                </div>
                <p className="text-zinc-600 font-black italic uppercase tracking-[0.2em] text-[10px]">Keine Spiele in dieser Runde</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MatchList;
