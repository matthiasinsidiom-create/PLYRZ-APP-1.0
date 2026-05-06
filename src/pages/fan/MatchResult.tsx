import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Users,
  Loader2,
  Award,
  ChevronRight,
  Info,
  Calendar,
  Clock,
  Shield,
  MapPin,
  ThumbsUp,
  ThumbsDown,
  Star,
  Minus,
  Zap,
  Square,
  RefreshCw
} from 'lucide-react';
import SafeAreaWrapper from '../../components/SafeAreaWrapper';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Fixture, Player, PlayerStats, Team, Club, PlayerRatingHistory, MatchEvent } from '../../types';
import { PlayerCard } from '../../components/PlayerCard';
import { VotingCountdown } from '../../components/VotingCountdown';
import { calculateMatchScore } from '../../lib/score';

const safeFixed = (val: any, decimals: number = 1): string => {
  if (val === undefined || val === null || isNaN(Number(val))) return '0.0';
  return Number(val).toFixed(decimals);
};

interface RatingHistoryEntry extends PlayerRatingHistory {
  jersey_number?: number | null;
  lineup_role?: 'starter' | 'sub';
  players: Player & { teams: { name: string, clubs: { logo_url: string } } };
}

const DeltaBadge: React.FC<{ delta: number }> = ({ delta }) => {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  
  const colorClass = isPositive 
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
    : isNegative 
      ? 'text-red-400 bg-red-500/10 border-red-500/20' 
      : 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';

  const formattedDelta = safeFixed(delta);

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-black italic text-sm ${colorClass}`}>
      {isPositive && <TrendingUp className="w-4 h-4" />}
      {isNegative && <TrendingDown className="w-4 h-4" />}
      {!isPositive && !isNegative && <Minus className="w-4 h-4" />}
      <span className="tabular-nums">
        {isPositive ? `+${formattedDelta}` : formattedDelta}
      </span>
    </div>
  );
};

const EventBadges: React.FC<{ 
  goals: number; 
  yellows: number; 
  reds: number; 
  size?: 'sm' | 'md' 
}> = ({ goals, yellows, reds, size = 'md' }) => {
  if (goals === 0 && yellows === 0 && reds === 0) return null;
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[11px]';
  const gap = size === 'sm' ? 'gap-2' : 'gap-3';
  return (
    <div className={`flex items-center ${gap}`}>
      {goals > 0 && (
        <div className="flex items-center gap-1">
          <span className={size === 'sm' ? 'text-[10px]' : 'text-sm'}>⚽</span>
          <span className={`${textSize} font-black italic text-white tabular-nums`}>{goals}</span>
        </div>
      )}
      {yellows > 0 && (
        <div className="flex items-center gap-1">
          <span className={size === 'sm' ? 'text-[10px]' : 'text-sm'}>🟨</span>
          <span className={`${textSize} font-black italic text-white tabular-nums`}>{yellows}</span>
        </div>
      )}
      {reds > 0 && (
        <div className="flex items-center gap-1">
          <span className={size === 'sm' ? 'text-[10px]' : 'text-sm'}>🟥</span>
          <span className={`${textSize} font-black italic text-white tabular-nums`}>{reds}</span>
        </div>
      )}
    </div>
  );
};

const RankingRow: React.FC<{ entry: RatingHistoryEntry; rank?: number }> = ({ entry, rank }) => {
  const navigate = useNavigate();
  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      onClick={() => navigate(`/players/${entry.player_id}`)}
      className="flex items-center justify-between p-3 bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl group hover:bg-zinc-900/60 transition-all cursor-pointer active:scale-[0.98]"
    >
      <div className="flex items-center gap-3">
        {rank && (
          <span className="text-[10px] font-black italic text-zinc-700 w-4">{rank}</span>
        )}
        <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-zinc-800">
          <img 
            src={entry.players?.photo_url || "/assets/players/default.png"} 
            alt={entry.players?.name || "Player"} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black italic text-white uppercase tracking-tight leading-none mb-1.5">{entry.players?.name || 'Unbekannter Spieler'}</span>
          <EventBadges goals={entry.goal_count || 0} yellows={entry.yellow_count || 0} reds={entry.red_count || 0} size="sm" />
        </div>
      </div>
      <div className={`text-xs font-black italic tabular-nums ${(entry.delta_overall || 0) > 0 ? 'text-emerald-400' : (entry.delta_overall || 0) < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
        {(entry.delta_overall || 0) > 0 ? '+' : ''}{safeFixed(entry.delta_overall)}
      </div>
    </motion.div>
  );
};

