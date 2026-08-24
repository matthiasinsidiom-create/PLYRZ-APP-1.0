import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RatingLogicContent } from '../../components/RatingLogicContent';

export const RatingLogicScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-full bg-transparent text-white font-sans pb-[calc(10rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="p-6 pt-[10px] flex items-center gap-4 sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-50 border-b border-white/5">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center border border-white/5 hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-xl font-black italic tracking-tighter uppercase">Rating-Logik</h1>
      </div>

      <div className="p-6 max-w-lg mx-auto">
        <RatingLogicContent />
      </div>
    </div>
  );
};

export default RatingLogicScreen;
