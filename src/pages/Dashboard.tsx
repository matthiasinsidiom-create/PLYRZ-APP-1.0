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
}) => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
    <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase tracking-widest">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        {new Date(fixture.kickoff_at).toLocaleDateString()}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {new Date(fixture.kickoff_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        {hasCheckedIn && (
          <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span className="text-[8px]">CHECKED IN</span>
          </div>
        )}
      </div>
    </div>

    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex-1 text-center space-y-2">
        <div className="w-16 h-16 bg-zinc-800 rounded-2xl mx-auto flex items-center justify-center">
          <Shield className="w-8 h-8 text-zinc-600" />
        </div>
        <div className="space-y-0.5">
          <div className="text-sm font-bold text-white line-clamp-1 italic uppercase tracking-tight">
            {homeTeam?.clubs?.name || 'Club Name'}
          </div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest line-clamp-1">
            {homeTeam?.name || 'Team Name'}
          </p>
        </div>
      </div>
      
      <div className="text-2xl font-black italic text-zinc-700">
        {fixture.status === 'finished' ? `${fixture.home_score} - ${fixture.away_score}` : 'VS'}
      </div>

      <div className="flex-1 text-center space-y-2">
        <div className="w-16 h-16 bg-zinc-800 rounded-2xl mx-auto flex items-center justify-center">
          <Shield className="w-8 h-8 text-zinc-600" />
        </div>
        <div className="space-y-0.5">
          <div className="text-sm font-bold text-white line-clamp-1 italic uppercase tracking-tight">
            {awayTeam?.clubs?.name || 'Club Name'}
          </div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest line-clamp-1">
            {awayTeam?.name || 'Team Name'}
          </p>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-2 text-zinc-400 text-sm">
      <MapPin className="w-4 h-4" />
      {fixture.venue_name}
    </div>

    {fixture.status === 'finished' ? (
      hasCheckedIn ? (
        <button 
          onClick={onVote}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
        >
          <Star className="w-5 h-5" />
          VOTE FOR PLAYERS
        </button>
      ) : (
        <div className="w-full bg-zinc-800 text-zinc-500 font-bold py-4 rounded-2xl text-center text-sm">
          NO CHECK-IN FOUND
        </div>
      )
    ) : (
      <button 
        onClick={onCheckIn}
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
      >
        <QrCode className="w-5 h-5" />
        CHECK-IN NOW
      </button>
    )}
  </div>
);

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
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans pb-24">
      {/* Header */}
      <div className="p-6 flex items-center justify-between sticky top-0 bg-[#0A0A0A]/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center rotate-6">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter uppercase">PLYRZ</h1>
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
          <button 
            onClick={() => signOut()}
            className="w-10 h-10 bg-zinc-800 rounded-full border border-zinc-700 overflow-hidden hover:border-red-500/50 transition-all group relative"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold">
                {profile?.display_name?.[0]}
              </div>
            )}
            <div className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <X className="w-5 h-5 text-white" />
            </div>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-12">
        {/* Admin Quick Access */}
        {isAdmin && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
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
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black italic uppercase tracking-tight">Your Player Card</h2>
              <button 
                onClick={() => playerData && navigate(`/players/${playerData.id}`)}
                className="text-emerald-500 text-sm font-bold flex items-center gap-1"
              >
                View Details <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex justify-center">
              {playerData ? (
                <PlayerCard 
                  player={playerData} 
                  clubLogo={teams.find(t => t.id === playerData.team_id)?.clubs?.logo_url}
                />
              ) : (
                <div className="w-full max-w-sm aspect-[2/3] bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-[2rem] flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="p-4 bg-zinc-800 rounded-full">
                    <Users className="w-8 h-8 text-zinc-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">No Card Claimed</h3>
                    <p className="text-zinc-500 text-sm mt-1">Claim your existing player card to start building your legacy.</p>
                  </div>
                  <button 
                    onClick={() => navigate('/claim')}
                    className="bg-white text-black px-6 py-3 rounded-xl font-bold text-sm hover:bg-zinc-200 transition-colors"
                  >
                    CLAIM PLAYER CARD
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Top Players Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-amber-500" />
              </div>
              <h2 className="text-xl font-black italic uppercase tracking-tight">Top Players</h2>
            </div>
            <button 
              onClick={() => navigate('/players')}
              className="text-emerald-500 text-sm font-bold flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex overflow-x-auto snap-x snap-mandatory -space-x-20 pb-12 no-scrollbar -mx-6 px-12">
            {loadingTopPlayers ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-72 h-[440px] bg-zinc-900/50 animate-pulse rounded-[2rem] border border-zinc-800 snap-center" />
              ))
            ) : topPlayers.length > 0 ? (
              topPlayers.map((player, index) => (
                <motion.div 
                  key={player.id} 
                  className="flex-shrink-0 snap-center relative transition-all duration-300 hover:z-50 hover:-translate-y-4"
                  style={{ zIndex: topPlayers.length - index }}
                >
                  <PlayerCard 
                    player={player}
                    clubLogo={player.teams?.clubs?.logo_url}
                  />
                </motion.div>
              ))
            ) : (
              <div className="w-full py-12 text-center space-y-4 bg-zinc-900/30 rounded-3xl border border-zinc-800/50">
                <Users className="w-12 h-12 text-zinc-800 mx-auto" />
                <p className="text-zinc-500 font-medium">No players found.</p>
              </div>
            )}
          </div>
        </section>

        {/* Fan Section: Upcoming Matches */}
        <section className="space-y-6">
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
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-2xl">
              <Star className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total Votes</div>
              <div className="text-xl font-bold text-white">1,284</div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-2xl">
              <TrendingUp className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Avg. Rating</div>
              <div className="text-xl font-bold text-white">78.4</div>
            </div>
          </div>
        </section>

        {/* Debug Tier Preview */}
        <section className="space-y-6 pt-12 border-t border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <Shield className="w-5 h-5 text-zinc-400" />
            </div>
            <h2 className="text-xl font-black italic uppercase tracking-tight text-zinc-400">Card Tier Verification</h2>
          </div>
          <p className="text-zinc-500 text-sm max-w-2xl">
            Strict layout verification: All tiers share the exact same geometry. Only material treatments (colors, textures, shines) vary.
          </p>
          
          <div className="flex flex-wrap justify-center gap-8 py-8">
            <div className="space-y-4 text-center">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Bronze Tier</span>
              <PlayerCard 
                player={{ full_name: 'Bronze Player', position: 'ST', player_stats: [{ overall: 64, tem: 64, sch: 64, pas: 64, dri: 64, def: 64, phy: 64 }] } as any} 
                forceTier="bronze"
              />
            </div>
            <div className="space-y-4 text-center">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Silver Tier</span>
              <PlayerCard 
                player={{ full_name: 'Silver Player', position: 'CM', player_stats: [{ overall: 74, tem: 74, sch: 74, pas: 74, dri: 74, def: 74, phy: 74 }] } as any} 
                forceTier="silver"
              />
            </div>
            <div className="space-y-4 text-center">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Gold Tier</span>
              <PlayerCard 
                player={{ full_name: 'Gold Player', position: 'RW', player_stats: [{ overall: 88, tem: 88, sch: 88, pas: 88, dri: 88, def: 88, phy: 88 }] } as any} 
                forceTier="gold"
              />
            </div>
          </div>
        </section>
      </div>

    </div>
  );
};

export default Dashboard;
