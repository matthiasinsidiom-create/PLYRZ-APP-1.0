import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Shield, 
  ChevronRight,
  Loader2,
  Trophy,
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../../services/supabaseService';
import { useAuth } from '../../context/AuthContext';
import { Fixture, Team } from '../../types';

export const MatchList: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
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
    loadFixtures();
  }, [profile]);

  const loadFixtures = async () => {
    try {
      const [f, c] = await Promise.all([
        supabaseService.getFixtures(),
        profile ? supabaseService.getUserCheckins(profile.id) : Promise.resolve({ data: [] })
      ]);
      
      setFixtures(f);
      if (c.data) {
        const checkinIds = c.data.map((checkin: any) => checkin.fixture_id);
        setCheckins(checkinIds);
        if (profile) {
          try {
            localStorage.setItem(`checkins_${profile.id}`, JSON.stringify(checkinIds));
          } catch (err) {
            console.error('Error saving checkins to localStorage:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error loading fixtures:', err);
    } finally {
      setLoading(false);
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
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black italic tracking-tighter uppercase">Matches</h1>
        </div>
        <div className="flex items-center gap-2">
          <img 
            src="/assets/plyrzlogo.png" 
            alt="PLYRZ Logo" 
            className="h-24 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {fixtures.length > 0 ? (
          fixtures.map((fixture, index) => (
            <motion.div
              key={fixture.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(`/matches/${fixture.id}`)}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 hover:border-emerald-500/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  {new Date(fixture.kickoff_at).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  {new Date(fixture.kickoff_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                {checkins.includes(fixture.id) && (
                  <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="text-[8px]">CHECKED IN</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 text-center space-y-2">
                  <div className="w-12 h-12 bg-zinc-800 rounded-xl mx-auto flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                    <Shield className="w-6 h-6 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-white italic uppercase tracking-tight line-clamp-1">
                      {(fixture as any).home_team?.clubs?.name}
                    </div>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest line-clamp-1">
                      {(fixture as any).home_team?.name}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="text-xl font-black italic text-zinc-700 group-hover:text-white transition-colors">
                    {fixture.status === 'finished' ? `${fixture.home_score} - ${fixture.away_score}` : 'VS'}
                  </div>
                  <div className={`text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full ${
                    fixture.status === 'finished' ? 'bg-zinc-800 text-zinc-400' : 
                    fixture.status === 'live' ? 'bg-red-500 text-white animate-pulse' : 
                    'bg-emerald-500/10 text-emerald-500'
                  }`}>
                    {fixture.status}
                  </div>
                </div>

                <div className="flex-1 text-center space-y-2">
                  <div className="w-12 h-12 bg-zinc-800 rounded-xl mx-auto flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                    <Shield className="w-6 h-6 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-white italic uppercase tracking-tight line-clamp-1">
                      {(fixture as any).away_team?.clubs?.name}
                    </div>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest line-clamp-1">
                      {(fixture as any).away_team?.name}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                  <MapPin className="w-3 h-3" />
                  {fixture.venue_name}
                </div>
                <div className="flex items-center gap-2">
                  {fixture.status === 'finished' && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/matches/${fixture.id}/result`);
                      }}
                      className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-xl border border-emerald-500/20 text-[10px] font-black italic uppercase tracking-tighter hover:bg-emerald-500 hover:text-black transition-all"
                    >
                      <Trophy className="w-3 h-3" />
                      Results
                    </button>
                  )}
                  <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-xl border border-emerald-500/20 text-[10px] font-black italic uppercase tracking-tighter group-hover:bg-emerald-500 group-hover:text-black transition-all">
                    Open Match
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="py-20 text-center space-y-4">
            <Calendar className="w-12 h-12 text-zinc-800 mx-auto" />
            <p className="text-zinc-500 font-medium">No matches found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchList;
