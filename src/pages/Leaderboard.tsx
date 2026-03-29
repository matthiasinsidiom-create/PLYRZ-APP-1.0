import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Shield, 
  ChevronLeft, 
  Filter, 
  Search, 
  TrendingUp, 
  Users,
  Loader2,
  Medal,
  Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Player, Club, League } from '../types';
import { PlayerCard } from '../components/PlayerCard';

export const Leaderboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  
  const [selectedClub, setSelectedClub] = useState<string>('all');
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, c, l] = await Promise.all([
        supabaseService.getPlayers(),
        supabaseService.getClubs(),
        supabaseService.getLeagues()
      ]);
      
      // Sort players by overall descending
      const sortedPlayers = [...p].sort((a, b) => 
        (b.current_stats?.overall || 0) - (a.current_stats?.overall || 0)
      );
      
      setPlayers(sortedPlayers);
      setClubs(c);
      setLeagues(l);
    } catch (err) {
      console.error('Error loading leaderboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter(player => {
    const matchesClub = selectedClub === 'all' || player.teams?.club_id === selectedClub;
    const matchesLeague = selectedLeague === 'all' || player.teams?.clubs?.league_id === selectedLeague;
    const matchesSearch = player.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClub && matchesLeague && matchesSearch;
  });

  const top3 = filteredPlayers.slice(0, 3);
  const remaining = filteredPlayers.slice(3);

  // Reorder top 3 for visual layout: [2, 1, 3]
  const visualTop3 = [
    top3[1] || null,
    top3[0] || null,
    top3[2] || null
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans pb-24">
      {/* Header */}
      <div className="p-6 flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-50 border-b border-white/5">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black italic uppercase tracking-tight">Leaderboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Trophy className="w-5 h-5 text-emerald-500" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input 
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <select 
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors text-sm font-bold uppercase tracking-wider"
            >
              <option value="all">All Leagues</option>
              {leagues.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <select 
              value={selectedClub}
              onChange={(e) => setSelectedClub(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors text-sm font-bold uppercase tracking-wider"
            >
              <option value="all">All Clubs</option>
              {clubs.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Top 3 Section */}
        {top3.length > 0 && (
          <div className="relative pt-12 pb-8">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent blur-3xl rounded-full opacity-50" />
            
            <div className="grid grid-cols-3 items-end gap-4 max-w-4xl mx-auto relative z-10">
              {visualTop3.map((player, idx) => {
                if (!player) return <div key={idx} />;
                
                const isFirst = idx === 1;
                const isSecond = idx === 0;
                const isThird = idx === 2;
                const rank = isFirst ? 1 : isSecond ? 2 : 3;

                return (
                  <motion.div 
                    key={player.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`flex flex-col items-center space-y-4 ${isFirst ? 'z-20' : 'z-10'}`}
                  >
                    <div className="relative group cursor-pointer" onClick={() => navigate(`/players/${player.id}`)}>
                      <div className={`absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center ${isFirst ? 'scale-125' : ''}`}>
                        <div className={`
                          w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-lg
                          ${isFirst ? 'bg-amber-400 border-amber-200 text-amber-900' : 
                            isSecond ? 'bg-zinc-300 border-zinc-100 text-zinc-800' : 
                            'bg-orange-400 border-orange-200 text-orange-900'}
                        `}>
                          <span className="font-black italic text-lg">{rank}</span>
                        </div>
                        {isFirst && (
                          <motion.div 
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ repeat: Infinity, duration: 4 }}
                            className="absolute -top-6"
                          >
                            <Trophy className="w-6 h-6 text-amber-400 fill-amber-400" />
                          </motion.div>
                        )}
                      </div>

                      <div className={`
                        transition-transform duration-500 group-hover:scale-105
                        ${isFirst ? 'scale-110' : 'scale-90'}
                      `}>
                        <PlayerCard 
                          player={player}
                          clubLogo={player.teams?.clubs?.logo_url}
                        />
                      </div>
                      
                      {isFirst && (
                        <div className="absolute -inset-4 bg-emerald-500/20 blur-2xl rounded-full -z-10 animate-pulse" />
                      )}
                    </div>

                    <div className="text-center">
                      <div className="text-lg font-black italic uppercase tracking-tight line-clamp-1">
                        {player.full_name}
                      </div>
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                          {player.teams?.clubs?.name}
                        </div>
                        <div className="w-1 h-1 bg-zinc-700 rounded-full" />
                        <div className="text-emerald-500 font-black italic">
                          {player.current_stats?.overall} OVR
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Full Ranking List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">
            <div className="flex items-center gap-12">
              <span className="w-8 text-center">Rank</span>
              <span>Player</span>
            </div>
            <div className="flex items-center gap-12">
              <span className="hidden sm:inline">Club</span>
              <span className="w-12 text-center">OVR</span>
            </div>
          </div>

          <div className="space-y-2">
            {remaining.length > 0 ? (
              remaining.map((player, idx) => (
                <motion.div 
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  onClick={() => navigate(`/players/${player.id}`)}
                  className="bg-white/5 border border-white/5 hover:border-emerald-500/30 hover:bg-white/10 p-4 rounded-2xl flex items-center justify-between group cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-6 sm:gap-12">
                    <div className="w-8 text-center font-black italic text-zinc-500 group-hover:text-emerald-500 transition-colors">
                      #{idx + 4}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-800 rounded-xl overflow-hidden border border-white/10">
                        {player.photo_url ? (
                          <img src={player.photo_url} alt={player.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Users className="w-6 h-6 text-zinc-700" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                          {player.full_name}
                        </div>
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest sm:hidden">
                          {player.teams?.clubs?.name}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 sm:gap-12">
                    <div className="hidden sm:flex items-center gap-2">
                      {player.teams?.clubs?.logo_url && (
                        <img src={player.teams.clubs.logo_url} alt="" className="w-5 h-5 object-contain opacity-50" />
                      )}
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                        {player.teams?.clubs?.name}
                      </span>
                    </div>
                    <div className="w-12 text-center font-black italic text-xl text-emerald-500">
                      {player.current_stats?.overall}
                    </div>
                  </div>
                </motion.div>
              ))
            ) : filteredPlayers.length === 0 ? (
              <div className="py-20 text-center space-y-4 bg-white/5 rounded-3xl border border-dashed border-white/10">
                <Search className="w-12 h-12 text-zinc-800 mx-auto" />
                <div>
                  <h3 className="text-lg font-bold text-white">No players found</h3>
                  <p className="text-zinc-500 text-sm">Try adjusting your filters or search query.</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
