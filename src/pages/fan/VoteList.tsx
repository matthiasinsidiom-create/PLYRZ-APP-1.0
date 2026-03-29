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
  ThumbsUp,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../../services/supabaseService';
import { useAuth } from '../../context/AuthContext';
import { Fixture } from '../../types';

export const VoteList: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [checkins, setCheckins] = useState<string[]>([]);

  useEffect(() => {
    loadFixtures();
  }, [profile]);

  const loadFixtures = async () => {
    try {
      const [f, c] = await Promise.all([
        supabaseService.getFixtures(),
        profile ? supabaseService.getUserCheckins(profile.id) : Promise.resolve({ data: [] })
      ]);
      
      // Filter for matches that are finished and NOT processed
      // We'll also check if they have a rating history to see if they are processed
      const processedStatus = await Promise.all(
        f.filter(fixture => fixture.status === 'finished').map(async (fixture) => {
          const history = await supabaseService.getFixtureRatingHistory(fixture.id);
          return { id: fixture.id, isProcessed: history.length > 0 };
        })
      );

      const processedMap: Record<string, boolean> = {};
      processedStatus.forEach(status => {
        processedMap[status.id] = status.isProcessed;
      });

      // Show matches that are finished and not processed
      const votingFixtures = f.filter(fixture => 
        fixture.status === 'finished' && !processedMap[fixture.id]
      );

      setFixtures(votingFixtures);
      
      if (c.data) {
        setCheckins(c.data.map((checkin: any) => checkin.fixture_id));
      }
    } catch (err) {
      console.error('Error loading fixtures for voting:', err);
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
    <div className="min-h-screen bg-transparent text-white font-sans pb-32">
      {/* Header */}
      <div className="p-6 flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-50 border-b border-white/5">
        <h1 className="text-xl font-black italic tracking-tighter uppercase">Open Voting</h1>
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
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
            <ThumbsUp className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black italic uppercase tracking-tight">Your Voice Matters</h3>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
              Vote for your teammates and opponents to help determine the Man of the Match and update player ratings.
            </p>
          </div>
        </div>

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
                {checkins.includes(fixture.id) ? (
                  <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="text-[8px]">CHECKED IN</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    <AlertCircle className="w-3 h-3" />
                    <span className="text-[8px]">CHECK-IN REQUIRED</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 text-center space-y-2">
                  <div className="w-10 h-10 bg-zinc-800 rounded-xl mx-auto flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                    <Shield className="w-5 h-5 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <div className="text-[10px] font-bold text-white italic uppercase tracking-tight line-clamp-1">
                    {(fixture as any).home_team?.clubs?.name}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="text-lg font-black italic text-zinc-700 group-hover:text-white transition-colors">
                    {fixture.home_score} - {fixture.away_score}
                  </div>
                  <div className="text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                    FINISHED
                  </div>
                </div>

                <div className="flex-1 text-center space-y-2">
                  <div className="w-10 h-10 bg-zinc-800 rounded-xl mx-auto flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                    <Shield className="w-5 h-5 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <div className="text-[10px] font-bold text-white italic uppercase tracking-tight line-clamp-1">
                    {(fixture as any).away_team?.clubs?.name}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-center">
                <div className="flex items-center gap-2 bg-emerald-500 text-black px-6 py-2 rounded-xl text-[10px] font-black italic uppercase tracking-tighter hover:bg-emerald-400 transition-all">
                  <ThumbsUp className="w-3 h-3" />
                  Vote Now
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="py-20 text-center space-y-4">
            <Trophy className="w-12 h-12 text-zinc-800 mx-auto" />
            <p className="text-zinc-500 font-medium">No matches open for voting.</p>
            <p className="text-zinc-600 text-xs max-w-xs mx-auto">
              Matches appear here once they are finished and before the results are finalized.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoteList;
