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
  Star,
  User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Player, Club, League } from '../types';
import { PlayerCard } from '../components/PlayerCard';

import { useAuth } from '../context/AuthContext';

export const Leaderboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  
  const [selectedClub, setSelectedClub] = useState<string>('all');
  // Initialize selectedLeague with profile.selected_league_id if available, otherwise 'all'
  const [selectedLeague, setSelectedLeague] = useState<string>(profile?.selected_league_id || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasHistory, setHasHistory] = useState(false);

  // Update selectedLeague when profile loads
  useEffect(() => {
    if (profile?.selected_league_id && selectedLeague === 'all') {
      setSelectedLeague(profile.selected_league_id);
    }
  }, [profile?.selected_league_id]);

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile?.selected_league_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // If user is not admin, only fetch players from their selected league
      const fetchLeagueId = isAdmin ? undefined : profile?.selected_league_id;
      
      const [p, c, l, historyExists] = await Promise.all([
        supabaseService.getPlayers(undefined, fetchLeagueId),
        supabaseService.getClubs(fetchLeagueId),
        supabaseService.getLeagues(),
        supabaseService.hasRatingHistory()
      ]);
      
      // Sort players by overall descending
      const sortedPlayers = [...p].sort((a, b) => 
        (b.current_stats?.overall || 0) - (a.current_stats?.overall || 0)
      );
      
      setPlayers(sortedPlayers);
      setClubs(c);
      setLeagues(l);
      setHasHistory(historyExists);
    } catch (err) {
      console.error('Error loading leaderboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter(player => {
    const matchesClub = selectedClub === 'all' || player.teams?.club_id === selectedClub;
    
    let matchesLeague = true;
    if (isAdmin) {
      matchesLeague = selectedLeague === 'all' || player.teams?.clubs?.league_id === selectedLeague;
    } else {
      const targetLeague = profile?.selected_league_id || (players.length > 0 ? players[0].teams?.clubs?.league_id : 'all');
      matchesLeague = targetLeague === 'all' || player.teams?.clubs?.league_id === targetLeague;
    }

    const matchesSearch = player.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClub && matchesLeague && matchesSearch;
  });

  const top3 = hasHistory ? filteredPlayers.slice(0, 3) : [];
  const remaining = hasHistory ? filteredPlayers.slice(3) : filteredPlayers;

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
    <div className="min-h-screen bg-zinc-950 text-white font-sans pb-28 overflow-x-hidden w-full max-w-full">
      {/* Header */}
      <div className="p-6 pt-[10px] flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-50 border-b border-white/5">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black italic uppercase tracking-tight">Ranking</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Trophy className="w-5 h-5 text-emerald-500" />
          </div>
          <button 
            onClick={() => navigate('/profile')}
            className="w-10 h-10 bg-zinc-900 rounded-xl border border-white/10 flex items-center justify-center hover:border-emerald-500 hover:text-emerald-500 transition-all shadow-lg active:scale-95"
            title="Profil"
            aria-label="Profil"
          >
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Season End Actions */}
        {hasHistory && (
          <button
            onClick={() => navigate('/season-top3')}
            className="w-full bg-[#18181b] border border-amber-500/20 rounded-[2rem] p-5 flex items-center justify-between shadow-2xl hover:bg-zinc-900 transition-all active:scale-95"
          >
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                 <Trophy className="w-6 h-6 text-amber-500" />
               </div>
               <div className="text-left">
                 <div className="text-[10px] font-black uppercase tracking-widest text-amber-500/80 mb-0.5">Saisonende</div>
                 <div className="font-black italic text-lg text-white">Top 3 der Saison</div>
               </div>
             </div>
             <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center">
               <ChevronLeft className="w-4 h-4 text-zinc-500 rotate-180" />
             </div>
          </button>
        )}

        {!hasHistory && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 text-center">
            <Trophy className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <p className="text-emerald-500 font-bold uppercase tracking-wider text-xs">
              Das Ranking startet mit den ersten gespielten Partien der Saison 2026/2027.
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input 
              type="text"
              placeholder="Spieler suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <select 
                value={selectedLeague}
                onChange={(e) => setSelectedLeague(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors text-sm font-bold uppercase tracking-wider"
              >
                <option value="all">Alle Ligen</option>
                {leagues.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
            <select 
              value={selectedClub}
              onChange={(e) => setSelectedClub(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors text-sm font-bold uppercase tracking-wider"
            >
              <option value="all">Alle Vereine</option>
              {clubs.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Top 3 Section */}
        {hasHistory && top3.length > 0 && (
          <div className="relative pt-20 pb-12">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent blur-3xl rounded-full opacity-50" />
            
            <div className="grid grid-cols-3 items-end gap-2 sm:gap-4 max-w-4xl mx-auto relative z-10 px-2 sm:px-0">
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

                    <div className="text-center w-full px-1">
                      <div className="text-[13px] sm:text-lg font-black italic uppercase tracking-tighter sm:tracking-tight truncate">
                        {player.full_name}
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 mt-1">
                        <div className="text-[8px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest truncate max-w-[60px] sm:max-w-none">
                          {player.teams?.clubs?.name}
                        </div>
                        <div className="hidden sm:block w-1 h-1 bg-zinc-700 rounded-full" />
                        <div className="text-emerald-500 font-black italic text-[10px] sm:text-sm">
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
          <div className="grid grid-cols-[2.5rem_1fr_3.5rem] sm:grid-cols-[4rem_1fr_8rem_4rem] items-center px-6 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <span className="text-center">Rang</span>
            <span className="pl-4">Spieler</span>
            <span className="hidden sm:inline">Verein</span>
            <span className="text-right">OVR</span>
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
                  className="bg-white/5 border border-white/5 hover:border-emerald-500/30 hover:bg-white/10 p-3 sm:p-4 rounded-2xl grid grid-cols-[2.5rem_1fr_3.5rem] sm:grid-cols-[4rem_1fr_8rem_4rem] items-center group cursor-pointer transition-all gap-2"
                >
                  <div className="text-center font-black italic text-zinc-500 group-hover:text-emerald-500 transition-colors">
                    #{idx + (hasHistory ? 4 : 1)}
                  </div>

                  <div className="flex items-center gap-3 pl-1 sm:pl-4 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-zinc-800 rounded-xl overflow-hidden border border-white/10 shrink-0">
                      {player.photo_url ? (
                        <img src={player.photo_url} alt={player.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users className="w-6 h-6 text-zinc-700" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                        {player.full_name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {player.claimed_by_user_id && (
                          <span className="shrink-0 px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[6px] sm:text-[7px] font-black uppercase tracking-widest border border-emerald-500/20">
                            BEANSPRUCHT
                          </span>
                        )}
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest sm:hidden truncate opacity-60">
                          {player.teams?.clubs?.name}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 truncate">
                    {player.teams?.clubs?.logo_url && (
                      <img src={player.teams.clubs.logo_url} alt="" className="w-5 h-5 object-contain opacity-50 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest truncate">
                      {player.teams?.clubs?.name}
                    </span>
                  </div>

                  <div className="text-right font-black italic text-lg sm:text-xl text-emerald-500">
                    {player.current_stats?.overall}
                  </div>
                </motion.div>
              ))
            ) : filteredPlayers.length === 0 ? (
              <div className="py-20 text-center space-y-4 bg-white/5 rounded-3xl border border-dashed border-white/10">
                <Search className="w-12 h-12 text-zinc-800 mx-auto" />
                <div>
                  <h3 className="text-lg font-bold text-white">Keine Spieler gefunden</h3>
                  <p className="text-zinc-500 text-sm">Versuche deine Filter oder die Suchanfrage anzupassen.</p>
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
