import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Loader2,
  Trophy,
  ThumbsUp,
  ChevronRight,
  User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../../services/supabaseService';
import { useAuth } from '../../context/AuthContext';
import { Fixture } from '../../types';
import { MatchCard } from '../../components/MatchCard';
import { VotingCountdown } from '../../components/VotingCountdown';

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
      console.log('DEBUG: [VoteList] loadFixtures started', { profileId: profile?.id });
      const [votingFixtures, c] = await Promise.all([
        supabaseService.getOpenVotingFixtures(),
        profile ? supabaseService.getUserCheckins(profile.id) : Promise.resolve({ data: [] })
      ]);
      
      console.log(`DEBUG: [VoteList] Received ${votingFixtures.length} voting fixtures`);
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
    <div className="min-h-screen bg-transparent text-white font-sans pb-28">
      {/* Header */}
      <div className="p-6 pt-[10px] flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-50 border-b border-white/5">
        <h1 className="text-xl font-black italic tracking-tighter uppercase">Offene Votings</h1>
        <div className="flex items-center gap-3">
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

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
            <ThumbsUp className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black italic uppercase tracking-tight">Deine Stimme zählt</h3>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
              Vote für deine Teamkollegen und Gegner, um den Spieler des Spiels zu bestimmen und die Spieler-Ratings zu aktualisieren.
            </p>
          </div>
        </div>

        {fixtures.length > 0 ? (
          fixtures.map((fixture, index) => (
            <MatchCard
              key={fixture.id}
              fixture={fixture}
              hasCheckedIn={checkins.includes(fixture.id)}
              onClick={() => navigate(`/matches/${fixture.id}`)}
            >
              <div className="flex flex-col w-full gap-4">
                {fixture.voting_close_at && (
                  <div className="flex items-center justify-center">
                    <VotingCountdown 
                      closeAt={fixture.voting_close_at} 
                      onClose={loadFixtures}
                    />
                  </div>
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/matches/${fixture.id}`);
                  }}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] text-xs uppercase tracking-widest"
                >
                  <ThumbsUp className="w-4 h-4" />
                  JETZT VOTEN
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </MatchCard>
          ))
        ) : (
          <div className="py-20 text-center space-y-4">
            <Trophy className="w-12 h-12 text-zinc-800 mx-auto" />
            <p className="text-zinc-500 font-medium">Keine Spiele offen für Votings.</p>
            <p className="text-zinc-600 text-xs max-w-xs mx-auto">
              Spiele erscheinen hier, sobald sie beendet sind und bevor die Ergebnisse berechnet wurden.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoteList;
