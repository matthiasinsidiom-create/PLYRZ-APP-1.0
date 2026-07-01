import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface VotingCountdownProps {
  closeAt: string;
  onClose?: () => void;
}

export const VotingCountdown: React.FC<VotingCountdownProps> = ({ closeAt, onClose }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const closeTime = new Date(closeAt).getTime();
      const difference = closeTime - now;

      if (difference <= 0) {
        setTimeLeft('BEENDET');
        if (onClose) onClose();
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [closeAt, onClose]);

  return (
    <div className="flex items-center gap-2 text-emerald-500 font-black italic uppercase tracking-tighter bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
      <Clock className="w-4 h-4" />
      <span>Voting endet in {timeLeft}</span>
    </div>
  );
};
