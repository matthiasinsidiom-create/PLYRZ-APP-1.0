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
  jerseyNumber?: number | null;
  lineupRole?: 'starter' | 'sub';
  onClick?: () => void;
  events?: any[];
  isAdmin?: boolean;
  onAddEvent?: (playerId: string, type: 'goal' | 'yellow_card' | 'red_card') => void;
  onRemoveEvent?: (playerId: string, type: string) => void;
}

export const PlayerVoteCard: React.FC<PlayerVoteCardProps> = ({
  player,
  vote,
  onVote,
  loading,
  disabled,
  jerseyNumber,
  lineupRole,
  onClick,
  events = [],
  isAdmin = false,
  onAddEvent,
  onRemoveEvent
}) => {
  const goals = events.filter(e => e.event_type === 'goal').length;
  const yellows = events.filter(e => e.event_type === 'yellow_card').length;
  const reds = events.filter(e => e.event_type === 'red_card').length;

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[350px] transform-gpu">
      <div className="scale-[0.7] sm:scale-[0.8] origin-top h-[350px] sm:h-[400px] will-change-transform">
        <PlayerCard 
          player={player} 
          jerseyNumber={jerseyNumber}
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
        <div className="flex flex-col items-center gap-1">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${lineupRole === 'starter' ? 'text-emerald-500' : 'text-amber-500'}`}>
            {lineupRole === 'starter' ? 'STARTER' : 'SUBSTITUTE'}
          </p>
          
          {/* Event Badges */}
          {(goals > 0 || yellows > 0 || reds > 0) && (
            <div className="flex items-center gap-2 mt-1">
              {goals > 0 && (
                <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                  <span className="text-[10px]">⚽</span>
                  <span className="text-[10px] font-black italic">{goals}</span>
                </div>
              )}
              {yellows > 0 && (
                <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded-full border border-yellow-500/30">
                  <span className="text-[8px]">🟨</span>
                  <span className="text-[10px] font-black italic text-yellow-500">{yellows}</span>
                </div>
              )}
              {reds > 0 && (
                <div className="flex items-center gap-1 bg-red-500/20 px-2 py-0.5 rounded-full border border-red-500/30">
                  <span className="text-[8px]">🟥</span>
                  <span className="text-[10px] font-black italic text-red-500">{reds}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Admin Event Controls */}
      {isAdmin && (
        <div className="flex items-center gap-2 mb-2 z-30">
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <button 
              onClick={(e) => { e.stopPropagation(); onRemoveEvent?.(player.id, 'goal'); }}
              className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
            >
              -
            </button>
            <span className="text-[10px] font-black italic">⚽</span>
            <button 
              onClick={(e) => { e.stopPropagation(); onAddEvent?.(player.id, 'goal'); }}
              className="w-8 h-8 flex items-center justify-center text-emerald-500 hover:text-emerald-400 transition-colors"
            >
              +
            </button>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); yellows > 0 ? onRemoveEvent?.(player.id, 'yellow_card') : onAddEvent?.(player.id, 'yellow_card'); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${yellows > 0 ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
          >
            🟨
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); reds > 0 ? onRemoveEvent?.(player.id, 'red_card') : onAddEvent?.(player.id, 'red_card'); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${reds > 0 ? 'bg-red-500 border-red-400 text-black' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
          >
            🟥
          </button>
        </div>
      )}

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
