import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Award,
  History,
  Info
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { Player, PlayerStats, PlayerRatingHistory, Team, Club } from '../../types';
import { PlayerCard } from '../../components/PlayerCard';

const PlayerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<(Player & { teams: Team & { clubs: Club }, player_stats: PlayerStats[] }) | null>(null);
  const [history, setHistory] = useState<(PlayerRatingHistory & { fixtures: { kickoff_at: string } })[]>([]);

  useEffect(() => {
    if (id) {
      loadPlayerData();
    }
  }, [id]);

  const loadPlayerData = async () => {
    setLoading(true);
    try {
      const [playerData, historyData] = await Promise.all([
        supabaseService.getPlayerById(id!),
        supabaseService.getPlayerRatingHistory(id!)
      ]);
      setPlayer(playerData);
      setHistory(historyData);
    } catch (err) {
      console.error('Error loading player details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white p-6 flex flex-col items-center justify-center space-y-4">
        <Info className="w-12 h-12 text-zinc-700" />
        <h2 className="text-xl font-bold">Player not found</h2>
        <button 
          onClick={() => navigate(-1)}
          className="text-emerald-500 font-bold flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  const stats = player.player_stats?.[0];
  const clubLogo = player.teams?.clubs?.logo_url;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans pb-24">
      {/* Header */}
      <div className="p-6 sticky top-0 bg-[#0A0A0A]/80 backdrop-blur-md z-50 flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </button>
        <div>
          <h1 className="text-xl font-black italic tracking-tighter uppercase">Player Profile</h1>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{player.full_name}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-12">
        {/* Card Section */}
        <section className="flex flex-col items-center space-y-8">
          <PlayerCard 
            player={player} 
            clubLogo={clubLogo}
          />
          
          <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-center">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Position</div>
              <div className="text-lg font-black italic text-white uppercase">{player.position}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-center">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Number</div>
              <div className="text-lg font-black italic text-white uppercase">#{player.shirt_number || '--'}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-center">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Birth Year</div>
              <div className="text-lg font-black italic text-white uppercase">{player.birth_year || '--'}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-center">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Team</div>
              <div className="text-lg font-black italic text-white uppercase line-clamp-1">{player.teams?.name}</div>
            </div>
          </div>
        </section>

        {/* Rating History */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <History className="w-5 h-5 text-emerald-500" />
            </div>
            <h2 className="text-xl font-black italic uppercase tracking-tight">Rating History</h2>
          </div>

          <div className="space-y-4">
            {history.length > 0 ? (
              history.map((item) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${item.delta_overall >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      {item.delta_overall >= 0 ? (
                        <TrendingUp className={`w-5 h-5 ${item.delta_overall > 0 ? 'text-emerald-500' : 'text-zinc-500'}`} />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        {item.delta_overall > 0 ? `+${item.delta_overall}` : item.delta_overall} Rating Change
                      </div>
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.processed_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">New Overall</div>
                    <div className="text-xl font-black italic text-white">{item.new_overall}</div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-12 text-center bg-zinc-900/50 border border-dashed border-zinc-800 rounded-3xl">
                <Award className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-500 font-medium">No rating history available yet.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PlayerDetail;
