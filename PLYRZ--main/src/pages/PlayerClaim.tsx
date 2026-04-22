import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Search, 
  Shield, 
  ChevronRight, 
  ArrowLeft, 
  Loader2, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Player, Team, Club } from '../types';
import { getPositionShort } from '../lib/positions';

export const PlayerClaim: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, t, c] = await Promise.all([
        supabaseService.getPlayers(),
        supabaseService.getTeams(),
        supabaseService.getClubs()
      ]);
      // Only show unclaimed players
      setPlayers(p.filter(player => !player.claimed_by_user_id));
      setTeams(t);
      setClubs(c);
    } catch (err) {
      console.error('Error loading players:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (playerId: string) => {
    setClaimingId(playerId);
    try {
      await supabaseService.claimPlayerCard(playerId);
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      alert(`Beanspruchung fehlgeschlagen: ${err.message}`);
    } finally {
      setClaimingId(null);
    }
  };

  const filteredPlayers = players.filter(p => 
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (success) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mb-8"
        >
          <CheckCircle2 className="w-12 h-12 text-white" />
        </motion.div>
        <h1 className="text-3xl font-black italic uppercase tracking-tight text-white mb-4">Karte beansprucht!</h1>
        <p className="text-zinc-500 max-w-xs">Deine Spielerkarte wurde erfolgreich mit deinem Account verknüpft. Du wirst zum Dashboard weitergeleitet...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white font-sans p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-900 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-2xl font-black italic uppercase tracking-tight">Beanspruche deine Karte</h1>
            <p className="text-zinc-500 text-sm">Finde deine bestehende Spielerkarte in unserer Datenbank.</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text"
            placeholder="Name suchen..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-6 py-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredPlayers.length > 0 ? (
              filteredPlayers.map(player => {
                const team = teams.find(t => t.id === player.team_id);
                const club = clubs.find(c => c.id === team?.club_id);
                return (
                  <motion.div 
                    key={player.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center gap-4 group"
                  >
                    <div className="w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center overflow-hidden">
                      {player.photo_url ? (
                        <img src={player.photo_url} alt={player.full_name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                      ) : (
                        <Users className="w-6 h-6 text-zinc-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-bold">{player.full_name}</h3>
                      <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">
                        {getPositionShort(player.position)} • {team?.name} • {club?.name}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleClaim(player.id)}
                      disabled={claimingId !== null}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                    >
                      {claimingId === player.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Beanspruchen'}
                    </button>
                  </motion.div>
                );
              })
            ) : (
              <div className="text-center py-12 space-y-4">
                <div className="p-4 bg-zinc-900 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8 text-zinc-700" />
                </div>
                <p className="text-zinc-500">Keine nicht beanspruchten Spieler für deine Suche gefunden.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerClaim;
