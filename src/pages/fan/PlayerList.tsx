import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Search, 
  Loader2, 
  Filter,
  Trophy,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { Player, Team, PlayerStats } from '../../types';
import { PlayerCard } from '../../components/PlayerCard';

const PlayerList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<(Player & { teams: { name: string, club_id: string, clubs: { logo_url: string } }, player_stats: PlayerStats[] })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<string>('All');

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const data = await supabaseService.getPlayers();
      console.log(`DEBUG: [UI] PlayerList loaded ${data.length} players`);
      if (data.length > 0) {
        console.log(`DEBUG: [UI] First player current stats:`, data[0].current_stats);
      }
      setPlayers(data as any);
    } catch (err) {
      console.error('Error loading players:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter(p => {
    const matchesSearch = p.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = selectedPosition === 'All' || p.position === selectedPosition;
    return matchesSearch && matchesPosition;
  });

  const positions = ['All', 'Goalkeeper', 'Defender', 'Midfielder', 'Forward'];

  return (
    <div className="min-h-screen bg-transparent text-white font-sans pb-24">
      {/* Header */}
      <div className="p-6 sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-50 border-b border-white/5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-zinc-400" />
            </button>
            <div className="flex items-center gap-2">
              <img 
                src="/assets/plyrzlogo.png" 
                alt="PLYRZ Logo" 
                className="h-16 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input 
              type="text"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {positions.map(pos => (
              <button
                key={pos}
                onClick={() => setSelectedPosition(pos)}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                  selectedPosition === pos 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-black/40 backdrop-blur-sm text-zinc-500 border border-white/10 hover:border-white/20'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* GLOBAL DEBUG BLOCK */}
        {!loading && (
          <div className="mb-8 p-4 bg-black/95 border border-emerald-500/50 rounded-2xl font-mono text-[10px] text-emerald-400 space-y-1 w-full pointer-events-none z-50">
            <div className="font-bold border-b border-emerald-500/20 pb-1 mb-1 text-xs uppercase tracking-widest">GLOBAL PLAYER STATS DEBUG</div>
            <div className="flex justify-between">
              <span>Total Players Loaded: {players.length}</span>
              <span className="text-zinc-500">Timestamp: {new Date().toLocaleTimeString()}</span>
            </div>
            <div className="pt-1 border-t border-emerald-500/10 mt-1">
              <div className="text-emerald-300 font-bold">Stats Availability Check:</div>
              <div className="grid grid-cols-2 gap-2">
                <div>Players with Stats: {players.filter(p => p.player_stats && p.player_stats.length > 0).length}</div>
                <div>Players without Stats: {players.filter(p => !p.player_stats || p.player_stats.length === 0).length}</div>
              </div>
              <div className="mt-1 text-[8px] text-zinc-500 italic">
                Note: If "Players with Stats" is 0, the player_stats table might be empty or RLS is blocking reads.
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredPlayers.length > 0 ? (
              filteredPlayers.map((player) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -10 }}
                  onClick={() => navigate(`/players/${player.id}`)}
                  className="cursor-pointer"
                >
                  <PlayerCard 
                    player={player}
                    clubLogo={player.teams?.clubs?.logo_url}
                  />
                  
                  {/* TEMPORARY DEBUG BLOCK */}
                  <div className="mt-4 p-4 bg-black/95 border border-emerald-500/50 rounded-2xl font-mono text-[10px] text-emerald-400 space-y-1 pointer-events-none z-50 relative">
                    <div className="font-bold border-b border-emerald-500/20 pb-1 mb-1 flex justify-between">
                      <span>DEBUG DATA</span>
                      <span className="text-zinc-500">{player.full_name}</span>
                    </div>
                    <div>Player ID: {player.id}</div>
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
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-20 text-center space-y-4">
                <Search className="w-12 h-12 text-zinc-800 mx-auto" />
                <p className="text-zinc-500 font-medium">No players found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerList;
