import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Shield, 
  Users, 
  Calendar,
  Star, 
  QrCode, 
  ChevronRight,
  TrendingUp,
  Search,
  Loader2,
  AlertCircle,
  X,
  ArrowLeft,
  CheckCircle2,
  Settings,
  User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SafeAreaWrapper from '../components/SafeAreaWrapper';
import { supabaseService } from '../services/supabaseService';
import { Player, Fixture, Club, Team, PlayerStats, MatchEvent } from '../types';
import { PlayerCard } from '../components/PlayerCard';
import { MatchCard } from '../components/MatchCard';
import { calculateMatchScore, getLiveMatchMinute } from '../lib/score';

// --- MAIN DASHBOARD ---

export const Dashboard: React.FC = () => {
  const { profile, isAdmin, hasAdminAccess, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [playerData, setPlayerData] = useState<Player | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [topPlayers, setTopPlayers] = useState<Player[]>([]);
  const [seasonWinner, setSeasonWinner] = useState<any>(null);
  const [loadingTopPlayers, setLoadingTopPlayers] = useState(true);
  const [mvpKM, setMvpKM] = useState<Player | null>(null);
  const [mvpReserve, setMvpReserve] = useState<Player | null>(null);
  const [fixtureKM, setFixtureKM] = useState<Fixture | null>(null);
  const [fixtureReserve, setFixtureReserve] = useState<Fixture | null>(null);
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [hasHistory, setHasHistory] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  
  const [showSeasonTeaser, setShowSeasonTeaser] = useState(false);

  useEffect(() => {
    // Only show season teaser if we actually have history and all fixtures are finished/cancelled
    if (fixtures.length > 0 && hasHistory && fixtures.every(f => f.status === 'finished' || f.status === 'cancelled')) {
      setShowSeasonTeaser(true);
    } else {
      setShowSeasonTeaser(false);
    }
  }, [fixtures, hasHistory]);

  const renderSeasonEndTeaser = () => {
    const winner = seasonWinner || (topPlayers && topPlayers[0]) || null;
    if (!winner) return null;

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full bg-[#050505] backdrop-blur-3xl border border-amber-500/20 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 flex flex-col items-center justify-between relative overflow-hidden shadow-2xl"
      >
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] sm:w-[350px] sm:h-[350px] bg-amber-500/15 blur-[80px] sm:blur-[100px] pointer-events-none rounded-full z-0" />
        
        {/* Vignette */}
        <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.9)] z-0 pointer-events-none"></div>

        {/* Header */}
        <div className="text-center mb-8 relative z-10 w-full flex flex-col items-center">
          <div className="inline-flex items-center justify-center p-3 sm:p-4 bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border border-amber-500/30 rounded-full mb-4 shadow-[0_0_40px_rgba(245,158,11,0.2)]">
            <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400 drop-shadow-md" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-transparent px-2 w-full truncate drop-shadow-lg">TOP 10 DER SAISON</h2>
          <div className="text-[10px] sm:text-[11px] font-bold text-amber-500/80 uppercase tracking-[0.2em] mt-1">
            PLYRZ Award
          </div>
        </div>

        {/* Card & Details */}
        <div className="flex flex-col items-center relative z-10 w-full mb-8">
          <div className="relative w-[175px] h-[245px] sm:w-[210px] sm:h-[294px] drop-shadow-2xl z-10 mx-auto mb-6">
            <div className="absolute inset-0 bg-amber-500/20 blur-[40px] rounded-full z-0"></div>
            <div className="absolute top-0 left-0 w-[350px] h-[490px] origin-top-left scale-[0.5] sm:scale-[0.6] z-10">
              <PlayerCard 
                player={winner} 
                clubLogo={teams.find(t => t.id === winner.team_id)?.clubs?.logo_url}
              />
            </div>
          </div>
          
          <div className="text-center space-y-1 w-full">
            <div className="text-xl sm:text-2xl font-black italic uppercase text-white tracking-widest drop-shadow-md truncate px-2">🥇 {winner.full_name}</div>
            <div className="text-xs sm:text-sm font-black uppercase tracking-widest text-zinc-400">
              OVR <span className="text-white italic">{winner.current_stats?.overall || '-'}</span>
            </div>
          </div>
        </div>

        {/* Button */}
        <button 
          onClick={() => navigate('/season-top3')}
          className="w-full relative z-10 bg-amber-500 text-black font-black italic uppercase tracking-widest py-4 rounded-full sm:rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:scale-[1.02] active:scale-95 text-sm sm:text-base"
        >
          TOP 10 ANSEHEN
        </button>
      </motion.div>
    );
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollCenter = container.scrollLeft + container.clientWidth / 2;
    const children = Array.from(container.children) as HTMLElement[];
    let closestIndex = 0;
    let minDistance = Infinity;

    children.forEach((child, index) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const distance = Math.abs(scrollCenter - childCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    if (closestIndex !== activeCardIndex) {
      setActiveCardIndex(closestIndex);
    }
  };
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
    loadDashboardData();
    loadTopPlayers();

    // Trigger deactivation of Gerersdorf players once for the admin
    // if (isAdmin) {
    //   supabaseService.deactivateGerersdorfPlayers().then(res => {
    //     if (res?.success) {
    //       console.log('DEBUG: [ADMIN] FCU Gerersdorf players deactivation triggered successfully.');
    //     }
    //   });
    // }
  }, [profile, isAdmin]);

  const [heroFixture, setHeroFixture] = useState<Fixture | null>(null);
  const [heroStatus, setHeroStatus] = useState<'live' | 'voting' | 'result' | 'none'>('none');

  const loadDashboardData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Load all necessary data
      const [f, t, p] = await Promise.all([
        supabaseService.getFixtures(profile.selected_league_id),
        supabaseService.getTeams(undefined, profile.selected_league_id),
        supabaseService.getPlayers(undefined, profile.selected_league_id)
      ]);
      
      setFixtures(f); 
      setTeams(t);
      setPlayers(p);

      const now = new Date();
      
      // Calculate Current Round
      // 1. Find next upcoming match
      const upcoming = [...f]
        .filter(fixture => fixture.status === 'upcoming')
        .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())[0];
      
      let round = upcoming?.round_number || null;
      
      // 2. Fallback: Last played match round
      if (!round) {
        const lastPlayed = [...f]
          .filter(fixture => fixture.status === 'finished')
          .sort((a, b) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime())[0];
        round = lastPlayed?.round_number || null;
      }
      
      setCurrentRound(round);
      console.log(`DEBUG: aktuelle Runde berechnet: ${round}`);

      let status: 'live' | 'voting' | 'result' | 'none' = 'none';

      // Load MVPs - Get all processed matches within the last 24 hours to find the absolute latest for KM/Reserve
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
      const processedMatches = f.filter(fixture => {
        if (fixture.status !== 'finished' || !fixture.results_processed_at) return false;
        
        // Strict rule: NOW() > results_processed_at + 24 Stunden -> hide
        const processedTime = new Date(fixture.results_processed_at).getTime();
        return processedTime > cutoffTime;
      });

      // Try to identify "OUR" club to be more precise
      const ourClubId = profile.favorite_club_id;
      
      const isReserveTeam = (name: string) => {
        const n = name.toLowerCase();
        return n.includes('reserve') || 
               n.includes('1b') || 
               n.includes('1.b') || 
               n.includes(' ii') || 
               n.includes('res.') || 
               n.includes(' res') ||
               n.includes('2.m') ||
               n.includes('2. m') ||
               n.includes('u23') ||
               n.includes('u-23') ||
               n.includes(' b ') ||
               n.endsWith(' b') ||
               n.includes(' 2. mannschaft');
      };

      const isKMTeam = (name: string) => {
        const n = name.toLowerCase();
        // If it's explicitly reserve, it's not KM
        if (isReserveTeam(name)) return false;
        
        // If it has KM markers, definitely KM
        if (n.includes('kampfmannschaft') || n.includes('km') || n.includes(' i ')) return true;
        
        // Default: If it's not a reserve team, assume it's the main (KM) team
        return true; 
      };

      const latestKM = processedMatches
        .filter(fixture => {
          const homeName = fixture.home_team?.name || '';
          const awayName = fixture.away_team?.name || '';
          const homeIsRes = isReserveTeam(homeName);
          const awayIsRes = isReserveTeam(awayName);

          // If match_type is set and says reserve, it is NOT KM
          if (fixture.match_type === 'reserve') return false;
          // If team names match reserve, it is NOT KM
          if (homeIsRes || awayIsRes) {
            // But check if it's explicitly KM
            if (fixture.match_type !== 'kampfmannschaft') return false;
          }
          
          if (ourClubId) {
            const homeClubId = (fixture.home_team as any)?.club_id;
            const awayClubId = (fixture.away_team as any)?.club_id;
            return homeClubId === ourClubId || awayClubId === ourClubId;
          }
          return true;
        })
        .sort((a, b) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime())[0];
      
      const latestReserve = processedMatches
        .filter(fixture => {
          const homeName = fixture.home_team?.name || '';
          const awayName = fixture.away_team?.name || '';
          const homeIsRes = isReserveTeam(homeName);
          const awayIsRes = isReserveTeam(awayName);

          // Priority: match_type
          if (fixture.match_type === 'reserve') {
            if (ourClubId) {
               const homeClubId = (fixture.home_team as any)?.club_id;
               const awayClubId = (fixture.away_team as any)?.club_id;
               return homeClubId === ourClubId || awayClubId === ourClubId;
            }
            return true;
          }

          // Fallback: keywords
          if (homeIsRes || awayIsRes) {
            if (ourClubId) {
              const homeClubId = (fixture.home_team as any)?.club_id;
              const awayClubId = (fixture.away_team as any)?.club_id;
              return (homeIsRes && homeClubId === ourClubId) || (awayIsRes && awayClubId === ourClubId);
            }
            return true;
          }

          return false;
        })
        .sort((a, b) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime())[0];

      console.log(`DEBUG: [MVP] Gefundene Fixtures - KM: ${latestKM?.id || 'null'}, RES: ${latestReserve?.id || 'null'}`);

      const fetchMVP = async (fixture: Fixture | undefined, targetType: 'KM' | 'RES') => {
        if (!fixture) return null;
        
        const isKMSearch = targetType === 'KM';
        
        console.log(`DEBUG: [MVP] Suche ${targetType} MVP für Fixture ${fixture.id}`);
        const history = await supabaseService.getFixtureRatingHistory(fixture.id);
        
        if (history.length > 0) {
          // Rule: To show an MVP on OUR dashboard, we prioritize consistency with MatchResult.tsx
          
          const processedHistory = history.map((h: any) => {
            const displayDelta = h.final_delta !== undefined && h.final_delta !== null 
              ? h.final_delta 
              : h.delta_overall;
            
            return {
              ...h,
              delta_overall: displayDelta
            };
          });

          const clubPlayers = processedHistory.filter(h => {
             const pTeam = (h as any).players?.teams;
             if (!pTeam) return false;
             if (ourClubId && pTeam.club_id !== ourClubId) return false;
             return true;
          });
          
          // 1. Prioritize absolute match MVP (regardless of club) for consistency with MatchResult page
          const absoluteMVP = processedHistory.find(h => (h as any).is_mvp);
          
          // 2. Fallback to our club's best or the whole match's best using identical sorting logic
          const sortLogic = (a: any, b: any) => {
            const bScore = b.mvp_score || b.delta_overall || 0;
            const aScore = a.mvp_score || a.delta_overall || 0;
            if (bScore !== aScore) return bScore - aScore;
            
            const bVotes = b.positive_votes || 0;
            const aVotes = a.positive_votes || 0;
            if (bVotes !== aVotes) return bVotes - aVotes;
            
            return (b.new_overall || 0) - (a.new_overall || 0);
          };

          const bestOfOurClub = clubPlayers.length > 0 ? [...clubPlayers].sort(sortLogic)[0] : null;
          const bestOverall = [...processedHistory].sort(sortLogic)[0];

          const mvpEntry = absoluteMVP || bestOfOurClub || bestOverall;
          
          const found = p.find(player => player.id === mvpEntry.player_id) || null;
          console.log(`DEBUG: [MVP] ${targetType} MVP gefunden: ${found?.full_name || 'none'} (${found?.id})`);
          return found;
        }
        
        console.log(`DEBUG: [MVP] Keine Rating History für Fixture ${fixture.id} gefunden.`);
        return null;
      };

      const [kmMVP, resMVP] = await Promise.all([
        fetchMVP(latestKM, 'KM'),
        fetchMVP(latestReserve, 'RES')
      ]);

      setMvpKM(kmMVP);
      setMvpReserve(resMVP);
      setFixtureKM(latestKM || null);
      setFixtureReserve(latestReserve || null);

      // Debug logs
      console.log(`DEBUG: [DASHBOARD] KM Fixture: ${latestKM?.id || 'none'}, MVP: ${kmMVP?.full_name || 'none'}`);
      console.log(`DEBUG: [DASHBOARD] Reserve Fixture: ${latestReserve?.id || 'none'}, MVP: ${resMVP?.full_name || 'none'}`);
      console.log(`DEBUG: [DASHBOARD] heroStatus evaluation (kmMVP: ${!!kmMVP}, resMVP: ${!!resMVP})`);

      // Hero Status logic (re-evaluated)
      
      // 1. OPEN VOTING
      const votingMatch = f.find(fixture => {
        if (!fixture.voting_open_at || !fixture.voting_close_at) return false;
        const openAt = new Date(fixture.voting_open_at);
        const closeAt = new Date(fixture.voting_close_at);
        return now >= openAt && now <= closeAt && !fixture.results_processed_at;
      });

      if (votingMatch) {
        setHeroFixture(votingMatch);
        status = 'voting';
      } 
      // 2. LIVE MATCH
      else {
        const liveMatch = f.find(fixture => {
          const isFinished = fixture.status === 'finished' || !!fixture.results_processed_at || fixture.match_phase === 'full_time';
          if (isFinished) return false;
          const isLive = fixture.status === 'live';
          const kickoff = new Date(fixture.kickoff_at);
          const isStarted = now >= kickoff;
          return isLive || (fixture.status === 'upcoming' && isStarted);
        });

        if (liveMatch) {
          // Fetch events for live score accuracy if it's our hero
          const heroEvents = await supabaseService.getMatchEvents(liveMatch.id);
          (liveMatch as any).match_events = heroEvents;
          setHeroFixture(liveMatch);
          status = 'live';
        } else if (kmMVP || resMVP) {
          status = 'result';
        }
      }

      setHeroStatus(status);
      
      // ... checkins logic continues below ...
      const { data: userCheckins } = await supabaseService.getUserCheckins(profile.id);
      const checkinIds = userCheckins?.map(c => c.fixture_id) || [];
      setCheckins(checkinIds);
      
      if (profile.role === 'player') {
        const myPlayer = p.find(player => player.claimed_by_user_id === profile.id);
        if (myPlayer) setPlayerData(myPlayer);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderHeroBlock = () => {
    // 0. Season Teaser OVERRIDES everything if season is over and no live/voting matches
    if (showSeasonTeaser && heroStatus !== 'live' && heroStatus !== 'voting') {
      return renderSeasonEndTeaser();
    }

    // 1. Result Hero (KM + Reserve)
    if (heroStatus === 'result' && (mvpKM || mvpReserve)) {
      const renderMVPHero = (mvp: Player, fixture: Fixture, teamTitle: string) => (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500/5 backdrop-blur-3xl border border-emerald-500/20 rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden w-full"
        >
          <div className="absolute top-0 right-0 p-4">
            <div className="bg-emerald-500 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-3 h-3 text-black" />
              <span className="text-[10px] font-black text-black uppercase tracking-widest leading-none">RESULT BEREIT</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center w-full gap-6">
            <div className="w-full flex justify-center items-center py-6">
              <div className="relative flex items-center justify-center origin-top scale-[0.8] sm:scale-[0.9] md:scale-100 -mb-[98px] sm:-mb-[49px] md:mb-0">
                <div className="pointer-events-none">
                  <PlayerCard 
                    player={mvp} 
                    clubLogo={teams.find(t => t.id === mvp.team_id)?.clubs?.logo_url}
                  />
                </div>
              </div>
            </div>
            
            <div className="w-full space-y-6 text-center">
              <div className="space-y-1">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">TOP SPIELER</h2>
                <div className="flex flex-col items-center gap-1">
                  <div className="text-sm font-black italic uppercase tracking-tight text-white line-clamp-2">
                    {fixture.home_team?.clubs?.name} vs {fixture.away_team?.clubs?.name}
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500">
                    {teamTitle}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    Runde {fixture.round_number || 1} • {new Date(fixture.kickoff_at).toLocaleDateString(['de-DE'], { day: '2-digit', month: 'long', year: 'numeric' })}
                  </div>
                </div>
                <p className="text-zinc-400 font-medium text-sm pt-2">{mvp.full_name} hat am meisten überzeugt.</p>
              </div>

              <div className="flex items-center justify-center gap-3 py-3 bg-white/5 rounded-2xl border border-white/5 mx-auto max-w-[160px]">
                 <div className="flex items-center gap-3 whitespace-nowrap text-2xl font-black italic text-white tracking-tighter">
                   {(() => {
                     const { homeScore, awayScore } = calculateMatchScore(fixture, (fixture as any).match_events || []);
                     return (
                       <>
                         <span>{homeScore}</span>
                         <span className="text-zinc-700">:</span>
                         <span>{awayScore}</span>
                       </>
                     );
                   })()}
                 </div>
              </div>

              <button 
                onClick={() => navigate(`/matches/${fixture.id}/result`)}
                className="w-full max-w-[320px] mx-auto bg-emerald-500 text-black font-black italic uppercase tracking-widest py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] active:scale-95"
              >
                ERGEBNIS ANSEHEN
              </button>
            </div>
          </div>
        </motion.div>
      );

      return (
        <div className="space-y-16">
          {mvpKM && fixtureKM && (
            <div className="space-y-10">
              <div className="flex items-center gap-3 px-1">
                <div className="h-px flex-1 bg-white/5" />
                <h2 className="text-[10px] font-black italic uppercase tracking-[0.2em] text-zinc-500 text-center">TOP SPIELER – KAMPFMANNSCHAFT</h2>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              {renderMVPHero(mvpKM, fixtureKM, "Kampfmannschaft")}
            </div>
          )}
          
          {mvpReserve && fixtureReserve && (
            <div className="space-y-10">
              <div className="flex items-center gap-3 px-1">
                <div className="h-px flex-1 bg-white/5" />
                <h2 className="text-[10px] font-black italic uppercase tracking-[0.2em] text-zinc-500 text-center">TOP SPIELER – RESERVE</h2>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              {renderMVPHero(mvpReserve, fixtureReserve, "Reserve")}
            </div>
          )}
        </div>
      );
    }

    // 2. Voting Hero
    if (heroStatus === 'voting' && heroFixture) {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/5 backdrop-blur-3xl border border-amber-500/20 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4">
            <div className="bg-amber-500 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg shadow-amber-500/20">
              <Star className="w-3 h-3 text-black fill-black" />
              <span className="text-[10px] font-black text-black uppercase tracking-widest leading-none">VOTING OPEN</span>
            </div>
          </div>

          <div className="space-y-4 text-center">
            <div className="space-y-1">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Deine Stimme zählt</h2>
              <p className="text-zinc-400 font-medium text-sm">Wer war dein Player of the Match?</p>
            </div>
            
            <div className="flex flex-col items-center gap-1 py-2">
              <div className="flex items-center justify-center gap-4 opacity-70">
                <span className="text-sm font-black italic uppercase text-white tracking-tight">{heroFixture.home_team?.clubs?.name}</span>
                <span className="text-zinc-700 font-black italic text-xs">VS</span>
                <span className="text-sm font-black italic uppercase text-white tracking-tight">{heroFixture.away_team?.clubs?.name}</span>
              </div>
              <div className="text-[9px] font-bold text-amber-500/80 uppercase tracking-widest">
                {heroFixture.home_team?.name} / {heroFixture.away_team?.name}
              </div>
            </div>

            <button 
              onClick={() => navigate(`/matches/${heroFixture.id}`)}
              className="w-full bg-amber-500 text-black font-black italic uppercase tracking-widest py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] active:scale-95"
            >
              <Star className="w-5 h-5 fill-black" />
              JETZT VOTEN
            </button>
          </div>
        </motion.div>
      );
    }

    // 3. Live Hero
    if (heroStatus === 'live' && heroFixture) {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/5 backdrop-blur-3xl border border-red-500/20 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4">
            <div className="bg-red-500 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg shadow-red-500/20">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">LIVE</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-6">
            <div className="flex items-center justify-center gap-8 w-full">
              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-white/5 p-3">
                  {heroFixture.home_team?.clubs?.logo_url ? (
                    <img src={heroFixture.home_team.clubs.logo_url} alt="" className="w-full h-full object-contain" />
                  ) : <Shield className="w-8 h-8 text-zinc-700" />}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs font-black italic uppercase text-white text-center line-clamp-1">{heroFixture.home_team?.clubs?.name}</span>
                  <span className="text-[8px] font-bold text-zinc-500 uppercase">{heroFixture.home_team?.name}</span>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-3 whitespace-nowrap text-4xl sm:text-5xl font-black italic tracking-tighter text-white">
                  {(() => {
                    const { homeScore, awayScore } = calculateMatchScore(heroFixture, (heroFixture as any).match_events || []);
                    return (
                      <>
                        <span>{homeScore}</span>
                        <span className="text-zinc-700">-</span>
                        <span>{awayScore}</span>
                      </>
                    );
                  })()}
                </div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest italic">{getLiveMatchMinute(heroFixture) || '1. HZ'}</div>
              </div>

              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-white/5 p-3">
                  {heroFixture.away_team?.clubs?.logo_url ? (
                    <img src={heroFixture.away_team.clubs.logo_url} alt="" className="w-full h-full object-contain" />
                  ) : <Shield className="w-8 h-8 text-zinc-700" />}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs font-black italic uppercase text-white text-center line-clamp-1">{heroFixture.away_team?.clubs?.name}</span>
                  <span className="text-[8px] font-bold text-zinc-500 uppercase">{heroFixture.away_team?.name}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => navigate(`/matches/${heroFixture.id}`)}
              className="w-full bg-white text-black font-black italic uppercase tracking-widest py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] active:scale-95"
            >
              ZUM SPIEL
            </button>
          </div>
        </motion.div>
      );
    }

    // 4. Empty State Hero
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-[3rem] p-10 text-center space-y-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800" />
        <div className="space-y-2">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-zinc-500">Keine Spiele aktiv</h2>
          <p className="text-zinc-600 font-medium">Aktuell finden keine Spiele statt. Schau später wieder vorbei!</p>
        </div>
        <button 
          onClick={() => navigate('/matches')}
          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black italic uppercase tracking-widest py-4 rounded-2xl border border-white/5 transition-all flex items-center justify-center gap-2"
        >
          <Calendar className="w-5 h-5" />
          MATCHES ANSEHEN
        </button>
      </motion.div>
    );
  };

  const loadTopPlayers = async () => {
    setLoadingTopPlayers(true);
    try {
      const historyExists = await supabaseService.hasRatingHistory();
      setHasHistory(historyExists);

      if (historyExists) {
        const top = await supabaseService.getTopPlayers(6);
        setTopPlayers(top);
        
        const top10 = await supabaseService.getSeasonTop10Players();
        if (top10 && top10.length > 0) {
          setSeasonWinner(top10[0]);
        }
      }
    } catch (err) {
      console.error('Error loading top players:', err);
    } finally {
      setLoadingTopPlayers(false);
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
    <SafeAreaWrapper>
      <div className="min-h-screen relative text-white font-sans overflow-x-hidden bg-transparent">
        {/* Remove previous redundant dark overlay to restore App.tsx background */}

        {/* Header - Fixed Top Anchor */}
        <div className="sticky top-0 pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-8 flex items-center justify-between bg-zinc-950/80 backdrop-blur-2xl z-50 border-b border-white/10">
          <div className="flex items-center flex-shrink-0">
          <img 
            src="https://upvzomofjjwaxkfogpuc.supabase.co/storage/v1/object/public/assets/logo/Logo1024.png" 
            alt="PLYRZ" 
            className="h-10 sm:h-16 w-auto object-contain brightness-125 drop-shadow-[0_0_25px_rgba(16,185,129,0.4)]"
            
          />
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {hasAdminAccess && (
            <button 
              onClick={() => navigate(isAdmin ? '/admin' : '/team-admin')}
              className="w-10 h-10 bg-zinc-900 rounded-xl border border-white/10 flex items-center justify-center hover:border-emerald-500 hover:text-emerald-500 transition-all shadow-lg active:scale-95"
              title="Admin Panel"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}

          <div className="text-right hidden sm:block">
            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Angemeldet</div>
            <div className="text-xs font-bold text-white">{profile?.display_name}</div>
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

      {/* Main Content Area - Top Aligned */}
      <div className="relative z-10 w-full pt-[100px] pb-[calc(10rem+env(safe-area-inset-bottom))]">
        <div className="max-w-xl mx-auto px-5 space-y-12">
          
          {/* A. HERO SECTION (ONLY ONE) */}
          <section className="w-full">
            {renderHeroBlock()}
          </section>

          {/* B. MATCH LIST SECTION */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="space-y-0.5">
                <h2 className="text-sm font-black italic uppercase tracking-widest text-white">Spielplan</h2>
                <div className="h-1 w-12 bg-emerald-500/30 rounded-full" />
              </div>
              <button 
                onClick={() => navigate('/matches')}
                className="bg-zinc-900/40 hover:bg-zinc-800 text-emerald-500 text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full border border-white/5 transition-all"
              >
                SPIELPLAN
              </button>
            </div>

            <div className="space-y-8">
              {showSeasonTeaser ? (
                <div className="py-12 text-center space-y-4 bg-zinc-900/40 backdrop-blur-md rounded-[2rem] border border-dashed border-white/10 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none"></div>
                  <Calendar className="w-8 h-8 text-amber-500/50 mx-auto relative z-10" strokeWidth={1} />
                  <div className="relative z-10 space-y-1">
                    <p className="text-white text-base font-black italic uppercase tracking-widest">Saison beendet</p>
                    <p className="text-zinc-400 text-[11px] uppercase tracking-widest font-bold">Die Liga-Saison ist offiziell abgeschlossen.</p>
                  </div>
                </div>
              ) : currentRound ? (
                <div className="text-center space-y-4">
                  <div className="inline-flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500/50 mb-1">Aktuell</span>
                    <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white">Runde {currentRound}</h3>
                    <div className="h-1 w-full bg-emerald-500 rounded-full mt-2" />
                  </div>
                  
                  <div className="grid gap-4 pt-2">
                    {fixtures
                      .filter(f => f.round_number === currentRound)
                      .map(f => (
                        <MatchCard 
                          key={f.id} 
                          fixture={f} 
                          onClick={() => navigate(`/matches/${f.id}`)}
                        />
                      ))
                    }
                  </div>
                </div>
              ) : fixtures.length === 0 ? (
                <div className="py-12 text-center space-y-4 bg-zinc-900/40 backdrop-blur-md rounded-[2rem] border border-dashed border-white/10 relative overflow-hidden">
                  <Calendar className="w-8 h-8 text-zinc-600 mx-auto relative z-10" strokeWidth={1} />
                  <div className="relative z-10 space-y-1">
                    <p className="text-white text-base font-black italic uppercase tracking-widest">Keine Spiele</p>
                    <p className="text-zinc-400 text-[11px] uppercase tracking-widest font-bold">Noch keine Spiele für die Saison 2026/2027 angelegt.</p>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center space-y-3 bg-zinc-900/10 rounded-[2rem] border border-dashed border-white/5">
                  <Calendar className="w-8 h-8 text-zinc-800 mx-auto" strokeWidth={1} />
                  <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Keine aktuellen Termine</p>
                </div>
              )}
            </div>
          </section>

          {/* C. TOP PERFORMER CAROUSEL (NEW POSITION) */}
          <section className="space-y-6 overflow-hidden">
            <div className="flex items-center justify-between px-1">
              <div className="space-y-0.5">
                <h2 className="text-sm font-black italic uppercase tracking-widest text-white">Top Spieler</h2>
                <div className="h-1 w-12 bg-amber-500/30 rounded-full" />
              </div>
              <button 
                onClick={() => navigate('/leaderboard')}
                className="text-zinc-500 hover:text-white text-[9px] font-black uppercase tracking-widest transition-colors"
              >
                RANGLISTE
              </button>
            </div>
            
            {hasHistory && topPlayers.length > 0 ? (
              <div 
                ref={carouselRef}
                onScroll={handleScroll}
                className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar pb-12 pt-8 -mx-5 px-5"
              >
                {topPlayers.slice(0, 6).map((p, index) => {
                  const isActive = index === activeCardIndex;
                  return (
                    <div 
                      key={p.id} 
                      className={`flex-shrink-0 w-[227px] h-[318px] relative transition-all duration-300 snap-center ${index > 0 ? '-ml-24' : ''} ${isActive ? 'scale-110 z-50 -translate-y-4' : 'scale-90 opacity-60'} hover:z-50 hover:opacity-100`}
                      style={{ zIndex: isActive ? 50 : 10 - index }}
                    >
                       <div className="absolute top-0 left-0 scale-[0.65] origin-top-left drop-shadow-2xl cursor-pointer">
                        <PlayerCard 
                          player={p}
                          clubLogo={teams.find(t => t.id === p.team_id)?.clubs?.logo_url}
                          onClick={() => navigate(`/players/${p.id}`)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center space-y-3 bg-zinc-900/10 rounded-[2rem] border border-dashed border-white/5">
                <Trophy className="w-8 h-8 text-zinc-800 mx-auto" strokeWidth={1} />
                <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest px-4">
                  Noch keine Ranking-Daten für die neue Saison verfügbar.
                </p>
              </div>
            )}
          </section>

          {/* D. OPTIONAL SECTIONS (BOTTOM ONLY) */}
          <div className="space-y-10 pt-4 opacity-90">
            {profile?.role === 'player' && playerData && (
              <section className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <div className="h-px flex-1 bg-white/5" />
                  <h2 className="text-[10px] font-black italic uppercase tracking-[0.2em] text-zinc-500">Deine Karte</h2>
                  <div className="h-px flex-1 bg-white/5" />
                </div>
                <div className="w-full flex justify-center items-center py-6">
                  <div className="relative flex items-center justify-center origin-top scale-[0.8] sm:scale-[0.9] md:scale-100 -mb-[98px] sm:-mb-[49px] md:mb-0">
                    <PlayerCard 
                      player={playerData} 
                      clubLogo={teams.find(t => t.id === playerData.team_id)?.clubs?.logo_url}
                      onClick={() => navigate(`/players/${playerData.id}`)}
                    />
                  </div>
                </div>
              </section>
            )}

            <div className="grid gap-10">
              {/* Stats Summary */}
              <section className="grid grid-cols-2 gap-4 pb-8">
                <div className="bg-zinc-900/10 p-5 rounded-3xl border border-white/5 flex flex-col justify-between h-24">
                  <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Stimmen Gesamt</div>
                  <div className="text-2xl font-black italic text-zinc-400">1.2k</div>
                </div>
                <div className="bg-zinc-900/10 p-5 rounded-3xl border border-white/5 flex flex-col justify-between h-24">
                  <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Ø Rating</div>
                  <div className="text-2xl font-black italic text-zinc-400">74.2</div>
                </div>
              </section>
            </div>
          </div>

        </div>
      </div>
    </div>
    </SafeAreaWrapper>
  );
};

export default Dashboard;