const PerformancePanel: React.FC<{ entry: any }> = ({ entry }) => {
  if (!entry) {
    return (
      <div className="w-full bg-zinc-900/20 backdrop-blur-xl border border-white/5 p-6 pt-16 rounded-[2rem] relative z-0 flex flex-col items-center justify-center gap-1.5 min-h-[140px]">
        <Info className="w-5 h-5 text-zinc-700" />
        <p className="text-[9px] font-black italic text-zinc-600 uppercase tracking-[0.15em]">Keine Daten</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-zinc-900/60 backdrop-blur-2xl border border-white/10 p-6 pt-16 rounded-[2.5rem] relative z-0 shadow-2xl space-y-6 group-hover:bg-zinc-900/80 transition-all duration-300">
      {/* Rating Hero Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-end gap-2">
          <div className="flex flex-col">
            <span className="text-[8px] font-black italic text-zinc-500 uppercase tracking-widest leading-none mb-1">Bewertung</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black italic text-zinc-500 tabular-nums">{entry.old_overall}</span>
              <ChevronRight className="w-3 h-3 text-zinc-700" />
              <span className="text-3xl font-black italic text-white leading-none tracking-tighter tabular-nums">{entry.new_overall}</span>
            </div>
          </div>
        </div>
        <div className={`px-4 py-2 rounded-xl font-black italic text-lg shadow-lg border tabular-nums ${
          entry.delta_overall > 0 
            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/5' 
            : entry.delta_overall < 0 
              ? 'text-red-400 bg-red-500/10 border-red-500/20 shadow-red-500/5' 
              : 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20'
        }`}>
          {entry.delta_overall > 0 ? '+' : ''}{safeFixed(entry.delta_overall)}
        </div>
      </div>

      {/* Impact Tiles Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/5 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-1">
          <span className="text-[7px] font-black italic text-zinc-600 uppercase tracking-widest">Vote</span>
          <span className={`text-xs font-black italic tabular-nums ${entry.vote_impact > 0 ? 'text-emerald-400' : entry.vote_impact < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
            {entry.vote_impact > 0 ? '+' : ''}{safeFixed(entry.vote_impact)}
          </span>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-1">
          <span className="text-[7px] font-black italic text-zinc-600 uppercase tracking-widest">Spiel</span>
          <span className={`text-xs font-black italic tabular-nums ${entry.result_impact > 0 ? 'text-emerald-400' : entry.result_impact < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
            {entry.result_impact > 0 ? '+' : ''}{safeFixed(entry.result_impact)}
          </span>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-1">
          <span className="text-[7px] font-black italic text-zinc-600 uppercase tracking-widest">Events</span>
          <span className={`text-xs font-black italic tabular-nums ${entry.event_impact > 0 ? 'text-emerald-400' : entry.event_impact < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
            {entry.event_impact > 0 ? '+' : ''}{safeFixed(entry.event_impact)}
          </span>
        </div>
      </div>

      {/* Footer: Votes & Event Badges */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" title="Upvotes">
            <ThumbsUp className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-black italic text-zinc-400 tabular-nums">{entry.positive_votes || 0}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Neutral Votes">
            <div className="w-3 h-3 rounded-full bg-zinc-500" />
            <span className="text-[10px] font-black italic text-zinc-400 tabular-nums">{entry.neutral_votes || 0}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Downvotes">
            <ThumbsDown className="w-3 h-3 text-red-500" />
            <span className="text-[10px] font-black italic text-zinc-400 tabular-nums">{entry.negative_votes || 0}</span>
          </div>
        </div>
        <EventBadges goals={entry.goal_count} yellows={entry.yellow_count} reds={entry.red_count} size="sm" />
      </div>
    </div>
  );
};

const MatchResult: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [results, setResults] = useState<RatingHistoryEntry[]>([]);
  const [lineup, setLineup] = useState<any[]>([]);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [processing, setProcessing] = useState(false);
  const [autoProcessed, setAutoProcessed] = useState(false);

  // Auto-process for admins if voting is closed but results are missing
  useEffect(() => {
    const shouldAutoProcess = 
      id && 
      isAdmin && 
      fixture && 
      fixture.status === 'finished' && 
      !fixture.results_processed_at && 
      !processing && 
      !autoProcessed;

    if (shouldAutoProcess) {
      const closeAt = fixture.voting_close_at ? new Date(fixture.voting_close_at) : null;
      if (!closeAt || new Date() >= closeAt) {
        console.log(`DEBUG: [UI] Admin detected on finished result page. Auto-triggering calculation for ${id}...`);
        setAutoProcessed(true);
        handleManualProcess();
      }
    }
  }, [id, isAdmin, fixture?.status, fixture?.results_processed_at, processing, autoProcessed]);

  useEffect(() => {
    if (id) {
      loadData();
      
      // If results are not processed yet, poll every 10 seconds
      const interval = setInterval(() => {
        if (!fixture?.results_processed_at) {
          console.log(`DEBUG: [UI] Polling for results for fixture ${id}...`);
          loadData();
        }
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [id, fixture?.results_processed_at]);

  const loadData = async () => {
    setLoading(true);
    try {
      try {
        await supabase.auth.getSession();
      } catch (e) {
        await new Promise(r => setTimeout(r, 500));
        await supabase.auth.getSession().catch(() => {});
      }
      
      const [fixtureData, resultsData, lineupData, eventsData] = await Promise.all([
        supabaseService.getFixtureById(id!),
        supabaseService.getFixtureRatingHistory(id!),
        supabaseService.getFixtureLineupWithPlayers(id!),
        supabaseService.getMatchEvents(id!)
      ]);
      
      setFixture(fixtureData);
      setMatchEvents(eventsData);
      
      const mergedResults = resultsData.map((result: any) => {
        const lineupEntry = lineupData.find((l: any) => l.player_id === result.player_id);
        // Use final_delta if available (Rating 3.0), fallback to delta_overall
        const displayDelta = result.final_delta !== undefined && result.final_delta !== null 
          ? result.final_delta 
          : result.delta_overall;

        return {
          ...result,
          delta_overall: displayDelta,
          jersey_number: lineupEntry?.jersey_number || result.jersey_number,
          lineup_role: lineupEntry?.lineup_role || result.lineup_role
        };
      });
      
      setResults(mergedResults);
      setLineup(lineupData);
    } catch (err) {
      console.error('Error loading match results:', err);
    } finally {
      setLoading(false);
    }
  };

  const mvp = useMemo(() => {
    if (results.length === 0) return null;
    
    // Prioritize marked is_mvp from DB
    const markedMVP = results.find(r => r.is_mvp);
    if (markedMVP) return markedMVP;

    // Fallback to sorting logic
    return [...results].sort((a, b) => {
      const bScore = b.mvp_score || b.delta_overall || 0;
      const aScore = a.mvp_score || a.delta_overall || 0;
      if (bScore !== aScore) return bScore - aScore;
      
      const bVotes = b.positive_votes || 0;
      const aVotes = a.positive_votes || 0;
      if (bVotes !== aVotes) return bVotes - aVotes;
      
      return (b.new_overall || 0) - (a.new_overall || 0);
    })[0];
  }, [results]);

  const top5 = useMemo(() => {
    return [...results]
      .sort((a, b) => {
        const bScore = b.mvp_score || b.delta_overall || 0;
        const aScore = a.mvp_score || a.delta_overall || 0;
        return bScore - aScore;
      })
      .slice(0, 5);
  }, [results]);

  const biggestLosses = useMemo(() => {
    return [...results]
      .filter(r => r.delta_overall < 0)
      .sort((a, b) => a.delta_overall - b.delta_overall)
      .slice(0, 3);
  }, [results]);

  const teamBreakdown = useMemo(() => {
    if (!fixture || lineup.length === 0) return { home: [], away: [] };
    
    const home = lineup
      .filter(entry => entry.team_id === fixture.home_team_id)
      .map(entry => {
        const result = results.find(r => r.player_id === entry.player_id);
        return {
          ...entry,
          // Spread result fields into the top level for PerformancePanel
          ...result,
          result // keep full nested result just in case
        };
      })
      .sort((a, b) => (b.delta_overall || 0) - (a.delta_overall || 0));

    const away = lineup
      .filter(entry => entry.team_id === fixture.away_team_id)
      .map(entry => {
        const result = results.find(r => r.player_id === entry.player_id);
        return {
          ...entry,
          // Spread result fields into the top level for PerformancePanel
          ...result,
          result // keep full nested result just in case
        };
      })
      .sort((a, b) => (b.delta_overall || 0) - (a.delta_overall || 0));

    return { home, away };
  }, [fixture, lineup, results]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="relative"
          >
            <Loader2 className="w-12 h-12 text-emerald-500" />
          </motion.div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-zinc-500 font-black italic uppercase tracking-[0.3em] text-[10px] animate-pulse">
            Lade Spielergebnisse
          </p>
          <div className="w-32 h-1 bg-zinc-900 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-emerald-500"
              animate={{ x: [-128, 128] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Prioritize results and skip pending state if results exist
  const showResults = (results.length > 0 || (fixture?.results_processed_at && lineup.length === 0)) && fixture?.results_processed_at;

  const handleManualProcess = async () => {
    if (!id || processing) return;
    setProcessing(true);
    try {
      await supabaseService.processFixtureRatings(id);
      await loadData();
    } catch (err) {
      console.error('Manual processing failed:', err);
    } finally {
      setProcessing(false);
    }
  };

  if (!fixture || !showResults) {
    const now = new Date();
    const openAt = fixture?.voting_open_at ? new Date(fixture.voting_open_at) : null;
    const closeAt = fixture?.voting_close_at ? new Date(fixture.voting_close_at) : null;
    const isVotingOpen = fixture && (!openAt || now >= openAt) && (!closeAt || now <= closeAt);

    return (
      <div className="min-h-screen bg-transparent text-white p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full space-y-12 text-center">
          <div className="relative mx-auto w-32 h-32">
            <div className="absolute inset-0 bg-emerald-500/20 blur-[60px] rounded-full animate-pulse" />
            <div className="relative w-full h-full bg-zinc-900 rounded-[2.5rem] border border-white/5 flex items-center justify-center shadow-2xl">
              {isVotingOpen ? (
                <Clock className="w-12 h-12 text-emerald-500" />
              ) : (
                <Info className="w-12 h-12 text-zinc-600" />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none">
              {isVotingOpen ? 'Voting läuft' : 'Ergebnisse ausstehend'}
            </h2>
            
            {/* Show Current Score even if results are pending */}
            {fixture && (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="text-3xl font-black italic tracking-tighter flex items-center gap-3 text-white opacity-80">
                  {(() => {
                    const { homeScore, awayScore } = calculateMatchScore(fixture, (fixture as any).match_events || []);
                    return (
                      <>
                        <span>{homeScore}</span>
                        <span className="text-zinc-800">:</span>
                        <span>{awayScore}</span>
                      </>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2 opacity-60">
                   <span className="text-[10px] font-black italic uppercase tracking-tight text-zinc-400">{(fixture as any).home_team?.clubs?.name}</span>
                   <span className="text-zinc-700 text-[8px] font-black uppercase">VS</span>
                   <span className="text-[10px] font-black italic uppercase tracking-tight text-zinc-400">{(fixture as any).away_team?.clubs?.name}</span>
                </div>
              </div>
            )}

            <p className="text-zinc-500 leading-relaxed text-sm">
              {isVotingOpen 
                ? 'Die Community stimmt derzeit über dieses Spiel ab. Die Ergebnisse werden automatisch berechnet, sobald das Voting-Fenster schließt.'
                : 'Die Spielergebnisse werden derzeit verarbeitet. Schau in wenigen Augenblicken wieder vorbei, um die finalen Ratings und den MVP zu sehen.'}
            </p>
          </div>

          {isVotingOpen && closeAt && (
            <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl">
              <p className="text-[10px] font-black italic text-zinc-500 uppercase tracking-[0.2em] mb-6">Voting endet in</p>
              <VotingCountdown 
                closeAt={fixture.voting_close_at!} 
                onClose={() => window.location.reload()}
              />
            </div>
          )}

          <div className="flex flex-col gap-4 pt-4">
            {isVotingOpen && (
              <button 
                onClick={() => navigate(`/matches/${id}`)}
                className="w-full bg-emerald-500 text-black font-black italic uppercase tracking-tighter py-5 rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-emerald-500/20 active:scale-[0.98]"
              >
                <Trophy className="w-5 h-5" /> Zum Voting
              </button>
            )}

            {!isVotingOpen && !fixture?.results_processed_at && isAdmin && (
              <button 
                onClick={handleManualProcess}
                disabled={processing}
                className="w-full bg-zinc-800 text-white font-bold py-5 rounded-2xl hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 border border-white/5 active:scale-[0.98]"
              >
                {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                {processing ? 'Wird berechnet...' : 'Ergebnisse manuell berechnen'}
              </button>
            )}

            <button 
              onClick={() => navigate('/matches')}
              className="w-full bg-zinc-900/50 text-zinc-400 font-bold py-5 rounded-2xl hover:bg-zinc-900 transition-all border border-white/5 active:scale-[0.98]"
            >
              ZUR ÜBERSICHT
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If we reach here, we have results or it's processed with no lineup
  if (fixture?.results_processed_at && results.length === 0) {
    return (
      <div className="min-h-screen bg-transparent text-white p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full space-y-8 text-center bg-zinc-900/40 backdrop-blur-xl border border-white/5 p-12 rounded-[3rem]">
          <div className="w-20 h-20 bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Info className="w-10 h-10 text-zinc-600" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter leading-none">Keine Daten</h2>
            <p className="text-zinc-500 font-medium">Für dieses Spiel wurden keine Bewertungen oder Statistiken erfasst.</p>
          </div>
          <button 
            onClick={() => navigate('/matches')}
            className="w-full bg-emerald-500 text-black font-black italic uppercase tracking-tight py-5 rounded-2xl hover:bg-emerald-400 transition-all"
          >
            ZUR ÜBERSICHT
          </button>
        </div>
      </div>
    );
  }

  const homeWinner = (fixture.home_score || 0) > (fixture.away_score || 0);
  const awayWinner = (fixture.away_score || 0) > (fixture.home_score || 0);

  return (
    <SafeAreaWrapper>
    <div className="min-h-screen bg-transparent text-white font-sans pb-28 selection:bg-emerald-500/30 overflow-x-hidden w-full max-w-full">
      {/* Premium Header */}
      <div className="relative pt-3 pb-10 overflow-hidden">
        <div className="relative z-10 max-w-xl mx-auto px-4 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => navigate(-1)}
              className="p-2.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl hover:bg-white/10 transition-all group active:scale-90"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
            </button>
            
            <div className="flex flex-col items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/80 rounded-full border border-white/5 backdrop-blur-md">
                <div className="w-1 h-1 bg-zinc-500 rounded-full" />
                <span className="text-[8px] font-black italic uppercase text-zinc-400 tracking-[0.2em]">Spielergebnis</span>
              </div>
            </div>

            <div className="w-10" />
          </div>

          <div className="flex items-center justify-between gap-2 py-2">
            <div className={`flex-1 flex flex-col items-center text-center gap-3 transition-all duration-700 ${homeWinner ? 'scale-105' : 'opacity-40'}`}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.8, x: -15 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                className={`relative w-16 h-16 sm:w-24 sm:h-24 bg-zinc-900/40 rounded-2xl p-3 sm:p-5 border ${homeWinner ? 'border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-white/5'} flex items-center justify-center backdrop-blur-sm`}
              >
                <img 
                  src={fixture.home_team?.clubs?.logo_url || "/assets/clubs/rw.png"} 
                  alt="" 
                  className="w-full h-full object-contain drop-shadow-xl" 
                  referrerPolicy="no-referrer" 
                />
              </motion.div>
              <h3 className="text-[10px] sm:text-sm font-black italic uppercase tracking-tight line-clamp-2 leading-tight max-w-[80px] sm:max-w-none">
                {fixture.home_team?.clubs?.name || fixture.home_team?.name}
              </h3>
            </div>

            <div className="flex flex-col items-center gap-3">
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center"
              >
                <div className="text-5xl sm:text-7xl font-black italic tracking-tighter flex items-center gap-3 sm:gap-6 text-white leading-none">
                  {(() => {
                    const { homeScore, awayScore } = calculateMatchScore(fixture, matchEvents);
                    return (
                      <>
                        <span className={homeWinner ? 'text-white' : 'text-zinc-500'}>{homeScore}</span>
                        <span className="text-zinc-800 opacity-30">:</span>
                        <span className={awayWinner ? 'text-white' : 'text-zinc-500'}>{awayScore}</span>
                      </>
                    );
                  })()}
                </div>
              </motion.div>
              
              <div className="flex flex-col items-center gap-1.5">
                <div className="px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  <span className="text-[8px] font-black italic uppercase text-emerald-500 tracking-[0.15em]">Beendet</span>
                </div>
              </div>
            </div>

            <div className={`flex-1 flex flex-col items-center text-center gap-3 transition-all duration-700 ${awayWinner ? 'scale-105' : 'opacity-40'}`}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.8, x: 15 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                className={`relative w-16 h-16 sm:w-24 sm:h-24 bg-zinc-900/40 rounded-2xl p-3 sm:p-5 border ${awayWinner ? 'border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-white/5'} flex items-center justify-center backdrop-blur-sm`}
              >
                <img 
                  src={fixture.away_team?.clubs?.logo_url || "/assets/clubs/rw.png"} 
                  alt="" 
                  className="w-full h-full object-contain drop-shadow-xl" 
                  referrerPolicy="no-referrer" 
                />
              </motion.div>
              <h3 className="text-[10px] sm:text-sm font-black italic uppercase tracking-tight line-clamp-2 leading-tight max-w-[80px] sm:max-w-none">
                {fixture.away_team?.clubs?.name || fixture.away_team?.name}
              </h3>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 space-y-16 mt-4 relative z-10">
        {/* TOP PERFORMER (MVP) */}
        {mvp && (
          <motion.section 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="flex flex-col items-center relative py-12"
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-full max-w-sm aspect-square bg-amber-500/10 blur-[140px] rounded-full animate-pulse" />
            </div>

            <div className="relative z-10 flex flex-col items-center w-full">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-3 px-6 py-2 bg-gradient-to-r from-amber-300 to-amber-600 text-black rounded-full shadow-[0_0_30px_rgba(251,191,36,0.3)] mb-12 border border-amber-200/50"
              >
                <Star className="w-4 h-4 fill-black" />
                <span className="text-[10px] font-black italic uppercase tracking-[0.3em]">Top Spieler</span>
              </motion.div>

              <div className="flex flex-col items-center w-full">
                <div className="relative mb-16 w-full flex flex-col items-center justify-center py-6">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-amber-500/20 blur-[50px] rounded-full animate-pulse z-0" />
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, type: "spring", damping: 15 }}
                    className="z-20 w-full flex items-center justify-center"
                  >
                    <div className="relative flex items-center justify-center origin-top scale-[0.8] sm:scale-[0.9] md:scale-100 -mb-[98px] sm:-mb-[49px] md:mb-0">
                      <PlayerCard 
                        player={mvp.players || { name: 'Unbekannt', id: mvp.player_id, photo_url: null, position: 'Abwehr' }} 
                        clubLogo={mvp.players?.teams?.clubs?.logo_url}
                        jerseyNumber={mvp.jersey_number}
                        lineupRole={mvp.lineup_role}
                        isTopPerformer={true}
                        onClick={() => navigate(`/players/${mvp.player_id}`)}
                        className="shadow-[0_20px_60px_rgba(251,191,36,0.2)] border-2 border-amber-500/30"
                      />
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 }}
                        className="absolute -right-6 -top-6 z-30"
                      >
                        <div className="bg-gradient-to-br from-amber-300 to-amber-600 text-black px-4 py-2 rounded-xl font-black italic text-2xl shadow-2xl border-4 border-zinc-950 flex items-center gap-1.5">
                          <TrendingUp className="w-6 h-6" />
                          +{safeFixed(mvp.delta_overall)}
                        </div>
                      </motion.div>

                      {/* MVP Event Badges */}
                      {(mvp.goal_count > 0 || mvp.yellow_count > 0 || mvp.red_count > 0) && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.8 }}
                          className="absolute -bottom-[80px] left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-5 py-2.5 bg-zinc-900 border border-white/10 rounded-full shadow-2xl"
                        >
                          <EventBadges goals={mvp.goal_count} yellows={mvp.yellow_count} reds={mvp.red_count} size="md" />
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                </div>

                <div className="w-full bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black italic text-zinc-500 uppercase tracking-[0.2em]">Bewertung</p>
                      <div className="text-5xl font-black italic text-white tracking-tighter leading-none">{mvp.new_overall}</div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-[10px] font-black italic text-zinc-500 uppercase tracking-[0.2em]">Anstieg</p>
                      <div className="text-2xl font-black italic text-emerald-400 tracking-tighter leading-none">+{safeFixed(mvp.delta_overall)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col bg-white/5 p-4 rounded-2xl border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ThumbsUp className="w-3 h-3 text-emerald-500" />
                          <span className="text-[8px] font-black italic text-zinc-500 uppercase tracking-widest">Votes</span>
                        </div>
                        <span className="text-lg font-black italic text-white">{mvp.votes_up}</span>
                      </div>
                      <div className="text-[10px] font-black italic text-zinc-500">
                        Impact: +{safeFixed(mvp.vote_impact, 2)}
                      </div>
                    </div>
                    <div className="flex flex-col bg-white/5 p-4 rounded-2xl border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Award className="w-3 h-3 text-amber-500" />
                          <span className="text-[8px] font-black italic text-zinc-500 uppercase tracking-widest">Ergebnis</span>
                        </div>
                        <span className="text-lg font-black italic text-white">+{safeFixed(mvp.result_impact)}</span>
                      </div>
                      <div className="text-[10px] font-black italic text-zinc-500">
                        Match-Bonus
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* RANKINGS SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* TOP 5 RANKING */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black italic text-zinc-500 uppercase tracking-[0.3em]">Top 5 Ranking</h3>
              <TrendingUp className="w-3 h-3 text-emerald-500" />
            </div>
            <div className="space-y-3">
              {top5.map((entry, i) => (
                <RankingRow key={entry.player_id} entry={entry} rank={i + 1} />
              ))}
            </div>
          </section>

          {/* BIGGEST LOSSES */}
          {biggestLosses.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black italic text-red-500/50 uppercase tracking-[0.3em]">Größte Verluste</h3>
                <TrendingDown className="w-3 h-3 text-red-500/50" />
              </div>
              <div className="space-y-3">
                {biggestLosses.map((entry) => (
                  <RankingRow key={entry.player_id} entry={entry} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* TEAM BREAKDOWN SECTIONS */}
        <div className="space-y-24 pt-12">
          {/* Home Team Section */}
          <section className="space-y-10">
            <div className="px-1">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 bg-zinc-900/50 rounded-xl p-2.5 border ${homeWinner ? 'border-emerald-500/30 shadow-xl shadow-emerald-500/5' : 'border-white/10'} backdrop-blur-xl`}>
                  <img 
                    src={fixture.home_team?.clubs?.logo_url || "/assets/clubs/rw.png"} 
                    alt="" 
                    className="w-full h-full object-contain" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">
                    {fixture.home_team?.clubs?.name || fixture.home_team?.name}
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[8px] font-black italic text-zinc-500 uppercase tracking-[0.15em]">Heim-Leistung</p>
                    <span className="w-0.5 h-0.5 bg-zinc-800 rounded-full" />
                    <span className="text-[8px] font-black italic text-zinc-400 uppercase tracking-[0.15em]">{teamBreakdown.home.length} Spieler</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-y-16">
              {teamBreakdown.home.map((entry, index) => (
                <motion.div 
                  key={entry.player_id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="flex flex-col items-center group w-full"
                >
                  <div className="w-full flex justify-center items-center">
                    <div className="relative flex justify-center items-center origin-top scale-[0.8] sm:scale-[0.85] group-hover:scale-[0.85] sm:group-hover:scale-[0.9] transition-transform duration-500 -mb-[98px] sm:-mb-[73px] z-10">
                      <PlayerCard 
                        player={entry.players || { name: 'Unbekannt', id: entry.player_id, photo_url: null, position: 'Abwehr' }} 
                        clubLogo={entry.players?.teams?.clubs?.logo_url}
                        jerseyNumber={entry.jersey_number}
                        lineupRole={entry.lineup_role}
                        onClick={() => navigate(`/players/${entry.player_id}`)}
                        className="shadow-2xl"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4 w-full flex justify-center items-center">
                    <PerformancePanel entry={entry} />
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Away Team Section */}
          <section className="space-y-10">
            <div className="px-1">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 bg-zinc-900/50 rounded-xl p-2.5 border ${awayWinner ? 'border-emerald-500/30 shadow-xl shadow-emerald-500/5' : 'border-white/10'} backdrop-blur-xl`}>
                  <img 
                    src={fixture.away_team?.clubs?.logo_url || "/assets/clubs/rw.png"} 
                    alt="" 
                    className="w-full h-full object-contain" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">
                    {fixture.away_team?.clubs?.name || fixture.away_team?.name}
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[8px] font-black italic text-zinc-500 uppercase tracking-[0.15em]">Gast-Leistung</p>
                    <span className="w-0.5 h-0.5 bg-zinc-800 rounded-full" />
                    <span className="text-[8px] font-black italic text-zinc-400 uppercase tracking-[0.15em]">{teamBreakdown.away.length} Spieler</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-y-16">
              {teamBreakdown.away.map((entry, index) => (
                <motion.div 
                  key={entry.player_id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="flex flex-col items-center group w-full"
                >
                  <div className="w-full flex justify-center items-center">
                    <div className="relative flex justify-center items-center origin-top scale-[0.8] sm:scale-[0.85] group-hover:scale-[0.85] sm:group-hover:scale-[0.9] transition-transform duration-500 -mb-[98px] sm:-mb-[73px] z-10">
                      <PlayerCard 
                        player={entry.players || { name: 'Unbekannt', id: entry.player_id, photo_url: null, position: 'Abwehr' }} 
                        clubLogo={entry.players?.teams?.clubs?.logo_url}
                        jerseyNumber={entry.jersey_number}
                        lineupRole={entry.lineup_role}
                        onClick={() => navigate(`/players/${entry.player_id}`)}
                        className="shadow-2xl"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4 w-full flex justify-center items-center">
                    <PerformancePanel entry={entry} />
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
    </SafeAreaWrapper>
  );
};

export default MatchResult;
