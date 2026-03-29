import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Clock, 
  Shield, 
  Loader2, 
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  X,
  Trophy,
  Users,
  QrCode
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { useAuth } from '../../context/AuthContext';
import { Fixture, Player, PlayerStats, Team } from '../../types';
import { PlayerCard } from '../../components/PlayerCard';
import { PlayerVoteCard } from '../../components/PlayerVoteCard';
import { SwipeVotingOverlay } from '../../components/SwipeVotingOverlay';

interface LineupEntry {
  id: string;
  fixture_id: string;
  player_id: string;
  team_id: string;
  position: string;
  shirt_number: number;
  lineup_role: string;
  players: Player & { player_stats: PlayerStats[] };
  teams: {
    name: string;
    clubs: {
      name: string;
    };
  };
}

export const MatchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [lineup, setLineup] = useState<LineupEntry[]>([]);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [checkinCode, setCheckinCode] = useState('');
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinError, setCheckinError] = useState('');
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});
  const [votingMode, setVotingMode] = useState(false);
  const [votingLoading, setVotingLoading] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessed, setIsProcessed] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [showSwipeOverlay, setShowSwipeOverlay] = useState(false);

  useEffect(() => {
    if (id && profile) {
      loadData();
    }
  }, [id, profile]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      console.log(`DEBUG: [UI] Loading data for fixture ${id}...`);
      const [f, l, v, c, history] = await Promise.all([
        supabaseService.getFixtureById(id),
        supabaseService.getFixtureLineupWithPlayers(id),
        profile ? supabaseService.getUserVotesForFixture(profile.id, id) : Promise.resolve([]),
        profile ? supabaseService.getUserCheckins(profile.id) : Promise.resolve({ data: [] }),
        supabaseService.getFixtureRatingHistory(id)
      ]);

      setFixture(f);
      setLineup(l);
      setIsProcessed(history.length > 0);
      setProcessedCount(history.length);
      
      console.log(`DEBUG: [UI] MatchDetail loaded ${l.length} lineup entries. Processed: ${history.length > 0}`);
      
      const voteMap: Record<string, 'up' | 'down'> = {};
      v.forEach((vote: any) => {
        voteMap[vote.player_id] = vote.vote;
      });
      setUserVotes(voteMap);

      // Check if user is checked in
      if (c.data) {
        const checkedIn = c.data.some((checkin: any) => checkin.fixture_id === id);
        setIsCheckedIn(checkedIn);
      }
    } catch (err) {
      console.error('Error loading match detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !profile) return;
    
    setCheckinLoading(true);
    setCheckinError('');
    
    try {
      await supabaseService.createMatchCheckin(id, checkinCode);
      setIsCheckedIn(true);
      setShowCheckinModal(false);
      
      // Cache check-in status
      try {
        const cached = localStorage.getItem(`checkins_${profile.id}`);
        const checkinIds = cached ? JSON.parse(cached) : [];
        if (!checkinIds.includes(id)) {
          checkinIds.push(id);
          localStorage.setItem(`checkins_${profile.id}`, JSON.stringify(checkinIds));
        }
      } catch (err) {
        console.error('Error updating cached checkins:', err);
      }
    } catch (err: any) {
      console.error('Check-in error:', err);
      setCheckinError(err.message || 'Invalid check-in code. Please try again.');
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleVote = async (playerId: string, vote: 'up' | 'down') => {
    if (!id || !profile || !isCheckedIn) return;
    
    // If already voted this way, do nothing
    if (userVotes[playerId] === vote) return;

    setVotingLoading(playerId);
    try {
      await supabaseService.submitPlayerVote(id, playerId, vote);
      setUserVotes(prev => ({ ...prev, [playerId]: vote }));
    } catch (err) {
      console.error('Voting error:', err);
    } finally {
      setVotingLoading(null);
    }
  };

  const handleProcessResults = async () => {
    if (!id) return;
    console.log(`DEBUG: [UI] Admin ${profile?.display_name} triggered result processing for ${id}`);
    setIsProcessing(true);
    try {
      const results = await supabaseService.processFixtureRatings(id);
      console.log(`DEBUG: [UI] Processing complete. ${results.length} players updated.`);
      setIsProcessed(true);
      setProcessedCount(results.length);
      alert(`Match results processed successfully! ${results.length} players updated.`);
      navigate(`/matches/${id}/result`);
    } catch (err) {
      console.error('Error processing results:', err);
      alert(err instanceof Error ? err.message : 'Failed to process results');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!fixture) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-zinc-800 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Match not found</h2>
        <button 
          onClick={() => navigate('/matches')}
          className="text-emerald-500 font-bold uppercase tracking-widest text-xs"
        >
          Back to Matches
        </button>
      </div>
    );
  }

  const homePlayers = lineup.filter(entry => entry.team_id === fixture.home_team_id);
  const awayPlayers = lineup.filter(entry => entry.team_id === fixture.away_team_id);

  return (
    <div className="min-h-screen bg-transparent text-white font-sans pb-32">
      {/* Header */}
      <div className="p-6 flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-50 border-b border-white/5">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/matches')}
            className="p-2 hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-zinc-400" />
          </button>
          <h1 className="text-xl font-black italic tracking-tighter uppercase">Match Detail</h1>
        </div>
        <div className="flex items-center gap-2">
          <img 
            src="/assets/plyrzlogo.png" 
            alt="PLYRZ Logo" 
            className="h-24 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      {/* Match Info Card */}
      <div className="p-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
          
          <div className="flex items-center justify-between text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-8 relative z-10">
            <div className="flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              {new Date(fixture.kickoff_at).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              {new Date(fixture.kickoff_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 sm:gap-8 mb-8 relative z-10">
            <div className="flex-1 text-center space-y-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-zinc-800 rounded-3xl mx-auto flex items-center justify-center shadow-2xl border border-white/5 overflow-hidden">
                {(fixture as any).home_team?.clubs?.logo_url ? (
                  <img 
                    src={(fixture as any).home_team.clubs.logo_url} 
                    alt="" 
                    className="w-10 h-10 sm:w-14 sm:h-14 object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-zinc-600" />
                )}
              </div>
              <div className="space-y-1">
                <div className="text-sm sm:text-lg font-black text-white italic uppercase tracking-tight line-clamp-1">
                  {(fixture as any).home_team?.clubs?.name}
                </div>
                <p className="text-[8px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest line-clamp-1">
                  {(fixture as any).home_team?.name}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl sm:text-4xl font-black italic text-white tracking-tighter">
                {fixture.status === 'finished' ? `${fixture.home_score} - ${fixture.away_score}` : 'VS'}
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className={`text-[8px] sm:text-[10px] font-black uppercase tracking-tighter px-2 sm:px-3 py-1 rounded-full ${
                  fixture.status === 'finished' ? 'bg-zinc-800 text-zinc-400' : 
                  fixture.status === 'live' ? 'bg-red-500 text-white animate-pulse' : 
                  'bg-emerald-500/10 text-emerald-500'
                }`}>
                  {fixture.status}
                </div>
                {isProcessed && (
                  <div className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-2 h-2" /> Processed
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 text-center space-y-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-zinc-800 rounded-3xl mx-auto flex items-center justify-center shadow-2xl border border-white/5 overflow-hidden">
                {(fixture as any).away_team?.clubs?.logo_url ? (
                  <img 
                    src={(fixture as any).away_team.clubs.logo_url} 
                    alt="" 
                    className="w-10 h-10 sm:w-14 sm:h-14 object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-zinc-600" />
                )}
              </div>
              <div className="space-y-1">
                <div className="text-sm sm:text-lg font-black text-white italic uppercase tracking-tight line-clamp-1">
                  {(fixture as any).away_team?.clubs?.name}
                </div>
                <p className="text-[8px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest line-clamp-1">
                  {(fixture as any).away_team?.name}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 flex items-center justify-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest relative z-10">
            <MapPin className="w-3 h-3" />
            {fixture.venue_name}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 space-y-4">
        {/* Admin Processing Button - Always visible to admins for finished matches */}
        {isAdmin && fixture.status === 'finished' && (
          <button 
            onClick={handleProcessResults}
            disabled={isProcessing}
            className={`w-full font-black italic uppercase tracking-tighter py-4 rounded-2xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 mb-4 ${
              isProcessed 
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-white/5' 
                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20 shadow-lg'
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Trophy className="w-5 h-5" />
            )}
            {isProcessing ? 'Processing Match Results...' : isProcessed ? 'Reprocess Match Results' : 'Process Match Results'}
          </button>
        )}

        {!isCheckedIn ? (
          <button 
            onClick={() => setShowCheckinModal(true)}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black italic uppercase tracking-tighter py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <QrCode className="w-5 h-5" />
            Check-in to Vote
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-center gap-2 text-emerald-500 bg-emerald-500/10 py-3 rounded-2xl border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-black italic uppercase tracking-tighter">Checked In</span>
            </div>
            
            {fixture.status === 'finished' && !votingMode && !isProcessed && (
              <button 
                onClick={() => {
                  setVotingMode(true);
                  setShowSwipeOverlay(true);
                }}
                className="w-full bg-white hover:bg-zinc-200 text-black font-black italic uppercase tracking-tighter py-4 rounded-2xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Trophy className="w-5 h-5" />
                Start Swipe Voting
              </button>
            )}

            {isProcessed && (
              <button 
                onClick={() => navigate(`/matches/${id}/result`)}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black italic uppercase tracking-tighter py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Trophy className="w-5 h-5" />
                View Match Results
              </button>
            )}

            {fixture.status !== 'finished' && (
              <div className="text-center p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" />
                  Voting opens once the match is finished
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lineup Sections */}
      <div className="p-6 space-y-12">
        {/* Home Team */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-emerald-500 rounded-full" />
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">
              {(fixture as any).home_team?.clubs?.name}
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-12 gap-x-8 justify-items-center">
            {homePlayers.length > 0 ? homePlayers.map((entry) => (
              <div key={entry.player_id} className="flex flex-col items-center">
                <PlayerVoteCard
                  key={`vote-${entry.player_id}`}
                  player={entry.players}
                  vote={userVotes[entry.player_id] || null}
                  onVote={(vote) => handleVote(entry.player_id, vote)}
                  loading={votingLoading === entry.player_id}
                  disabled={!votingMode}
                  shirtNumber={entry.shirt_number}
                  lineupRole={entry.lineup_role as 'starter' | 'sub'}
                  onClick={() => navigate(`/players/${entry.player_id}`)}
                />
              </div>
            )) : (
              <p className="text-zinc-600 text-xs italic p-8 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800 w-full text-center">
                No lineup assigned yet for this team.
              </p>
            )}
          </div>
        </div>

        {/* Away Team */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-zinc-500 rounded-full" />
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">
              {(fixture as any).away_team?.clubs?.name}
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-12 gap-x-8 justify-items-center">
            {awayPlayers.length > 0 ? awayPlayers.map((entry) => (
              <div key={entry.player_id} className="flex flex-col items-center">
                <PlayerVoteCard
                  key={`vote-${entry.player_id}`}
                  player={entry.players}
                  vote={userVotes[entry.player_id] || null}
                  onVote={(vote) => handleVote(entry.player_id, vote)}
                  loading={votingLoading === entry.player_id}
                  disabled={!votingMode}
                  shirtNumber={entry.shirt_number}
                  lineupRole={entry.lineup_role as 'starter' | 'sub'}
                  onClick={() => navigate(`/players/${entry.player_id}`)}
                />
              </div>
            )) : (
              <p className="text-zinc-600 text-xs italic p-8 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800 w-full text-center">
                No lineup assigned yet for this team.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Check-in Modal */}
      <AnimatePresence>
        {showCheckinModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCheckinModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 w-full max-w-md relative z-10 shadow-2xl"
            >
              <button 
                onClick={() => setShowCheckinModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>

              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl mx-auto flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-emerald-500" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter">Match Check-in</h2>
                  <p className="text-zinc-500 text-sm font-medium">
                    Enter the code provided at the stadium to unlock voting.
                  </p>
                </div>

                <form onSubmit={handleCheckin} className="space-y-4">
                  <input
                    type="text"
                    value={checkinCode}
                    onChange={(e) => setCheckinCode(e.target.value.toUpperCase())}
                    placeholder="ENTER CODE"
                    className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-2xl py-4 px-6 text-center text-2xl font-black tracking-[0.5em] text-white focus:border-emerald-500 outline-none transition-all placeholder:tracking-normal placeholder:text-sm placeholder:font-bold uppercase"
                    maxLength={10}
                    required
                  />
                  
                  {checkinError && (
                    <div className="flex items-center gap-2 text-red-500 text-xs font-bold justify-center">
                      <AlertCircle className="w-4 h-4" />
                      {checkinError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={checkinLoading}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black italic uppercase tracking-tighter py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {checkinLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Verify Code'
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Swipe Voting Overlay */}
      <AnimatePresence>
        {showSwipeOverlay && id && (
          <SwipeVotingOverlay
            fixtureId={id}
            lineup={lineup}
            userVotes={userVotes}
            onVote={handleVote}
            onClose={() => setShowSwipeOverlay(false)}
            onViewResults={() => navigate(`/matches/${id}/result`)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MatchDetail;
