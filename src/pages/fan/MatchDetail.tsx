import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Shield, 
  ArrowLeft,
  Loader2,
  QrCode,
  Star,
  CheckCircle2,
  AlertCircle,
  Users,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { useAuth } from '../../context/AuthContext';
import { Fixture, Player, Team } from '../../types';

export const MatchDetail: React.FC = () => {
  const { profile } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [homePlayers, setHomePlayers] = useState<any[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<any[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});
  const [hasCheckedIn, setHasCheckedIn] = useState(() => {
    // Initial check from localStorage for instant feedback
    try {
      if (id && profile) {
        return localStorage.getItem(`checkin_${profile.id}_${id}`) === 'true';
      }
    } catch (err) {
      console.error('Error reading checkin from localStorage:', err);
    }
    return false;
  });
  
  const [error, setError] = useState<string | null>(null);
  
  const [checkInCode, setCheckInCode] = useState('');
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState(false);

  const [votingLoading, setVotingLoading] = useState<string | null>(null);

  useEffect(() => {
    if (id && profile) {
      try {
        const cached = localStorage.getItem(`checkin_${profile.id}_${id}`) === 'true';
        if (cached) {
          console.log('MatchDetail: Found cached check-in in localStorage');
          setHasCheckedIn(true);
        }
      } catch (err) {
        console.error('Error reading checkin from localStorage in useEffect:', err);
      }
      loadMatchData();
    }
  }, [id, profile]);

  const loadMatchData = async (isCheckInRefresh = false) => {
    if (!id || !profile) {
      console.log('MatchDetail: Missing id or profile', { id, profileId: profile?.id });
      return;
    }
    
    // Only show full page loader if not a check-in refresh
    if (!isCheckInRefresh) {
      setLoading(true);
    }
    
    setError(null);
    console.log('MatchDetail: Loading data for fixture', id, 'User:', profile.id, 'isCheckInRefresh:', isCheckInRefresh);

    // Basic UUID validation
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUUID) {
      console.error('MatchDetail: Invalid UUID format', id);
      setError(`Invalid Match ID format: ${id}`);
      setLoading(false);
      return;
    }

    try {
      console.log('MatchDetail: Fetching fixture...');
      const f = await supabaseService.getFixtureById(id);
      console.log('MatchDetail: Fixture loaded', { 
        id: f.id, 
        status: f.status,
        home_team_id: f.home_team_id, 
        away_team_id: f.away_team_id 
      });
      setFixture(f);

      console.log('MatchDetail: Fetching checkins, lineup, and votes...');
      
      // Load check-ins, lineup, and votes with individual error handling to ensure resilience
      const [checkinsResult, lineupResult, votesResult] = await Promise.allSettled([
        supabaseService.getUserCheckins(profile.id),
        supabaseService.getFixtureLineupWithPlayers(id),
        supabaseService.getUserVotesForFixture(profile.id, id)
      ]);

      // Process check-ins
      if (checkinsResult.status === 'fulfilled') {
        const { data: checkinsData, error: checkinsError } = checkinsResult.value;
        
        if (checkinsError) {
          console.error('MatchDetail: Supabase error loading check-ins', checkinsError);
          // Don't overwrite if we just successfully checked in
        } else {
          console.log('MatchDetail: Raw check-ins data from server:', checkinsData);
          
          // Ensure we are comparing strings correctly and handle potential nulls
          const checkedIn = checkinsData?.some(c => {
            const match = String(c.fixture_id).toLowerCase() === String(id).toLowerCase();
            if (match) console.log('MatchDetail: Found matching check-in for fixture', id);
            return match;
          }) || false;
          
          console.log('MatchDetail: Check-ins processing result', { 
            count: checkinsData?.length, 
            targetId: id,
            isCheckedInForThisMatch: checkedIn 
          });
          
          if (checkedIn && profile) {
            try {
              localStorage.setItem(`checkin_${profile.id}_${id}`, 'true');
            } catch (err) {
              console.error('Error saving checkin to localStorage:', err);
            }
          }
          
          setHasCheckedIn(checkedIn);
        }
      } else {
        console.error('MatchDetail: Promise failed to load check-ins', checkinsResult.reason);
        // Don't overwrite if we just successfully checked in (handled in handleCheckIn)
        setHasCheckedIn(prev => prev);
      }

      // Process lineup
      let lineup: any[] = [];
      if (lineupResult.status === 'fulfilled') {
        lineup = lineupResult.value;
        console.log('MatchDetail: Lineup data received', { 
          count: lineup.length,
          fixture_id: id,
          home_team_id: f.home_team_id,
          away_team_id: f.away_team_id
        });
      } else {
        console.error('MatchDetail: Failed to load lineup', lineupResult.reason);
      }

      // Process votes
      const voteMap: Record<string, 'up' | 'down'> = {};
      if (votesResult.status === 'fulfilled') {
        const votes = votesResult.value;
        console.log('MatchDetail: Votes loaded', { count: votes.length });
        votes.forEach(v => {
          voteMap[v.player_id] = v.vote;
        });
      } else {
        console.error('MatchDetail: Failed to load user votes', votesResult.reason);
      }
      setUserVotes(voteMap);

      // Filter lineup by team using the team_id from the fixture_lineups record
      // Defensive mapping to handle potential array/object variations from Supabase
      const hp = lineup
        .filter(l => l.team_id === f.home_team_id)
        .map(l => {
          const player = Array.isArray(l.players) ? l.players[0] : l.players;
          const team = Array.isArray(l.teams) ? l.teams[0] : l.teams;
          if (!player) return null;
          return {
            ...player,
            team_name: team?.name,
            club_name: team?.clubs?.name
          };
        })
        .filter((p): p is any => !!p && !!p.id);
        
      const ap = lineup
        .filter(l => l.team_id === f.away_team_id)
        .map(l => {
          const player = Array.isArray(l.players) ? l.players[0] : l.players;
          const team = Array.isArray(l.teams) ? l.teams[0] : l.teams;
          if (!player) return null;
          return {
            ...player,
            team_name: team?.name,
            club_name: team?.clubs?.name
          };
        })
        .filter((p): p is any => !!p && !!p.id);
      
      console.log('MatchDetail: Grouped players result', { 
        homeCount: hp.length, 
        awayCount: ap.length 
      });
      
      setHomePlayers(hp);
      setAwayPlayers(ap);
    } catch (err: any) {
      console.error('Error loading match detail:', err);
      setError(err.message || 'Failed to load match data');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !profile) {
      console.warn('MatchDetail: Cannot check-in, missing id or profile', { id, profileId: profile?.id });
      return;
    }
    
    console.log('MatchDetail: Starting check-in process', { fixtureId: id, userId: profile.id, code: checkInCode });
    setCheckInLoading(true);
    setCheckInError(null);
    
    try {
      // TEMP: allow check-in after match for testing (logic handled in service)
      const result = await supabaseService.createMatchCheckin(id, checkInCode);
      console.log('MatchDetail: Check-in success result:', result);
      
      // Immediate UI update
      console.log('MatchDetail: Setting hasCheckedIn to true locally');
      if (profile) {
        try {
          localStorage.setItem(`checkin_${profile.id}_${id}`, 'true');
        } catch (err) {
          console.error('Error saving checkin to localStorage after check-in:', err);
        }
      }
      setHasCheckedIn(true);
      setCheckInSuccess(true);
      
      // Clear code input
      setCheckInCode('');
      
      // Reload data to confirm check-in state from server and refresh other data
      console.log('MatchDetail: Reloading data after check-in...');
      await loadMatchData(true);
      
      console.log('MatchDetail: Final hasCheckedIn state after reload:', true); // We know it's true now
      setHasCheckedIn(true); // Force it one more time just in case loadMatchData had a stale fetch
      
      setTimeout(() => setCheckInSuccess(false), 3000);
    } catch (err: any) {
      console.error('MatchDetail: Check-in error:', err);
      // Show the real error message from Supabase/Service
      setCheckInError(err.message || 'Check-in failed. Please check the code.');
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleVote = async (playerId: string, vote: 'up' | 'down') => {
    if (!id || !profile) return;
    
    // If already voted this way, do nothing
    if (userVotes[playerId] === vote) return;

    setVotingLoading(playerId);
    try {
      await supabaseService.submitPlayerVote(id, playerId, vote);
      
      // Update local state
      setUserVotes(prev => ({
        ...prev,
        [playerId]: vote
      }));
    } catch (err: any) {
      console.error('Voting error:', err);
      alert(`Voting failed: ${err.message}`);
    } finally {
      setVotingLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!fixture) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-black italic uppercase tracking-tight">Match Not Found</h1>
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl max-w-xs">
            <p className="text-sm text-red-400 font-medium">{error}</p>
          </div>
        )}
        <p className="mt-2 text-zinc-500 text-sm">ID: {id}</p>
        <button 
          onClick={() => navigate('/matches')}
          className="mt-8 text-emerald-500 font-bold flex items-center gap-2 hover:bg-emerald-500/10 px-6 py-3 rounded-2xl transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> BACK TO MATCHES
        </button>
      </div>
    );
  }

  const isFinished = fixture.status === 'finished';
  console.log('MatchDetail: Rendering voting UI', { 
    hasCheckedIn, 
    isFinished, 
    fixtureStatus: fixture.status,
    votingDisabled: !hasCheckedIn || !isFinished 
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans pb-24">
      {/* Header */}
      <div className="p-6 flex items-center justify-between sticky top-0 bg-[#0A0A0A]/80 backdrop-blur-md z-50 border-b border-white/5">
        <button 
          onClick={() => navigate('/matches')}
          className="p-2 hover:bg-zinc-800 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-zinc-400" />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-black italic tracking-tighter uppercase text-zinc-500">Match Details</h1>
          <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em]">
            {fixture.status}
          </div>
        </div>
        <div className="w-10 h-10" /> {/* Spacer */}
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-8">
        {/* Score Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-[2.5rem] p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-emerald-500" />
          
          <div className="flex items-center justify-between gap-4 relative z-10">
            <div className="flex-1 text-center space-y-4">
              <div className="w-20 h-20 bg-zinc-800 rounded-3xl mx-auto flex items-center justify-center shadow-2xl">
                <Shield className="w-10 h-10 text-zinc-600" />
              </div>
              <div className="space-y-1">
                <div className="text-lg font-black italic text-white uppercase tracking-tight">
                  {(fixture as any).home_team?.clubs?.name}
                </div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  {(fixture as any).home_team?.name}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="text-5xl font-black italic tracking-tighter">
                {isFinished ? `${fixture.home_score} - ${fixture.away_score}` : 'VS'}
              </div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-800/50 px-3 py-1 rounded-full">
                {new Date(fixture.kickoff_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className="flex-1 text-center space-y-4">
              <div className="w-20 h-20 bg-zinc-800 rounded-3xl mx-auto flex items-center justify-center shadow-2xl">
                <Shield className="w-10 h-10 text-zinc-600" />
              </div>
              <div className="space-y-1">
                <div className="text-lg font-black italic text-white uppercase tracking-tight">
                  {(fixture as any).away_team?.clubs?.name}
                </div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  {(fixture as any).away_team?.name}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap items-center justify-center gap-6 text-zinc-400 text-xs font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {new Date(fixture.kickoff_at).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {fixture.venue_name}
            </div>
          </div>
        </motion.div>

        {/* Check-in Section */}
        {!hasCheckedIn ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-2xl">
                <QrCode className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xl font-black italic uppercase tracking-tight">Match Check-in</h2>
                <p className="text-zinc-500 text-sm">Enter the code to verify you are at the stadium.</p>
              </div>
            </div>

            <form onSubmit={handleCheckIn} className="space-y-4">
              <div className="relative">
                <input 
                  required
                  value={checkInCode}
                  onChange={e => setCheckInCode(e.target.value.toUpperCase())}
                  className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-2xl px-6 py-4 text-center text-2xl font-black tracking-[0.5em] text-white focus:outline-none focus:border-emerald-500 transition-colors uppercase"
                  placeholder="CODE"
                  maxLength={10}
                />
                {checkInSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500"
                  >
                    <CheckCircle2 className="w-8 h-8" />
                  </motion.div>
                )}
              </div>
              
              {checkInError && (
                <div className="flex items-center gap-2 text-red-500 text-xs font-bold uppercase tracking-wider bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                  <AlertCircle className="w-4 h-4" />
                  {checkInError}
                </div>
              )}

              <button 
                disabled={checkInLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black py-5 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                {checkInLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'VERIFY CHECK-IN'}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-emerald-500 font-black italic uppercase tracking-tight">Checked In</div>
                <p className="text-emerald-500/60 text-[10px] font-bold uppercase tracking-widest">You are verified for this match</p>
              </div>
            </div>
            <div className="text-emerald-500/20">
              <QrCode className="w-12 h-12" />
            </div>
          </motion.div>
        )}

        {/* Lineup & Voting Section */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${isFinished ? 'bg-blue-500/10' : 'bg-zinc-800'}`}>
                {isFinished ? (
                  <Star className="w-6 h-6 text-blue-500" />
                ) : (
                  <Users className="w-6 h-6 text-zinc-400" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-black italic uppercase tracking-tight">
                  {isFinished ? 'Player Voting' : 'Match Lineup'}
                </h2>
                <p className="text-zinc-500 text-sm">
                  {isFinished 
                    ? 'Rate the performance of the players.' 
                    : 'The official starting lineup for this match.'}
                </p>
              </div>
            </div>
            {isFinished && !hasCheckedIn && (
              <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                Check-in Required
              </div>
            )}
            {!isFinished && (
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-800/50 px-3 py-1 rounded-full border border-white/5">
                Lineup Confirmed
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Home Team Players */}
            <div className="space-y-4">
              <div className="flex flex-col px-2">
                <h3 className="text-sm font-black italic uppercase tracking-tight text-white">
                  {(fixture as any).home_team?.clubs?.name}
                </h3>
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {(fixture as any).home_team?.name}
                </h3>
              </div>
              <div className="grid gap-3">
                {homePlayers.map(player => (
                  <PlayerVoteCard 
                    key={player.id} 
                    player={player} 
                    onVote={(v) => handleVote(player.id, v)}
                    disabled={!hasCheckedIn || !isFinished}
                    showVoting={isFinished}
                    loading={votingLoading === player.id}
                    activeVote={userVotes[player.id]}
                  />
                ))}
                {homePlayers.length === 0 && (
                  <p className="text-zinc-600 text-xs italic p-4 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800">
                    No lineup assigned yet for this team.
                  </p>
                )}
              </div>
            </div>

            {/* Away Team Players */}
            <div className="space-y-4">
              <div className="flex flex-col px-2">
                <h3 className="text-sm font-black italic uppercase tracking-tight text-white">
                  {(fixture as any).away_team?.clubs?.name}
                </h3>
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {(fixture as any).away_team?.name}
                </h3>
              </div>
              <div className="grid gap-3">
                {awayPlayers.map(player => (
                  <PlayerVoteCard 
                    key={player.id} 
                    player={player} 
                    onVote={(v) => handleVote(player.id, v)}
                    disabled={!hasCheckedIn || !isFinished}
                    showVoting={isFinished}
                    loading={votingLoading === player.id}
                    activeVote={userVotes[player.id]}
                  />
                ))}
                {awayPlayers.length === 0 && (
                  <p className="text-zinc-600 text-xs italic p-4 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800">
                    No lineup assigned yet for this team.
                  </p>
                )}
              </div>
            </div>
          </div>

          {!isFinished && (
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6 text-center">
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                Voting opens once the match is finished
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

interface PlayerVoteCardProps {
  player: Player & { club_name?: string };
  onVote: (v: 'up' | 'down') => void;
  disabled?: boolean;
  loading?: boolean;
  activeVote?: 'up' | 'down';
  showVoting?: boolean;
}

const PlayerVoteCard: React.FC<PlayerVoteCardProps> = ({ 
  player, 
  onVote, 
  disabled, 
  loading,
  activeVote,
  showVoting = true
}) => (
  <div className={`bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between transition-all ${disabled && showVoting ? 'opacity-50 grayscale' : 'hover:border-zinc-700'}`}>
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 bg-zinc-800 rounded-xl overflow-hidden flex items-center justify-center relative group">
        {player.photo_url ? (
          <img src={player.photo_url} alt={player.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <Users className="w-6 h-6 text-zinc-600" />
        )}
        {player.player_stats && player.player_stats.length > 0 && (
          <div className="absolute -top-1 -right-1 bg-emerald-500 text-black text-[8px] font-black px-1 rounded shadow-lg">
            {player.player_stats[0].overall}
          </div>
        )}
      </div>
      <div>
        <div className="font-bold text-white text-sm leading-tight">{player.full_name}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{player.position || 'POS'}</div>
          {player.club_name && (
            <div className="text-[9px] font-bold text-emerald-500/60 uppercase tracking-wider">
              · {player.club_name}
            </div>
          )}
        </div>
        
        {/* Player Stats Grid */}
        {player.player_stats && player.player_stats.length > 0 ? (
          <div className="mt-2 flex items-center gap-2.5">
            {[
              { label: 'TEM', val: player.player_stats[0].tem },
              { label: 'SCH', val: player.player_stats[0].sch },
              { label: 'PAS', val: player.player_stats[0].pas },
              { label: 'DRI', val: player.player_stats[0].dri },
              { label: 'DEF', val: player.player_stats[0].def },
              { label: 'PHY', val: player.player_stats[0].phy }
            ].map(stat => (
              <div key={stat.label} className="flex flex-col items-center min-w-[20px]">
                <span className="text-[7px] font-bold text-zinc-600 uppercase leading-none mb-0.5">{stat.label}</span>
                <span className="text-[10px] font-black text-zinc-300 leading-none">{stat.val}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-[8px] font-bold text-zinc-600 uppercase tracking-widest italic">
            Stats Pending
          </div>
        )}
      </div>
    </div>
    
    {showVoting && (
      <div className="flex items-center gap-2">
        {loading ? (
          <Loader2 className="w-5 h-5 text-zinc-500 animate-spin mr-4" />
        ) : (
          <>
            <button 
              disabled={disabled}
              onClick={() => onVote('down')}
              className={`p-3 rounded-xl transition-colors disabled:cursor-not-allowed ${
                activeVote === 'down' 
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                  : 'bg-red-500/10 hover:bg-red-500/20 text-red-500'
              }`}
            >
              <TrendingDown className="w-5 h-5" />
            </button>
            <button 
              disabled={disabled}
              onClick={() => onVote('up')}
              className={`p-3 rounded-xl transition-colors disabled:cursor-not-allowed ${
                activeVote === 'up' 
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    )}
  </div>
);


export default MatchDetail;
