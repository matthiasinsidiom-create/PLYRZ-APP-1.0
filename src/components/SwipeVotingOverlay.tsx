import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  AlertCircle,
  Clock
} from 'lucide-react';
import { PlayerCard } from './PlayerCard';
import { Player } from '../types';
import { getPositionShort } from '../lib/positions';

import { supabaseService } from '../services/supabaseService';

interface SwipeVotingOverlayProps {
  fixtureId: string;
  userId: string;
  lineup: any[];
  userVotes: Record<string, 'up' | 'down' | 'neutral'>;
  onVote: (playerId: string, vote: 'up' | 'down' | 'neutral') => Promise<void>;
  onClose: () => void;
  onViewResults: () => void;
  votingCloseAt?: string | null;
  resultsProcessedAt?: string | null;
}

interface VoteQueueItem {
  playerId: string;
  vote: 'up' | 'down' | 'neutral';
  retries: number;
}

export const SwipeVotingOverlay: React.FC<SwipeVotingOverlayProps> = ({
  fixtureId,
  userId,
  lineup,
  userVotes,
  onVote,
  onClose,
  onViewResults,
  votingCloseAt,
  resultsProcessedAt
}) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(() => {
    const firstUnvoted = lineup.findIndex(entry => !userVotes[entry.player_id]);
    return firstUnvoted === -1 ? 0 : firstUnvoted;
  });
  
  const [exitDirection, setExitDirection] = useState<number>(0);
  const [isVoting, setIsVoting] = useState(false);
  const [completed, setCompleted] = useState(() => {
    const hasPlayers = lineup.length > 0;
    const allVoted = hasPlayers && lineup.every(entry => !!userVotes[entry.player_id]);
    return allVoted;
  });
  
  const [isCheckingCompletion, setIsCheckingCompletion] = useState(true);
  const [hasCompletedBefore, setHasCompletedBefore] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Queue System
  const queueRef = useRef<VoteQueueItem[]>([]);
  const isProcessingQueue = useRef(false);
  const completedSwipeCountRef = useRef(currentIndex);
  const totalPlayersRef = useRef(lineup.length);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  const cardScale = useTransform(x, [-150, 0, 150], [1.05, 1, 1.05]);
  
  const upvoteGlow = useTransform(x, [20, 120], [0, 1]);
  const downvoteGlow = useTransform(x, [-120, -20], [1, 0]);
  const upvoteScale = useTransform(x, [20, 120], [0.8, 1.1]);
  const downvoteScale = useTransform(x, [-120, -20], [1.1, 0.8]);
  const upvoteRotate = useTransform(x, [20, 120], [-10, 0]);
  const downvoteRotate = useTransform(x, [-120, -20], [0, 10]);

  const currentPlayerEntry = useMemo(() => lineup[currentIndex], [lineup, currentIndex]);
  const nextPlayerEntry = useMemo(() => lineup[currentIndex + 1], [lineup, currentIndex]);
  const totalPlayers = lineup.length;

  useEffect(() => {
    totalPlayersRef.current = totalPlayers;
  }, [totalPlayers]);

  // Preloading Assets
  useEffect(() => {
    const preloadImages = () => {
      // PRELOAD FRAMES
      ['bronze', 'silver', 'gold'].forEach(tier => {
        const img = new Image();
        img.src = `/assets/frames/card-frame-${tier}.png`;
      });

      // PRELOAD next few players
      const maxPreload = Math.min(currentIndex + 4, lineup.length);
      for (let i = currentIndex; i < maxPreload; i++) {
        const player = lineup[i]?.players;
        if (player) {
          if (player.photo_url) {
            const img = new Image();
            img.src = player.photo_url;
          }
          const clubLogo = player.teams?.clubs?.logo_url;
          if (clubLogo) {
            const img = new Image();
            img.src = clubLogo;
          }
          const flagCode = (player.nationality || 'de').toLowerCase();
          const flagImg = new Image();
          flagImg.src = `https://flagcdn.com/w80/${flagCode}.png`;
        }
      }
    };

    preloadImages();
  }, [lineup, currentIndex]);

  const markAsCompleted = useCallback(async () => {
    if (!userId || !fixtureId) return;
    
    if (queueRef.current.length > 0) {
      return;
    }

    try {
      await supabaseService.markVoteAsCompleted(fixtureId, userId);
      console.log(`DEBUG: [COMPLETION] Sync success for ${fixtureId}`);
    } catch (err) {
      console.error(`DEBUG: [COMPLETION] Sync error:`, err);
    }
  }, [fixtureId, userId]);

  // Queue background processor
  const processQueue = useCallback(async () => {
    if (isProcessingQueue.current || queueRef.current.length === 0) return;
    
    isProcessingQueue.current = true;
    
    while (queueRef.current.length > 0) {
      const item = queueRef.current[0];
      try {
        await onVote(item.playerId, item.vote);
        queueRef.current.shift(); // Remove handled item
      } catch (err: any) {
        if (err.message?.includes('already completed')) {
          queueRef.current.shift();
          continue;
        }

        item.retries++;
        if (item.retries >= 3) {
          queueRef.current.shift();
        } else {
          // Wait a bit before retry
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    
    isProcessingQueue.current = false;
    
    if (queueRef.current.length === 0 && completedSwipeCountRef.current >= totalPlayersRef.current) {
      markAsCompleted();
    }
  }, [onVote, markAsCompleted]);

  useEffect(() => {
    const checkCompletion = async () => {
      if (!userId || !fixtureId) {
        setIsCheckingCompletion(false);
        return;
      }

      try {
        const isCompleted = await supabaseService.checkVoteCompletion(fixtureId, userId);
        if (isCompleted) {
          setHasCompletedBefore(true);
          setCompleted(true);
        }
      } catch (err) {
        console.error('Error checking vote completion:', err);
      } finally {
        setIsCheckingCompletion(false);
      }
    };

    checkCompletion();
  }, [userId, fixtureId]);

  const handleVoteAction = useCallback((playerId: string, vote: 'up' | 'down' | 'neutral') => {
    // 1. Add to queue (optimistic)
    queueRef.current.push({ playerId, vote, retries: 0 });
    completedSwipeCountRef.current += 1;
    
    // Trigger queue asynchronously without react state updates
    setTimeout(() => {
      processQueue();
    }, 0);

    // 2. UI Update immediately
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < totalPlayersRef.current) {
      setCurrentIndex(nextIndex);
      setExitDirection(0);
      x.set(0);
    } else {
      setCompleted(true);
    }

    setIsVoting(false);
  }, [currentIndex, x, processQueue]);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (isVoting || completed || !currentPlayerEntry?.players) return;

    if (votingCloseAt && new Date(votingCloseAt) <= new Date()) {
      setCompleted(true);
      return;
    }
    
    const vote = direction === 'right' ? 'up' : 'down';
    if (showHint) setShowHint(false);
    
    setExitDirection(direction === 'right' ? 800 : -800);
    setIsVoting(true);

    handleVoteAction(currentPlayerEntry.player_id, vote);
  }, [isVoting, completed, currentPlayerEntry, votingCloseAt, showHint, handleVoteAction]);

  const handleNeutralVote = useCallback(() => {
    if (isVoting || completed || !currentPlayerEntry?.players) return;
    
    if (votingCloseAt && new Date(votingCloseAt) <= new Date()) {
      setCompleted(true);
      return;
    }

    setIsVoting(true);
    setExitDirection(0);

    handleVoteAction(currentPlayerEntry.player_id, 'neutral');
  }, [isVoting, completed, currentPlayerEntry, votingCloseAt, handleVoteAction]);

  const handleDragEnd = useCallback((_: any, info: any) => {
    const threshold = 80; // Smaller threshold for faster reaction
    if (info.offset.x > threshold) {
      handleSwipe('right');
    } else if (info.offset.x < -threshold) {
      handleSwipe('left');
    }
  }, [handleSwipe]);

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

  if (isCheckingCompletion) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center p-6 text-center"
      >
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Lade Status...</p>
      </motion.div>
    );
  }

  if (completed) {
    const isProcessed = !!resultsProcessedAt;
    const isVotingEnded = votingCloseAt ? new Date(votingCloseAt) <= new Date() : true;

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center p-8 text-center"
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full" />
        </div>

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center mb-8 border border-emerald-500/20 relative">
            <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full animate-pulse" />
            <CheckCircle2 className="w-12 h-12 text-emerald-500 relative z-10" />
          </div>
          
          <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-2 text-white">
            Voting abgeschlossen
          </h2>
          <p className="text-emerald-500 font-black italic uppercase tracking-widest text-xs mb-8">
            {hasCompletedBefore ? "Du hast für dieses Spiel bereits abgestimmt." : "Deine Stimme wurde gespeichert"}
          </p>

          <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl mb-12 max-w-xs">
            <p className="text-zinc-400 font-medium text-sm leading-relaxed">
              {isProcessed 
                ? "Die Ergebnisse sind jetzt verfügbar! Schau dir an, wie die Community abgestimmt hat."
                : "Danke für dein Voting! Die offiziellen Ergebnisse sind verfügbar, sobald das Voting-Fenster geschlossen wurde."}
            </p>
            {!isProcessed && !isVotingEnded && (
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                <Clock className="w-3 h-3" />
                Ergebnisse nach Voting-Ende
              </div>
            )}
          </div>

          <div className="w-full max-w-xs space-y-3">
            <button
              onClick={onClose}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black italic uppercase tracking-tighter py-5 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95"
            >
              <Trophy className="w-5 h-5" /> Zurück zum Match
            </button>
            
            <button
              onClick={() => navigate('/matches')}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black italic uppercase tracking-tighter py-5 rounded-2xl transition-all border border-white/5 flex items-center justify-center gap-2 active:scale-95"
            >
              Zur Übersicht
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  const currentPlayer = currentPlayerEntry?.players;

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
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-2">Fortschritt</div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-32 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${((currentIndex + 1) / totalPlayers) * 100}%` }}
                className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
              />
            </div>
            <span className="text-sm font-black italic text-emerald-500 tabular-nums">
              {currentIndex + 1} <span className="text-zinc-700 mx-0.5">/</span> {totalPlayers}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
            {isProcessingQueue.current && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-emerald-500/20 rounded-xl">
                    <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />
                    <span className="text-[8px] font-black uppercase text-emerald-500 tracking-widest">Syching...</span>
                </div>
            )}
        </div>
      </div>

      {/* Main Swipe Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-6">
        <div className="absolute inset-x-6 top-0 flex justify-between pointer-events-none z-10">
          <div className="flex flex-col items-center gap-1 opacity-20">
            <ThumbsDown className="w-6 h-6 text-red-500" />
            <span className="text-[8px] font-black uppercase tracking-widest text-red-500">Schwach</span>
          </div>
          <div className="flex flex-col items-center gap-1 opacity-20">
            <ThumbsUp className="w-6 h-6 text-emerald-500" />
            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Stark</span>
          </div>
        </div>

        <div className="relative flex flex-col items-center w-full max-w-[350px]">
            {/* NEXT CARD (Static preview behind) */}
            {nextPlayerEntry && (
              <div
                key={`next-${nextPlayerEntry.player_id}`}
                className="absolute inset-0 pointer-events-none z-0"
                style={{ transform: 'scale(0.95) translateY(10px)', opacity: 0.8 }}
              >
                <PlayerCard 
                  player={nextPlayerEntry.players} 
                  jerseyNumber={nextPlayerEntry.jersey_number}
                  lineupRole={nextPlayerEntry.lineup_role}
                />
              </div>
            )}

            {/* CURRENT CARD */}
            <AnimatePresence>
                {currentPlayer && (
                  <motion.div
                    key={currentPlayer.id}
                    style={{ x, rotate, opacity, scale: cardScale }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={handleDragEnd}
                    initial={{ scale: 0.95, opacity: 1, x: 0 }}
                    animate={{ scale: 1, opacity: 1, x: 0 }}
                    exit={{ x: exitDirection, opacity: 0, scale: 0.5, rotate: exitDirection / 10 }}
                    transition={{ type: 'spring', damping: 30, stiffness: 500 }}
                    className="cursor-grab active:cursor-grabbing relative z-10"
                  >
                    <div className="relative rounded-[3rem] overflow-hidden shadow-2xl">
                      <PlayerCard 
                        player={currentPlayer} 
                        jerseyNumber={currentPlayerEntry?.jersey_number}
                        lineupRole={currentPlayerEntry?.lineup_role}
                      />
                      
                      <motion.div 
                        style={{ opacity: upvoteGlow, scale: upvoteScale, rotate: upvoteRotate }}
                        className="absolute inset-0 bg-emerald-500/40 flex items-center justify-center z-30 backdrop-blur-[2px]"
                      >
                        <div className="bg-emerald-500 text-black font-black italic uppercase tracking-tighter px-10 py-5 rounded-2xl border-4 border-emerald-400 shadow-2xl scale-110">
                          👍 GUT
                        </div>
                      </motion.div>
                      
                      <motion.div 
                        style={{ opacity: downvoteGlow, scale: downvoteScale, rotate: downvoteRotate }}
                        className="absolute inset-0 bg-red-500/40 flex items-center justify-center z-30 backdrop-blur-[2px]"
                      >
                        <div className="bg-red-500 text-black font-black italic uppercase tracking-tighter px-10 py-5 rounded-2xl border-4 border-red-400 shadow-2xl scale-110">
                          👎 SCHLECHT
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                )}
            </AnimatePresence>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-10 pb-16 flex flex-col items-center gap-8 relative z-10">
        <div className="text-center space-y-4">
          <div className="space-y-1">
            <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white">
              {currentPlayer?.full_name}
            </h3>
            <p className="text-zinc-500 text-[11px] font-black uppercase tracking-[0.3em]">
              <span className={currentPlayerEntry?.lineup_role === 'starter' ? 'text-emerald-500' : 'text-amber-500'}>
                {currentPlayerEntry?.lineup_role === 'starter' ? 'STARTER' : 'SUBSTITUTE'}
              </span>
              <span className="mx-3 text-zinc-800">•</span>
              {currentPlayerEntry?.teams?.name}
            </p>
          </div>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleNeutralVote}
            disabled={isVoting}
            className="flex flex-col items-center gap-1.5 group transition-all active:scale-95 mx-auto"
          >
            <span className="text-zinc-400 group-hover:text-zinc-200 font-black italic uppercase tracking-[0.3em] text-[10px] py-2.5 px-10 bg-zinc-900/80 border border-white/20 rounded-full transition-colors">
              Neutral
            </span>
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest opacity-60">
              (keine Bewertung)
            </span>
          </motion.button>
        </div>

        <div className="flex items-center gap-8">
          <button
            onClick={() => handleSwipe('left')}
            disabled={isVoting}
            className="w-20 h-20 bg-zinc-900 border-2 border-zinc-800 rounded-[2.5rem] flex items-center justify-center text-red-500 hover:bg-red-500/10 hover:border-red-500/50 transition-all active:scale-90 shadow-2xl"
          >
            <ThumbsDown className="w-8 h-8" />
          </button>
          
          <button
            onClick={() => handleSwipe('right')}
            disabled={isVoting}
            className="w-20 h-20 bg-zinc-900 border-2 border-zinc-800 rounded-[2.5rem] flex items-center justify-center text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all active:scale-90 shadow-2xl"
          >
            <ThumbsUp className="w-8 h-8" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
