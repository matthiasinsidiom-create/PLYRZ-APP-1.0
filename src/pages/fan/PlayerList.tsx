import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Search, 
  Loader2, 
  Filter,
  Trophy,
  ChevronRight
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { Player, Team, PlayerStats } from '../../types';
import { PlayerCard } from '../../components/PlayerCard';

const PlayerList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<(Player & { teams: { name: string, clubs: { logo_url: string } }, player_stats: PlayerStats[] })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<string>('All');

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const data = await supabaseService.getPlayers();
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
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans pb-24">
      {/* Header */}
      <div className="p-6 sticky top-0 bg-[#0A0A0A]/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center rotate-6">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter uppercase">Players</h1>
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
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
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
                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
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
