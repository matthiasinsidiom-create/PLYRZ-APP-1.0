import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { 
  ThumbsUp, 
  ThumbsDown, 
  X, 
  CheckCircle2, 
  Trophy,
  ArrowRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { PlayerCard } from './PlayerCard';
import { Player } from '../types';

interface SwipeVotingOverlayProps {
  fixtureId: string;
  lineup: any[];
  userVotes: Record<string, 'up' | 'down'>;
  onVote: (playerId: string, vote: 'up' | 'down') => Promise<void>;
  onClose: () => void;
  onViewResults: () => void;
}

export const SwipeVotingOverlay: React.FC<SwipeVotingOverlayProps> = ({
  fixtureId,
  lineup,
  userVotes,
  onVote,
  onClose,
  onViewResults
}) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(() => {
    // Find the first player that hasn't been voted on yet
    const firstUnvoted = lineup.findIndex(entry => !userVotes[entry.player_id]);
    // If all are voted, we'll start at 0 but the completed state will catch it
    return firstUnvoted === -1 ? 0 : firstUnvoted;
  });
  const [exitDirection, setExitDirection] = useState<number>(0);
  const [isVoting, setIsVoting] = useState(false);
  const [completed, setCompleted] = useState(() => {
    // If no players or all players are already voted
    return lineup.length === 0 || lineup.every(entry => !!userVotes[entry.player_id]);
  });

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  const cardScale = useTransform(x, [-150, 0, 150], [1.05, 1, 1.05]);
  
  const upvoteGlow = useTransform(x, [50, 150], [0, 1]);
  const downvoteGlow = useTransform(x, [-150, -50], [1, 0]);

  const currentPlayerEntry = lineup[currentIndex];
  const currentPlayer = currentPlayerEntry?.players;
  const totalPlayers = lineup.length;

  useEffect(() => {
    console.log(`DEBUG: [SWIPE] Current Fixture: ${fixtureId}`);
    if (currentPlayer) {
      console.log(`DEBUG: [SWIPE] Current Player: ${currentPlayer.full_name} (${currentIndex + 1}/${totalPlayers})`);
    }
  }, [currentIndex, currentPlayer, fixtureId, totalPlayers]);

  if (totalPlayers === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center p-6 text-center"
      >
        <AlertCircle className="w-12 h-12 text-zinc-800 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">No players found</h2>
        <button 
          onClick={onClose}
          className="text-emerald-500 font-bold uppercase tracking-widest text-xs"
        >
          Back to Match
        </button>
      </motion.div>
    );
  }

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (isVoting || completed || !currentPlayer) return;
    
    const vote = direction === 'right' ? 'up' : 'down';
    console.log(`DEBUG: [SWIPE] Swipe ${direction} detected for ${currentPlayer?.full_name}. Vote: ${vote}`);
    
    setExitDirection(direction === 'right' ? 1000 : -1000);
    setIsVoting(true);

    try {
      await onVote(currentPlayer.id, vote);
      console.log(`DEBUG: [SWIPE] Vote persisted for ${currentPlayer?.id}`);
    } catch (err) {
      console.error(`DEBUG: [SWIPE] Vote failed for ${currentPlayer?.id}:`, err);
    }

    // Find the next unvoted player
    let nextIndex = currentIndex + 1;
    while (nextIndex < totalPlayers && userVotes[lineup[nextIndex].player_id]) {
      nextIndex++;
    }

    // Move to next player after a short delay for animation
    setTimeout(() => {
      if (nextIndex < totalPlayers) {
        setCurrentIndex(nextIndex);
        setExitDirection(0);
        x.set(0);
        setIsVoting(false);
      } else {
        setCompleted(true);
        setIsVoting(false);
      }
    }, 300);
  };

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 120) {
      handleSwipe('right');
    } else if (info.offset.x < -120) {
      handleSwipe('left');
    }
  };

  if (completed) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="w-24 h-24 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mb-8 border border-emerald-500/20">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>
        
        <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-2">Voting Complete!</h2>
        <p className="text-zinc-500 font-medium mb-12 max-w-xs">
          You've rated all {totalPlayers} players in this match. Your voice has been heard!
        </p>

        <div className="w-full max-w-xs space-y-4">
          <button
            onClick={onViewResults}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black italic uppercase tracking-tighter py-5 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <Trophy className="w-5 h-5" /> View Match Results
          </button>
          
          <button
            onClick={onClose}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black italic uppercase tracking-tighter py-5 rounded-2xl transition-all border border-white/5 flex items-center justify-center gap-2"
          >
            Go Back
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col overflow-hidden"
    >
      {/* Glow Backgrounds */}
      <motion.div 
        style={{ opacity: upvoteGlow }}
        className="absolute inset-y-0 right-0 w-1/2 bg-emerald-500/20 blur-[120px] pointer-events-none"
      />
      <motion.div 
        style={{ opacity: downvoteGlow }}
        className="absolute inset-y-0 left-0 w-1/2 bg-red-500/20 blur-[120px] pointer-events-none"
      />

      {/* Header */}
      <div className="p-6 flex items-center justify-between relative z-10">
        <button 
          onClick={onClose}
          className="p-3 bg-zinc-900 border border-white/5 rounded-2xl text-zinc-500 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">Voting Progress</div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-32 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${((currentIndex + 1) / totalPlayers) * 100}%` }}
                className="h-full bg-emerald-500"
              />
            </div>
            <span className="text-xs font-black italic text-emerald-500">{currentIndex + 1} / {totalPlayers}</span>
          </div>
        </div>

        <div className="w-12" /> {/* Spacer */}
      </div>

      {/* Main Swipe Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-6">
        <AnimatePresence mode="popLayout">
          {currentPlayer && (
            <motion.div
              key={currentPlayer.id}
              style={{ x, rotate, opacity, scale: cardScale }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={handleDragEnd}
              initial={{ scale: 0.8, opacity: 0, x: 0 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ x: exitDirection, opacity: 0, scale: 0.5, rotate: exitDirection / 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              className="cursor-grab active:cursor-grabbing relative z-20"
            >
              <div 
                onClick={() => navigate(`/players/${currentPlayer.id}`)}
                className="relative rounded-[2.5rem] overflow-hidden cursor-pointer active:scale-95 transition-transform duration-200"
              >
                <PlayerCard 
                  player={currentPlayer} 
                  shirtNumber={currentPlayerEntry?.shirt_number}
                  lineupRole={currentPlayerEntry?.lineup_role}
                />
                
                {/* Swipe Overlays */}
                <motion.div 
                  style={{ opacity: upvoteGlow }}
                  className="absolute inset-0 bg-emerald-500/40 flex items-center justify-center z-30 backdrop-blur-[2px]"
                >
                  <div className="bg-emerald-500 text-black font-black italic uppercase tracking-tighter px-8 py-4 rounded-2xl border-4 border-emerald-400 shadow-2xl scale-110">
                    👍 GOOD
                  </div>
                </motion.div>
                
                <motion.div 
                  style={{ opacity: downvoteGlow }}
                  className="absolute inset-0 bg-red-500/40 flex items-center justify-center z-30 backdrop-blur-[2px]"
                >
                  <div className="bg-red-500 text-black font-black italic uppercase tracking-tighter px-8 py-4 rounded-2xl border-4 border-red-400 shadow-2xl scale-110">
                    👎 BAD
                  </div>
                </motion.div>
              </div>

              {/* Float Indicators (Corner) */}
              <motion.div 
                style={{ opacity: upvoteGlow }}
                className="absolute top-10 right-10 bg-emerald-500 text-black font-black italic uppercase tracking-tighter px-6 py-3 rounded-2xl rotate-12 border-4 border-emerald-400 shadow-2xl z-40"
              >
                GOOD
              </motion.div>
              <motion.div 
                style={{ opacity: downvoteGlow }}
                className="absolute top-10 left-10 bg-red-500 text-black font-black italic uppercase tracking-tighter px-6 py-3 rounded-2xl -rotate-12 border-4 border-red-400 shadow-2xl z-40"
              >
                BAD
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Secondary Progress Indicator below card */}
        <div className="mt-8 text-zinc-500 font-black italic uppercase tracking-widest text-sm">
          {currentIndex + 1} <span className="text-zinc-700 mx-1">/</span> {totalPlayers}
        </div>
      </div>

      {/* Footer Controls (Fallback) */}
      <div className="p-12 flex flex-col items-center gap-8 relative z-10">
        <div className="flex items-center gap-6">
          <button
            onClick={() => handleSwipe('left')}
            disabled={isVoting}
            className="w-20 h-20 bg-zinc-900 border-2 border-zinc-800 rounded-[2rem] flex items-center justify-center text-red-500 hover:bg-red-500/10 hover:border-red-500/50 transition-all active:scale-90 shadow-xl"
          >
            <ThumbsDown className="w-8 h-8" />
          </button>
          
          <button
            onClick={() => {
              // Find the next unvoted player
              let nextIndex = currentIndex + 1;
              while (nextIndex < totalPlayers && userVotes[lineup[nextIndex].player_id]) {
                nextIndex++;
              }

              if (nextIndex < totalPlayers) {
                setCurrentIndex(nextIndex);
              } else {
                setCompleted(true);
              }
            }}
            className="w-14 h-14 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center text-zinc-500 hover:text-white transition-all active:scale-90"
          >
            <ArrowRight className="w-6 h-6" />
          </button>

          <button
            onClick={() => handleSwipe('right')}
            disabled={isVoting}
            className="w-20 h-20 bg-zinc-900 border-2 border-zinc-800 rounded-[2rem] flex items-center justify-center text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all active:scale-90 shadow-xl"
          >
            <ThumbsUp className="w-8 h-8" />
          </button>
        </div>

        <div 
          onClick={() => navigate(`/players/${currentPlayer.id}`)}
          className="text-center space-y-1 cursor-pointer hover:opacity-80 active:scale-95 transition-all"
        >
          <h3 className="text-2xl font-black italic uppercase tracking-tighter">
            {currentPlayer?.full_name}
          </h3>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">
            <span className={currentPlayerEntry?.lineup_role === 'starter' ? 'text-emerald-500' : 'text-amber-500'}>
              {currentPlayerEntry?.lineup_role === 'starter' ? 'STARTER' : 'SUBSTITUTE'}
            </span>
            <span className="mx-2">•</span>
            {currentPlayerEntry?.teams?.name} • {currentPlayerEntry?.position}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
