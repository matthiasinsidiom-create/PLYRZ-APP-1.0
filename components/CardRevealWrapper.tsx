import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerCard } from './PlayerCard';
import { Player } from '../types';

interface CardRevealWrapperProps {
  player: Player;
  onComplete: () => void;
}

export const CardRevealWrapper: React.FC<CardRevealWrapperProps> = ({ player, onComplete }) => {
  const [phase, setPhase] = useState<number>(0);

  useEffect(() => {
    const sequence = async () => {
      // Phase 1: Black Screen (0.2s)
      setPhase(1);
      await new Promise(r => setTimeout(r, 200));
      
      // Phase 2: Card Entry & Impact (0.6s)
      setPhase(2);
      await new Promise(r => setTimeout(r, 600));
      
      // Phase 3: Shine Sweep (0.8s)
      setPhase(3);
      await new Promise(r => setTimeout(r, 800));
      
      // Phase 4: Text Reveal (0.4s)
      setPhase(4);
      await new Promise(r => setTimeout(r, 400));
      
      // Phase 5: Button Reveal
      setPhase(5);
    };

    sequence();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black">
      <div className="relative flex flex-col items-center z-10">
        {/* CARD REVEAL */}
        <motion.div
          initial={{ opacity: 0, scale: 1.1, y: 300 }}
          animate={phase >= 2 ? {
            opacity: 1,
            y: 0,
            scale: [1.1, 0.98, 1],
          } : {}}
          transition={{
            opacity: { duration: 0.3 },
            y: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
            scale: { 
              duration: 0.6, 
              times: [0, 0.7, 1],
              ease: "easeOut" 
            }
          }}
          className="relative"
        >
          <PlayerCard player={player} />
          
          {/* STRONG SHINE SWEEP */}
          <AnimatePresence>
            {phase >= 3 && (
              <motion.div
                initial={{ left: '-150%', skewX: -25, opacity: 0 }}
                animate={{ left: '150%', opacity: 1 }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
                className="absolute top-0 bottom-0 w-48 z-50 bg-gradient-to-r from-transparent via-white/60 to-transparent pointer-events-none"
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* TEXT & BUTTON */}
        <div className="h-48 flex flex-col items-center mt-12">
          <AnimatePresence>
            {phase >= 4 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-center"
              >
                <h3 className="text-4xl font-black italic uppercase text-white tracking-tighter">
                  Das ist deine Karte.
                </h3>
                
                <AnimatePresence>
                  {phase >= 5 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="mt-10"
                    >
                      <button
                        onClick={onComplete}
                        className="px-16 py-5 bg-emerald-500 text-black font-black rounded-2xl shadow-xl uppercase tracking-widest text-sm hover:bg-emerald-400 transition-all active:scale-95"
                      >
                        Weiter
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
