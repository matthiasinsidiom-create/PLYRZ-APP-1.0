import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Shield, 
  Users, 
  Calendar, 
  Star, 
  CheckCircle2, 
  QrCode, 
  ChevronRight,
  TrendingUp,
  MapPin,
  Clock,
  Search,
  Loader2,
  AlertCircle,
  X,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabaseService } from '../services/supabaseService';
import { Player, Fixture, Club, Team, PlayerStats } from '../types';
import { PlayerCard } from '../components/PlayerCard';

// --- COMPONENTS ---

const FixtureCard: React.FC<{ 
  fixture: Fixture, 
  homeTeam?: Team, 
  awayTeam?: Team, 
  onCheckIn: () => void,
  onVote: () => void,
  hasCheckedIn: boolean
}> = ({ 
  fixture, 
  homeTeam, 
  awayTeam, 
  onCheckIn, 
  onVote,
  hasCheckedIn 
}) => {
  const navigate = useNavigate();
  
  const handleClick = (e: React.MouseEvent) => {
    // Prevent navigation if clicking a button inside the card
    if ((e.target as HTMLElement).closest('button')) return;
    navigate(`/matches/${fixture.id}`);
  };

  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className="bg-black/40 backdrop-blur-md border border-white/10 rounded-[2rem] p-5 sm:p-6 space-y-4 cursor-pointer group hover:border-emerald-500/30 transition-all"
    >
      <div className="flex items-center justify-between text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" />
          {new Date(fixture.kickoff_at).toLocaleDateString()}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            {new Date(fixture.kickoff_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          {hasCheckedIn && (
            <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="w-2.5 h-2.5" />
              <span className="text-[7px]">CHECKED IN</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 sm:gap-4 py-2">
        <div className="flex-1 text-center space-y-2">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-zinc-800 rounded-2xl mx-auto flex items-center justify-center overflow-hidden border border-white/5">
            {homeTeam?.clubs?.logo_url ? (
              <img 
                src={homeTeam.clubs.logo_url} 
                alt={homeTeam.clubs.name} 
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-zinc-600" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="text-xs sm:text-sm font-black text-white line-clamp-1 italic uppercase tracking-tight">
              {homeTeam?.clubs?.name || 'Club Name'}
            </div>
            <p className="text-[8px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest line-clamp-1">
              {homeTeam?.name || 'Team Name'}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <div className="text-xl sm:text-2xl font-black italic text-zinc-700 group-hover:text-emerald-500 transition-colors">
            {fixture.status === 'finished' ? `${fixture.home_score} - ${fixture.away_score}` : 'VS'}
          </div>
          <div className={`text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full ${
            fixture.status === 'finished' ? 'bg-zinc-800 text-zinc-500' : 
            fixture.status === 'live' ? 'bg-red-500 text-white animate-pulse' : 
            'bg-emerald-500/10 text-emerald-500'
          }`}>
            {fixture.status}
          </div>
        </div>

        <div className="flex-1 text-center space-y-2">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-zinc-800 rounded-2xl mx-auto flex items-center justify-center overflow-hidden border border-white/5">
            {awayTeam?.clubs?.logo_url ? (
              <img 
                src={awayTeam.clubs.logo_url} 
                alt={awayTeam.clubs.name} 
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-zinc-600" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="text-xs sm:text-sm font-black text-white line-clamp-1 italic uppercase tracking-tight">
              {awayTeam?.clubs?.name || 'Club Name'}
            </div>
            <p className="text-[8px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest line-clamp-1">
              {awayTeam?.name || 'Team Name'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
        <MapPin className="w-3.5 h-3.5 text-emerald-500/50" />
        <span className="line-clamp-1">{fixture.venue_name}</span>
      </div>

      <div className="pt-2">
        {fixture.status === 'finished' ? (
          hasCheckedIn ? (
            <button 
              onClick={(e) => { e.stopPropagation(); onVote(); }}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black italic uppercase tracking-tighter py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
            >
              <Star className="w-4 h-4" />
              VOTE FOR PLAYERS
            </button>
          ) : (
            <div className="w-full bg-zinc-800 text-zinc-500 font-black italic uppercase tracking-tighter py-3 rounded-xl text-center text-[10px]">
              NO CHECK-IN FOUND
            </div>
          )
        ) : (
          <button 
            onClick={(e) => { e.stopPropagation(); onCheckIn(); }}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black italic uppercase tracking-tighter py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
          >
            <QrCode className="w-4 h-4" />
            CHECK-IN NOW
          </button>
        )}
      </div>
    </motion.div>
  );
};

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
  }, [profile]);

  const loadDashboardData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Load fixtures for everyone
      const [f, t, p] = await Promise.all([
        supabaseService.getFixtures(),
        supabaseService.getTeams(),
        supabaseService.getPlayers()
      ]);
      setFixtures(f.slice(0, 3)); // Only show top 3 on dashboard
      setTeams(t);
      setPlayers(p);

      // Load user check-ins
      const { data: userCheckins } = await supabaseService.getUserCheckins(profile.id);
      const checkinIds = userCheckins?.map(c => c.fixture_id) || [];
      setCheckins(checkinIds);
      
      try {
        localStorage.setItem(`checkins_${profile.id}`, JSON.stringify(checkinIds));
      } catch (err) {
        console.error('Error saving checkins to localStorage:', err);
      }

      // If player, load their card
      if (profile.user_type === 'player') {
        const myPlayer = p.find(player => player.claimed_by_user_id === profile.id);
        if (myPlayer) {
          setPlayerData(myPlayer);
        }
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
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
    <div className="min-h-screen bg-transparent text-white font-sans pb-24">
      {/* Header */}
      <div className="p-6 flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-50 border-b border-white/5">
        <div className="flex items-center gap-3">
          <img 
            src="/assets/plyrzlogo.png" 
            alt="PLYRZ Logo" 
            className="h-32 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 sm:px-4 py-2 rounded-xl border border-emerald-500/20 font-bold text-[10px] sm:text-xs uppercase tracking-wider"
            >
              <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Admin</span>
            </motion.button>
          )}
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Welcome back</div>
            <div className="text-sm font-bold text-white">{profile?.display_name}</div>
          </div>
          <div 
            className="w-10 h-10 bg-zinc-800 rounded-full border border-zinc-700 overflow-hidden hover:border-emerald-500/50 transition-all group relative"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold uppercase">
                {profile?.display_name?.[0]}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-1">
        {/* Admin Quick Access */}
        {isAdmin && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <button 
              onClick={() => navigate('/admin')}
              className="w-full bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl flex items-center justify-between group hover:bg-emerald-500/20 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-500" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-black italic uppercase tracking-widest text-emerald-500">Administrator</div>
                  <div className="text-lg font-bold text-white">Open Admin Control Panel</div>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-emerald-500 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}

        {/* Player Section */}
        {profile?.user_type === 'player' && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black italic uppercase tracking-tight">Your Player Card</h2>
              <button 
                onClick={() => playerData && navigate(`/players/${playerData.id}`)}
                className="text-emerald-500 text-sm font-bold flex items-center gap-1"
              >
                View Details <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex justify-center flex-col items-center">
              {playerData ? (
                <>
                  <PlayerCard 
                    player={playerData} 
                    clubLogo={teams.find(t => t.id === playerData.team_id)?.clubs?.logo_url}
                    onClick={() => navigate(`/players/${playerData.id}`)}
                  />
                  {/* TEMPORARY DEBUG BLOCK */}
                  <div className="mt-4 p-4 bg-black/95 border border-emerald-500/50 rounded-2xl font-mono text-[10px] text-emerald-400 space-y-1 w-full max-w-sm pointer-events-none z-50">
                    <div className="font-bold border-b border-emerald-500/20 pb-1 mb-1">YOUR CARD DEBUG</div>
                    <div>Player ID: {playerData.id}</div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Rows Found: {playerData.player_stats?.length || 0}</span>
                      <span className="text-zinc-500">Source: {playerData.player_stats && playerData.player_stats.length > 0 ? 'player_stats' : 'fallback'}</span>
                    </div>
                    
                    {playerData.player_stats && playerData.player_stats.length > 0 && (
                      <div className="pt-1 border-t border-emerald-500/10 mt-1">
                        <div className="text-emerald-300 font-bold">Selected Latest Row:</div>
                        <div className="truncate">Row ID: {playerData.current_stats?.id || 'N/A'}</div>
                        <div>Updated: {playerData.current_stats?.updated_at ? new Date(playerData.current_stats.updated_at).toLocaleString() : 'N/A'}</div>
                        <div className="grid grid-cols-4 gap-1 text-[8px] mt-1">
                          <div>OVR:{playerData.current_stats?.overall}</div>
                          <div>TEM:{playerData.current_stats?.tem}</div>
                          <div>SCH:{playerData.current_stats?.sch}</div>
                          <div>PAS:{playerData.current_stats?.pas}</div>
                          <div>DRI:{playerData.current_stats?.dri}</div>
                          <div>DEF:{playerData.current_stats?.def}</div>
                          <div>PHY:{playerData.current_stats?.phy}</div>
                        </div>
                        <div className="text-blue-400 text-[8px] overflow-hidden whitespace-nowrap border-t border-emerald-500/10 pt-1 mt-1">Raw[0]: {JSON.stringify(playerData.player_stats?.[0])?.slice(0, 40)}...</div>
                      </div>
                    )}

                    <div className="pt-1 border-t border-emerald-500/10 mt-1">
                      <div className="text-white font-bold">FINAL Values (Passed to Card):</div>
                      <div className="grid grid-cols-4 gap-1 text-[8px]">
                        <div>OVR:{playerData.current_stats?.overall}</div>
                        <div>TEM:{playerData.current_stats?.tem}</div>
                        <div>SCH:{playerData.current_stats?.sch}</div>
                        <div>PAS:{playerData.current_stats?.pas}</div>
                        <div>DRI:{playerData.current_stats?.dri}</div>
                        <div>DEF:{playerData.current_stats?.def}</div>
                        <div>PHY:{playerData.current_stats?.phy}</div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full max-w-sm aspect-[2/3] bg-black/20 backdrop-blur-sm border-2 border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="p-4 bg-white/5 rounded-full">
                    <Users className="w-8 h-8 text-white/20" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">No Card Claimed</h3>
                    <p className="text-zinc-500 text-sm mt-1">Claim your existing player card to start building your legacy.</p>
                  </div>
                  <button 
                    onClick={() => navigate('/claim')}
                    className="bg-emerald-500 text-black px-6 py-3 rounded-xl font-bold text-sm hover:bg-emerald-400 transition-colors"
                  >
                    CLAIM PLAYER CARD
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Top Players Section */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-amber-500" />
              </div>
              <h2 className="text-xl font-black italic uppercase tracking-tight">Top Players</h2>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigate('/leaderboard')}
                className="text-amber-500 text-sm font-bold flex items-center gap-1 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20"
              >
                Leaderboard <Trophy className="w-4 h-4" />
              </button>
              <button 
                onClick={() => navigate('/players')}
                className="text-emerald-500 text-sm font-bold flex items-center gap-1"
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div 
            className="flex overflow-x-auto pb-2 no-scrollbar -mx-6 px-[calc(50%-175px)] snap-x snap-mandatory scroll-smooth transform-gpu"
          >
            {loadingTopPlayers ? (
              [...Array(3)].map((_, i) => (
                <div 
                  key={i} 
                  className="flex-shrink-0 w-[350px] h-[490px] bg-black/20 backdrop-blur-sm animate-pulse rounded-[2.5rem] border border-white/10 snap-center" 
                />
              ))
            ) : topPlayers.length > 0 ? (
              topPlayers.map((player, index) => (
                <motion.div 
                  key={player.id} 
                  whileHover={{ scale: 1.05, zIndex: 110 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/players/${player.id}`)}
                  className="flex-shrink-0 w-[350px] snap-center -ml-40 first:ml-0 transform-gpu relative will-change-transform cursor-pointer"
                  style={{ 
                    zIndex: topPlayers.length - index
                  }}
                  initial={{ opacity: 0.6, scale: 0.9 }}
                  whileInView={{ 
                    opacity: 1,
                    scale: 1,
                    zIndex: 100
                  }}
                  viewport={{ 
                    once: false, 
                    amount: 0.5,
                    margin: "0px -100px 0px -100px"
                  }}
                  transition={{ 
                    duration: 0.3,
                    ease: "easeOut"
                  }}
                >
                  <div className="shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-[2.5rem]">
                    <PlayerCard 
                      player={player}
                      clubLogo={player.teams?.clubs?.logo_url}
                      onClick={() => navigate(`/players/${player.id}`)}
                    />
                    {/* TEMPORARY DEBUG BLOCK */}
                    <div className="mt-4 p-4 bg-black/95 border border-emerald-500/50 rounded-2xl font-mono text-[8px] text-emerald-400 space-y-1 pointer-events-none z-[100] relative">
                      <div className="font-bold border-b border-emerald-500/20 pb-1 mb-1">TOP PLAYER DEBUG</div>
                      <div>Player ID: {player.id?.slice(0, 8)}...</div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Rows Found: {player.player_stats?.length || 0}</span>
                        <span className="text-zinc-500">Source: {player.player_stats && player.player_stats.length > 0 ? 'player_stats' : 'fallback'}</span>
                      </div>
                      
                      {player.player_stats && player.player_stats.length > 0 && (
                        <div className="pt-1 border-t border-emerald-500/10 mt-1">
                          <div className="text-emerald-300 font-bold">Selected Latest Row:</div>
                          <div className="truncate">Row ID: {player.current_stats?.id || 'N/A'}</div>
                          <div>Updated: {player.current_stats?.updated_at ? new Date(player.current_stats.updated_at).toLocaleString() : 'N/A'}</div>
                          <div className="grid grid-cols-4 gap-1 text-[8px] mt-1">
                            <div>OVR:{player.current_stats?.overall}</div>
                            <div>TEM:{player.current_stats?.tem}</div>
                            <div>SCH:{player.current_stats?.sch}</div>
                            <div>PAS:{player.current_stats?.pas}</div>
                            <div>DRI:{player.current_stats?.dri}</div>
                            <div>DEF:{player.current_stats?.def}</div>
                            <div>PHY:{player.current_stats?.phy}</div>
                          </div>
                          <div className="text-blue-400 text-[8px] overflow-hidden whitespace-nowrap border-t border-emerald-500/10 pt-1 mt-1">Raw[0]: {JSON.stringify(player.player_stats?.[0])?.slice(0, 40)}...</div>
                        </div>
                      )}

                      <div className="pt-1 border-t border-emerald-500/10 mt-1">
                        <div className="text-white font-bold">FINAL Values (Passed to Card):</div>
                        <div className="grid grid-cols-4 gap-1 text-[8px]">
                          <div>OVR:{player.current_stats?.overall}</div>
                          <div>TEM:{player.current_stats?.tem}</div>
                          <div>SCH:{player.current_stats?.sch}</div>
                          <div>PAS:{player.current_stats?.pas}</div>
                          <div>DRI:{player.current_stats?.dri}</div>
                          <div>DEF:{player.current_stats?.def}</div>
                          <div>PHY:{player.current_stats?.phy}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="w-full py-12 text-center space-y-4 bg-black/20 backdrop-blur-sm rounded-3xl border border-white/10">
                <Users className="w-12 h-12 text-white/10 mx-auto" />
                <p className="text-zinc-500 font-medium">No players found.</p>
              </div>
            )}
          </div>
        </section>

        {/* Fan Section: Upcoming Matches */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black italic uppercase tracking-tight">Match Check-in</h2>
            <button 
              onClick={() => navigate('/matches')}
              className="text-emerald-500 text-sm font-bold flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fixtures.length > 0 ? (
              fixtures.map(f => (
                <FixtureCard 
                  key={f.id} 
                  fixture={f} 
                  homeTeam={teams.find(t => t.id === f.home_team_id)}
                  awayTeam={teams.find(t => t.id === f.away_team_id)}
                  hasCheckedIn={checkins.includes(f.id)}
                  onCheckIn={() => navigate(`/matches/${f.id}`)}
                  onVote={() => navigate(`/matches/${f.id}`)}
                />
              ))
            ) : (
              <div className="col-span-full py-12 text-center space-y-4">
                <Calendar className="w-12 h-12 text-zinc-800 mx-auto" />
                <p className="text-zinc-500 font-medium">No upcoming matches scheduled.</p>
              </div>
            )}
          </div>
        </section>

        {/* Stats Section */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-2xl">
              <Star className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total Votes</div>
              <div className="text-xl font-bold text-white">1,284</div>
            </div>
          </div>
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-2xl">
              <TrendingUp className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Avg. Rating</div>
              <div className="text-xl font-bold text-white">78.4</div>
            </div>
          </div>
        </section>

      </div>

    </div>
  );
};

export default Dashboard;
