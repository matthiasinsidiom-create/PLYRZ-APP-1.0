import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, 
  Shield, 
  Users, 
  Calendar, 
  ChevronRight,
  LayoutGrid,
  ListOrdered,
  ArrowLeft
} from 'lucide-react';
import { supabaseService } from '../services/supabaseService';

const AdminCard = ({ title, icon: Icon, count, onClick, color }: any) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl flex flex-col items-start gap-4 text-left w-full group transition-all hover:border-emerald-500/30"
  >
    <div className={`p-3 rounded-xl ${color} bg-opacity-10 group-hover:bg-opacity-20 transition-all`}>
      <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
    </div>
    <div>
      <h3 className="text-zinc-400 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold text-white mt-1">{count}</p>
    </div>
    <div className="mt-auto pt-4 flex items-center text-zinc-500 text-xs font-medium uppercase tracking-wider group-hover:text-emerald-500 transition-colors">
      Verwalten <ChevronRight className="w-3 h-3 ml-1" />
    </div>
  </motion.button>
);

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ leagues: 0, clubs: 0, teams: 0, players: 0, fixtures: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [l, c, t, p, f] = await Promise.all([
        supabaseService.getLeagues(),
        supabaseService.getClubs(),
        supabaseService.getTeams(),
        supabaseService.getPlayers(),
        supabaseService.getFixtures()
      ]);
      setStats({
        leagues: l.length,
        clubs: c.length,
        teams: t.length,
        players: p.length,
        fixtures: f.length
      });
    } catch (err) {
      console.error('Error loading admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent p-6 text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <h1 className="text-3xl font-black italic tracking-tighter uppercase">ADMIN BEREICH</h1>
              <p className="text-zinc-500 font-medium text-sm">Verwalte das PLYRZ Ökosystem</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AdminCard 
              title="Ligen" 
              icon={Trophy} 
              count={stats.leagues} 
              color="bg-emerald-500" 
              onClick={() => navigate('/admin/leagues')} 
            />
            <AdminCard 
              title="Vereine" 
              icon={Shield} 
              count={stats.clubs} 
              color="bg-blue-500" 
              onClick={() => navigate('/admin/clubs')} 
            />
            <AdminCard 
              title="Teams" 
              icon={LayoutGrid} 
              count={stats.teams} 
              color="bg-purple-500" 
              onClick={() => navigate('/admin/teams')} 
            />
            <AdminCard 
              title="Spieler" 
              icon={Users} 
              count={stats.players} 
              color="bg-orange-500" 
              onClick={() => navigate('/admin/players')} 
            />
            <AdminCard 
              title="Spiele" 
              icon={Calendar} 
              count={stats.fixtures} 
              color="bg-red-500" 
              onClick={() => navigate('/admin/fixtures')} 
            />
            <AdminCard 
              title="Aufstellungen" 
              icon={ListOrdered} 
              count="Aktiv" 
              color="bg-yellow-500" 
              onClick={() => navigate('/admin/lineups')} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
