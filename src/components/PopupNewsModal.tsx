import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, AlertCircle } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';

export const PopupNewsModal: React.FC = () => {
  const [news, setNews] = useState<{ active: boolean; title: string; message: string; id: string } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const data = await supabaseService.getGlobalSettings('popup_news');
        if (data && data.active) {
          // Check local storage
          const dismissedId = localStorage.getItem('dismissed_news_id');
          if (dismissedId !== data.id) {
            setNews(data);
            setVisible(true);
          }
        }
      } catch (err) {
        console.error('Error fetching popup news:', err);
      }
    };
    
    fetchNews();
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    if (news && news.id) {
      localStorage.setItem('dismissed_news_id', news.id);
    }
  };

  if (!visible || !news) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleDismiss}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-[#1a1b1e] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              <h2 className="text-lg font-black tracking-wider uppercase text-white">
                Aktuelles
              </h2>
            </div>
            <button
              onClick={handleDismiss}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <h3 className="text-xl font-bold text-white">{news.title}</h3>
            <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {news.message}
            </p>
          </div>

          {/* Footer */}
          <div className="p-6 pt-0">
            <button
              onClick={handleDismiss}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase tracking-wider rounded-xl transition-colors"
            >
              Verstanden
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
