import React from 'react';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { PlayerCard } from './PlayerCard';
import { Player } from '../types';

interface PlayerVoteCardProps {
  player: Player;
  vote: 'up' | 'down' | null;
  onVote: (vote: 'up' | 'down') => void;
  loading: boolean;
  disabled: boolean;
  shirtNumber?: number | null;
  lineupRole?: 'starter' | 'sub';
  onClick?: () => void;
}

export const PlayerVoteCard: React.FC<PlayerVoteCardProps> = ({
  player,
  vote,
  onVote,
  loading,
  disabled,
  shirtNumber,
  lineupRole,
  onClick
}) => {
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[350px] transform-gpu">
      <div className="scale-[0.7] sm:scale-[0.8] origin-top h-[350px] sm:h-[400px] will-change-transform">
        <PlayerCard 
          player={player} 
          shirtNumber={shirtNumber}
          lineupRole={lineupRole}
          onClick={onClick}
        />
      </div>
      <div 
        className={`text-center -mt-12 sm:-mt-16 mb-2 z-10 ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
        onClick={onClick}
      >
        <h4 className="text-lg font-black italic uppercase tracking-tight">
          {player.full_name}
        </h4>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${lineupRole === 'starter' ? 'text-emerald-500' : 'text-amber-500'}`}>
          {lineupRole === 'starter' ? 'STARTER' : 'SUBSTITUTE'}
        </p>
      </div>
      <div className="flex items-center gap-4 z-20">
        <button
          onClick={() => onVote('up')}
          disabled={disabled || loading}
          className={`p-4 rounded-2xl border transition-all ${
            vote === 'up'
              ? 'bg-emerald-500 border-emerald-400 text-black scale-110 shadow-lg shadow-emerald-500/40'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-emerald-500/50'
          } disabled:opacity-50 active:scale-95`}
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <ThumbsUp className="w-6 h-6" />
          )}
        </button>
        <button
          onClick={() => onVote('down')}
          disabled={disabled || loading}
          className={`p-4 rounded-2xl border transition-all ${
            vote === 'down'
              ? 'bg-red-500 border-red-400 text-black scale-110 shadow-lg shadow-red-500/40'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-red-500/50'
          } disabled:opacity-50 active:scale-95`}
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <ThumbsDown className="w-6 h-6" />
          )}
        </button>
      </div>
    </div>
  );
};
