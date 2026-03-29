import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Users,
  Loader2,
  Award,
  ChevronRight,
  Info,
  Calendar,
  Clock,
  Shield,
  MapPin
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { useAuth } from '../../context/AuthContext';
import { Fixture, Player, PlayerStats, Team, Club } from '../../types';
import { PlayerCard } from '../../components/PlayerCard';

interface RatingHistoryEntry {
  id: string;
  fixture_id: string;
  player_id: string;
  old_overall: number;
  new_overall: number;
  delta_overall: number;
  up_votes: number;
  down_votes: number;
  processed_at: string;
  shirt_number?: number | null;
  lineup_role?: 'starter' | 'sub';
  players: Player & { teams: { name: string, clubs: { logo_url: string } } };
}

const MatchResult: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [results, setResults] = useState<RatingHistoryEntry[]>([]);
  const [lineup, setLineup] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fixtureData, resultsData, lineupData] = await Promise.all([
        supabaseService.getFixtureById(id!),
        supabaseService.getFixtureRatingHistory(id!),
        supabaseService.getFixtureLineupWithPlayers(id!)
      ]);
      
      setFixture(fixtureData);
      
      // Merge lineup data into results to get shirt_number and lineup_role
      const mergedResults = resultsData.map((result: any) => {
        const lineupEntry = lineupData.find((l: any) => l.player_id === result.player_id);
        return {
          ...result,
          shirt_number: lineupEntry?.shirt_number,
          lineup_role: lineupEntry?.lineup_role
        };
      });
      
      setResults(mergedResults);
      setLineup(lineupData);
    } catch (err) {
      console.error('Error loading match results:', err);
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

  if (!fixture || results.length === 0) {
    return (
      <div className="min-h-screen bg-transparent text-white p-6 flex flex-col items-center justify-center space-y-6">
        <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center border border-white/5">
          <Info className="w-10 h-10 text-zinc-700" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">No Results Yet</h2>
          <p className="text-zinc-500 max-w-xs mx-auto">This match hasn't been processed or rated by the community yet.</p>
        </div>
        
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={() => navigate(-1)}
            className="w-full bg-zinc-800 text-white font-bold py-4 rounded-2xl border border-white/5 hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" /> Go Back
          </button>

          {/* Admin Fallback Button */}
          {isAdmin && (
            <button 
              onClick={async () => {
                try {
                  setLoading(true);
                  await supabaseService.processFixtureRatings(id!);
                  await loadData();
                  alert('Results processed successfully!');
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Failed to process');
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full bg-emerald-500 text-black font-black italic uppercase tracking-tighter py-4 rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
            >
              <Trophy className="w-5 h-5" /> Process Results Now
            </button>
          )}
        </div>
      </div>
    );
  }

  // Sort results for different sections
  const sortedByRating = [...results].sort((a, b) => b.new_overall - a.new_overall);
  const sortedByUpgrade = [...results].sort((a, b) => b.delta_overall - a.delta_overall);
  const sortedByDrop = [...results].sort((a, b) => a.delta_overall - b.delta_overall);

  // MOTM: Highest new_overall in this match
  const motm = sortedByRating[0];

  // Top 5 Players
  const topPlayers = sortedByRating.slice(0, 5);

  // Biggest Upgrades (Top 3)
  const biggestUpgrades = sortedByUpgrade.filter(r => r.delta_overall > 0).slice(0, 3);

  // Biggest Drops (Top 3)
  const biggestDrops = sortedByDrop.filter(r => r.delta_overall < 0).slice(0, 3);

  // Team Breakdown
  const homePlayers = lineup.filter(e => e.team_id === fixture.home_team_id);
  const awayPlayers = lineup.filter(e => e.team_id === fixture.away_team_id);

  const getResultForPlayer = (playerId: string) => {
    return results.find(r => r.player_id === playerId);
  };

  return (
    <div className="min-h-screen bg-transparent text-white font-sans pb-24">
      {/* Header */}
      <div className="p-6 sticky top-0 bg-black/20 backdrop-blur-xl z-50 border-b border-white/5 flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </button>
        <div>
          <h1 className="text-xl font-black italic tracking-tighter uppercase">Match Results</h1>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            {new Date(fixture.kickoff_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-16">
        {/* Match Scoreboard */}
        <section className="bg-black/40 backdrop-blur-md border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
          
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 text-center space-y-3">
              <div className="w-20 h-20 bg-white/5 rounded-3xl mx-auto flex items-center justify-center p-4 border border-white/5">
                <img src={fixture.home_team?.clubs?.logo_url || "/assets/clubs/rw.png"} alt="" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-sm font-black italic uppercase tracking-tight line-clamp-1">{fixture.home_team?.name}</h3>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="text-5xl font-black italic tracking-tighter flex items-center gap-4">
                <span>{fixture.home_score ?? '-'}</span>
                <span className="text-zinc-800">:</span>
                <span>{fixture.away_score ?? '-'}</span>
              </div>
              <div className="px-3 py-1 bg-emerald-500/10 rounded-full">
                <span className="text-[10px] font-black italic uppercase text-emerald-500 tracking-widest">Final Result</span>
              </div>
            </div>

            <div className="flex-1 text-center space-y-3">
              <div className="w-20 h-20 bg-white/5 rounded-3xl mx-auto flex items-center justify-center p-4 border border-white/5">
                <img src={fixture.away_team?.clubs?.logo_url || "/assets/clubs/rw.png"} alt="" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-sm font-black italic uppercase tracking-tight line-clamp-1">{fixture.away_team?.name}</h3>
            </div>
          </div>
        </section>

        {/* SECTION 1: MAN OF THE MATCH */}
        {motm && (
          <section className="space-y-8 flex flex-col items-center">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-full border border-yellow-500/20 mb-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-[10px] font-black italic uppercase text-yellow-500 tracking-widest">Man of the Match</span>
              </div>
              <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">The MVP</h2>
            </div>

            <div className="relative group">
              <div className="absolute -inset-4 bg-yellow-500/20 blur-3xl rounded-full opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative">
                <PlayerCard 
                  player={motm.players} 
                  clubLogo={motm.players.teams?.clubs?.logo_url}
                  shirtNumber={motm.shirt_number}
                  lineupRole={motm.lineup_role}
                  onClick={() => navigate(`/players/${motm.player_id}`)}
                />
                
                <div className="absolute -right-12 top-1/2 -translate-y-1/2 space-y-4">
                  <div className="bg-black/80 backdrop-blur-xl border border-yellow-500/50 p-4 rounded-2xl shadow-2xl">
                    <div className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-1">Rating</div>
                    <div className="text-3xl font-black italic text-white leading-none">{motm.new_overall}</div>
                    <div className="flex items-center gap-1 mt-1 text-emerald-500 font-bold text-xs">
                      <TrendingUp className="w-3 h-3" />
                      +{motm.delta_overall}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 2: TOP PLAYERS */}
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Award className="w-5 h-5 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black italic uppercase tracking-tight">Top Performers</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {topPlayers.map((result, index) => (
              <motion.div 
                key={result.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center border border-white/10 z-20 font-black italic text-xl text-emerald-500">
                  #{index + 1}
                </div>
                <div className="transform scale-90 origin-top-left">
                  <PlayerCard 
                    player={result.players} 
                    clubLogo={result.players.teams?.clubs?.logo_url}
                    shirtNumber={result.shirt_number}
                    lineupRole={result.lineup_role}
                    onClick={() => navigate(`/players/${result.player_id}`)}
                  />
                </div>
                <div className="mt-[-40px] ml-4 bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-2xl relative z-20 max-w-[200px]">
                   <div className="flex items-center justify-between">
                     <div>
                       <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Rating</div>
                       <div className="text-xl font-black italic text-white">{result.new_overall}</div>
                     </div>
                     <div className={`flex items-center gap-1 font-bold text-xs ${result.delta_overall >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                       {result.delta_overall >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                       {result.delta_overall > 0 ? `+${result.delta_overall}` : result.delta_overall}
                     </div>
                   </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* SECTION 3 & 4: UPGRADES & DROPS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* BIGGEST UPGRADES */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <h2 className="text-xl font-black italic uppercase tracking-tight">Biggest Upgrades</h2>
            </div>

            <div className="space-y-4">
              {biggestUpgrades.map((result) => (
                <div 
                  key={result.id} 
                  onClick={() => navigate(`/players/${result.player_id}`)}
                  className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-sm font-black uppercase italic text-white">
                        {result.players.full_name}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{result.players.teams?.name}</div>
                        <div className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${result.lineup_role === 'starter' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                          {result.lineup_role === 'starter' ? 'Starter' : 'Sub'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Old</div>
                      <div className="text-sm font-black italic text-zinc-500">{result.old_overall}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-800" />
                    <div className="text-center">
                      <div className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">New</div>
                      <div className="text-lg font-black italic text-white">{result.new_overall}</div>
                    </div>
                    <div className="bg-emerald-500/20 px-2 py-1 rounded-lg text-emerald-500 font-black italic text-xs">
                      +{result.delta_overall}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* BIGGEST DROPS */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <h2 className="text-xl font-black italic uppercase tracking-tight">Biggest Drops</h2>
            </div>

            <div className="space-y-4">
              {biggestDrops.map((result) => (
                <div 
                  key={result.id} 
                  onClick={() => navigate(`/players/${result.player_id}`)}
                  className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                      <TrendingDown className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <div className="text-sm font-black uppercase italic text-white">
                        {result.players.full_name}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{result.players.teams?.name}</div>
                        <div className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${result.lineup_role === 'starter' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                          {result.lineup_role === 'starter' ? 'Starter' : 'Sub'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Old</div>
                      <div className="text-sm font-black italic text-zinc-500">{result.old_overall}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-800" />
                    <div className="text-center">
                      <div className="text-[8px] font-bold text-red-500 uppercase tracking-widest">New</div>
                      <div className="text-lg font-black italic text-white">{result.new_overall}</div>
                    </div>
                    <div className="bg-red-500/20 px-2 py-1 rounded-lg text-red-500 font-black italic text-xs">
                      {result.delta_overall}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* SECTION 5: TEAM BREAKDOWN */}
        <section className="space-y-12">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-lg">
              <Users className="w-5 h-5 text-zinc-400" />
            </div>
            <h2 className="text-2xl font-black italic uppercase tracking-tight">Team Breakdown</h2>
          </div>

          {/* Home Team */}
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/5 rounded-2xl p-2 border border-white/5">
                <img src={fixture.home_team?.clubs?.logo_url || "/assets/clubs/rw.png"} alt="" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-xl font-black italic uppercase tracking-tight text-white">{fixture.home_team?.name}</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {homePlayers.map((entry) => {
                const result = getResultForPlayer(entry.player_id);
                return (
                  <div key={entry.player_id} className="relative group">
                    <PlayerCard 
                      player={entry.players} 
                      clubLogo={entry.players.teams?.clubs?.logo_url}
                      shirtNumber={entry.shirt_number}
                      lineupRole={entry.lineup_role}
                      onClick={() => navigate(`/players/${entry.player_id}`)}
                    />
                    {result && (
                      <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-xl border border-white/10 p-2 rounded-xl z-30">
                        <div className={`flex items-center gap-1 font-black italic text-xs ${result.delta_overall >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {result.delta_overall > 0 ? `+${result.delta_overall}` : result.delta_overall}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Away Team */}
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/5 rounded-2xl p-2 border border-white/5">
                <img src={fixture.away_team?.clubs?.logo_url || "/assets/clubs/rw.png"} alt="" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-xl font-black italic uppercase tracking-tight text-white">{fixture.away_team?.name}</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {awayPlayers.map((entry) => {
                const result = getResultForPlayer(entry.player_id);
                return (
                  <div key={entry.player_id} className="relative group">
                    <PlayerCard 
                      player={entry.players} 
                      clubLogo={entry.players.teams?.clubs?.logo_url}
                      shirtNumber={entry.shirt_number}
                      lineupRole={entry.lineup_role}
                      onClick={() => navigate(`/players/${entry.player_id}`)}
                    />
                    {result && (
                      <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-xl border border-white/10 p-2 rounded-xl z-30">
                        <div className={`flex items-center gap-1 font-black italic text-xs ${result.delta_overall >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {result.delta_overall > 0 ? `+${result.delta_overall}` : result.delta_overall}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MatchResult;
