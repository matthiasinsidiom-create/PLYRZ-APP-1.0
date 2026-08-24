import React from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Shield, 
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Fixture } from '../types';
import { calculateMatchScore } from '../lib/score';

interface MatchCardProps {
  fixture: Fixture;
  homeTeam?: any;
  awayTeam?: any;
  hasCheckedIn?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  fixture,
  homeTeam: propHomeTeam,
  awayTeam: propAwayTeam,
  hasCheckedIn,
  children,
  onClick
}) => {
  const navigate = useNavigate();
  const homeTeam = propHomeTeam || (fixture as any).home_team;
  const awayTeam = propAwayTeam || (fixture as any).away_team;

  const handleClick = (e?: any) => {
    if (e && e.target && (e.target as HTMLElement).closest('button, a')) {
      return;
    }

    if (onClick) {
      onClick();
    } else {
      navigate(`/matches/${fixture.id}`);
    }
  };

  const isFinished = fixture.status === 'finished' || !!fixture.results_processed_at || fixture.match_phase === 'full_time';
  const isLive = !isFinished && fixture.status === 'live';
  const isUpcoming = fixture.status === 'upcoming' && !isFinished;
  const isVoting = isFinished && !fixture.results_processed_at && !!fixture.voting_close_at && new Date() < new Date(fixture.voting_close_at);

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className={`bg-zinc-900/50 backdrop-blur-md border rounded-[2rem] p-4 sm:p-5 hover:border-emerald-500/30 transition-all cursor-pointer group relative z-10 ${
        isLive ? 'border-red-500/30 bg-red-500/5' : isVoting ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Home Team */}
        <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 bg-zinc-800 rounded-2xl flex items-center justify-center overflow-hidden border border-white/5 group-hover:border-emerald-500/20 transition-colors">
            {homeTeam?.clubs?.logo_url ? (
              <img 
                src={homeTeam.clubs.logo_url} 
                alt="" 
                className="w-7 h-7 sm:w-8 sm:h-8 object-contain" 
                 
              />
            ) : (
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-600" />
            )}
          </div>
          <div className="text-center w-full min-w-0 space-y-0.5">
            <div className="text-[10px] sm:text-[11px] font-black text-white italic uppercase tracking-tight leading-tight break-words line-clamp-2 px-1">
              {homeTeam?.clubs?.name || 'Club'}
            </div>
            <div className="text-[7px] sm:text-[8px] font-bold text-zinc-500/80 uppercase tracking-widest">
              {homeTeam?.name || 'KM'}
            </div>
          </div>
        </div>

        {/* Center: Score/Time/Minute */}
        <div className="flex flex-col items-center justify-center min-w-[80px]">
          {isUpcoming ? (
            <div className="flex flex-col items-center gap-1">
              <div className="text-lg sm:text-xl font-black italic text-white tracking-tighter">
                {new Date(fixture.kickoff_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                {new Date(fixture.kickoff_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}
              </div>
            </div>
          ) : (() => {
            const { homeScore, awayScore } = calculateMatchScore(fixture, (fixture as any).match_events || []);
            return (
              <div className="flex flex-col items-center">
                <div className={`flex items-center gap-2 whitespace-nowrap text-2xl sm:text-3xl font-black italic tracking-tighter transition-colors ${
                  isLive ? 'text-white' : 'text-zinc-400'
                }`}>
                  <span>{homeScore}</span>
                  <span className="text-zinc-600">-</span>
                  <span>{awayScore}</span>
                </div>
                {isLive && (
                  <div className="flex flex-col items-center mt-1">
                    <div className="bg-red-500 px-2 py-0.5 rounded-full mb-1">
                      <span className="text-[7px] font-black text-white uppercase tracking-widest animate-pulse">Live</span>
                    </div>
                  </div>
                )}
                {isFinished && (
                  <div className={`text-[8px] font-black uppercase tracking-widest mt-1 ${isVoting ? 'text-emerald-500 animate-pulse' : 'text-zinc-600'}`}>
                    {isVoting ? 'Voten' : 'Beendet'}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Away Team */}
        <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 bg-zinc-800 rounded-2xl flex items-center justify-center overflow-hidden border border-white/5 group-hover:border-emerald-500/20 transition-colors">
            {awayTeam?.clubs?.logo_url ? (
              <img 
                src={awayTeam.clubs.logo_url} 
                alt="" 
                className="w-7 h-7 sm:w-8 sm:h-8 object-contain" 
                 
              />
            ) : (
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-600" />
            )}
          </div>
          <div className="text-center w-full min-w-0 space-y-0.5">
            <div className="text-[10px] sm:text-[11px] font-black text-white italic uppercase tracking-tight leading-tight break-words line-clamp-2 px-1">
              {awayTeam?.clubs?.name || 'Club'}
            </div>
            <div className="text-[7px] sm:text-[8px] font-bold text-zinc-500/80 uppercase tracking-widest">
              {awayTeam?.name || 'KM'}
            </div>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-zinc-600 text-[9px] font-bold uppercase tracking-wider">
          <MapPin className="w-3 h-3 text-zinc-700" />
          <span className="line-clamp-1">{fixture.venue_name}</span>
        </div>
      </div>

      {children && (
        <div className="mt-4 pt-2 flex items-center gap-2">
          {children}
        </div>
      )}
    </motion.div>
  );
};
