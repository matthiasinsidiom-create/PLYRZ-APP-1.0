import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, ChevronLeft, Loader2, Share2, Medal } from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { PlayerCard } from '../../components/PlayerCard';
import SafeAreaWrapper from '../../components/SafeAreaWrapper';
import * as htmlToImage from 'html-to-image';

export const SeasonTop3: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [top3, setTop3] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const particles = useMemo(() => Array.from({ length: 60 }).map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    size: Math.random() * 8 + 3,
    duration: Math.random() * 8 + 12,
    delay: Math.random() * 5,
  })), []);

  useEffect(() => {
    const loadTop3 = async () => {
      try {
        const players = await supabaseService.getSeasonTop10Players();
        setTop3(players);
      } catch (err) {
        console.error('Error loading top 3:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTop3();
  }, []);

  const handleExport = async () => {
    if (!exportRef.current) return;
    try {
      setExporting(true);
      
      // Delay to let UI update (hide button if needed)
      await new Promise(r => setTimeout(r, 100));

      const dataUrl = await htmlToImage.toPng(exportRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#09090b', // zinc-950
      });

      const rootWindow = window.parent || window;
      
      // Web Share API if available
      if (rootWindow.navigator.share) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], 'plyrz-saison-top10.png', { type: 'image/png' });
          await rootWindow.navigator.share({
            title: 'Saison Top 10 - PLYRZ',
            files: [file]
          });
          return;
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error('Share failed:', err);
          }
        }
      }

      // Fallback: download
      const link = rootWindow.document.createElement('a');
      link.download = 'plyrz-saison-top10.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export error:', err);
      const rootWindow = window.parent || window;
      rootWindow.alert('Fehler beim Erstellen des Bildes');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-zinc-950 flex justify-center items-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const getRankStyle = (idx: number) => {
    switch (idx) {
      case 0: return { label: 'Platz 1', color: 'from-amber-200 to-yellow-500', border: 'border-yellow-500/50', glow: 'bg-yellow-400', beam: 'from-yellow-400/80' };
      case 1: return { label: 'Platz 2', color: 'from-zinc-200 to-zinc-400', border: 'border-zinc-400/50', glow: 'bg-zinc-200', beam: 'from-zinc-300/60' };
      case 2: return { label: 'Platz 3', color: 'from-orange-300 to-orange-600', border: 'border-orange-500/50', glow: 'bg-orange-500', beam: 'from-orange-500/60' };
      default: return { label: `Platz ${idx + 1}`, color: 'from-zinc-400 to-zinc-600', border: 'border-white/10', glow: 'bg-zinc-500', beam: 'from-transparent' };
    }
  };

  return (
    <SafeAreaWrapper>
      <div className="min-h-full bg-zinc-950 text-white pb-[calc(10rem+env(safe-area-inset-bottom))]">
        
        {/* Simple Header */}
        <div className="p-6 pt-[10px] flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-50 border-b border-white/5">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex flex-col items-end">
            <h1 className="text-xl font-black italic uppercase tracking-tight">Top 10</h1>
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Saisonende</span>
          </div>
        </div>

        {/* Export Container */}
        <div className="p-4 sm:p-6 lg:p-8">
          <div 
            ref={exportRef} 
            className="relative bg-gradient-to-b from-[#050505] to-[#0b0b12] rounded-[3rem] p-6 sm:p-10 border border-white/5 overflow-hidden shadow-2xl"
          >
            {/* Elegant Premium Background Elements */}
            
            {/* Stadium Lights (Atmosphere) */}
            <motion.div 
              className="absolute top-0 left-1/4 w-[60%] h-[40%] bg-blue-500/20 blur-[130px] rounded-full pointer-events-none z-0 mix-blend-lighten"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div 
              className="absolute bottom-1/4 right-1/4 w-[50%] h-[50%] bg-amber-500/30 blur-[120px] rounded-full pointer-events-none z-0 mix-blend-lighten"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            />
            {/* Massive Middle Spotlight */}
            <motion.div 
              className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[90%] h-[80%] bg-amber-500/20 blur-[160px] rounded-full pointer-events-none z-0 mix-blend-screen"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Particles Layer */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
              {particles.map((p) => (
                <motion.div
                  key={p.id}
                  className="absolute bg-amber-200 rounded-full"
                  style={{
                    left: p.left,
                    top: p.top,
                    width: p.size,
                    height: p.size,
                    boxShadow: '0 0 15px 2px rgba(253, 230, 138, 1)',
                  }}
                  animate={{
                    y: [0, -100, 0],
                    x: [0, 50, 0],
                    opacity: [0, 0.8, 0],
                  }}
                  transition={{
                    duration: p.duration,
                    repeat: Infinity,
                    delay: p.delay,
                    ease: "linear",
                  }}
                />
              ))}
            </div>
            
            {/* Soft global spotlight */}
            <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[80%] h-[60%] bg-amber-500/10 blur-[130px] rounded-[100%] pointer-events-none z-0" />
            
            {/* Very subtle noise texture */}
            <div className="absolute inset-0 opacity-[0.03] z-0 pointer-events-none mix-blend-overlay" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'}}></div>

            {/* Vignette */}
            <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,1)] z-0 pointer-events-none"></div>

            <div className="text-center mb-16 mt-4 relative z-10">
              <div className="inline-flex items-center justify-center p-5 bg-gradient-to-br from-amber-500/20 to-yellow-600/10 rounded-full mb-6 border border-amber-500/20 shadow-[0_0_40px_rgba(245,158,11,0.1)]">
                <Trophy className="w-10 h-10 text-amber-400 drop-shadow-md" />
              </div>
              <h2 className="text-4xl font-black italic uppercase tracking-tighter bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-transparent">Saison Top 10</h2>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-3 flex items-center justify-center gap-3">
                <span className="text-amber-500/70">★</span>
                <span>PLYRZ Award</span>
                <span className="text-amber-500/70">★</span>
              </div>
            </div>

            <div className="space-y-24 relative z-10 pb-8">
              {/* TOP 10 */}
              {top3.slice(0, 10).map((player, idx) => {
                const s = player.season_stats || {};
                const rank = getRankStyle(idx);

                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    key={player.id} 
                    className="flex flex-col items-center relative"
                  >
                    {/* Position Light Beams & Laurel */}
                    <div className="absolute inset-0 pointer-events-none flex justify-center items-center z-0">
                      {/* Ambient Glow behind card */}
                      <motion.div 
                        className={`absolute w-[300px] h-[400px] sm:w-[500px] sm:h-[650px] ${rank.glow} blur-[100px] rounded-[100%] pointer-events-none z-0 mix-blend-screen opacity-[0.6]`}
                        animate={{ opacity: [0.5, 0.8, 0.5], scale: [0.95, 1.1, 0.95] }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: idx * 0.5 }}
                      />
                      
                      {/* Golden Beams */}
                      {idx < 3 && (
                        <motion.div 
                          className={`absolute top-[-40%] bottom-[-40%] w-[220px] bg-gradient-to-t ${rank.beam} to-transparent blur-[80px] pointer-events-none z-0 mix-blend-screen`}
                          animate={{ opacity: [0.6, 1, 0.6] }}
                          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: idx }}
                        />
                      )}

                      {/* Laurel Wreath */}
                      <div className="absolute top-[5%] sm:top-0 w-[420px] h-[420px] sm:w-[550px] sm:h-[550px] opacity-[0.15] pointer-events-none z-0 flex items-center justify-center">
                        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5" className={`w-full h-full drop-shadow-2xl ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-zinc-300' : idx === 2 ? 'text-orange-500' : 'text-zinc-600'}`}>
                          <path d="M50 95 C20 95 5 70 15 35 M48 85 Q35 75 40 60 Q45 70 48 85 M38 70 Q25 60 28 45 Q35 55 38 70 M25 55 Q12 45 15 30 Q22 40 25 55 M15 35 Q5 25 5 15 Q15 20 15 35" fill="currentColor" />
                          <path d="M50 95 C80 95 95 70 85 35 M52 85 Q65 75 60 60 Q55 70 52 85 M62 70 Q75 60 72 45 Q65 55 62 70 M75 55 Q88 45 85 30 Q78 40 75 55 M85 35 Q95 25 95 15 Q85 20 85 35" fill="currentColor" />
                        </svg>
                      </div>
                    </div>

                    {/* Rank Indicator */}
                    <div className="flex items-center gap-3 mb-8 relative z-20">
                      <h3 className={`text-3xl font-black italic uppercase tracking-[0.2em] bg-gradient-to-br ${rank.color} bg-clip-text text-transparent drop-shadow-sm`}>
                        {rank.label}
                      </h3>
                    </div>

                    <div className="relative mb-10 w-full flex justify-center">
                      <div className={`relative z-10 mx-auto ${
                        idx === 0 
                          ? 'w-[280px] h-[392px] sm:w-[350px] sm:h-[490px]' 
                          : 'w-[228px] h-[318px] sm:w-[280px] sm:h-[392px]'
                      }`}>
                        <div className={`absolute top-0 left-0 origin-top-left drop-shadow-2xl z-10 ${
                          idx === 0 
                            ? 'scale-[0.8] sm:scale-100' 
                            : 'scale-[0.65] sm:scale-[0.8]'
                        }`}>
                          <PlayerCard 
                            player={player}
                            clubLogo={player.teams?.clubs?.logo_url}
                          />
                        </div>
                        
                        {/* Score Badge */}
                        <div className={`absolute -right-2 -bottom-2 bg-zinc-950 border-2 ${rank.border} rounded-xl sm:rounded-2xl p-2 sm:p-3 shadow-xl z-20 rotate-3 sm:-right-4 sm:-bottom-4`}>
                          <div className="text-[9px] sm:text-[10px] font-black uppercase text-zinc-500 tracking-widest leading-none mb-1">Score</div>
                          <div className={`text-lg sm:text-xl font-black italic ${idx === 0 ? 'text-amber-400' : 'text-white'} leading-none`}>
                            {Math.round(player.season_score)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats Box */}
                    <div className="mt-4 w-full max-w-sm mx-auto bg-black/40 backdrop-blur-md rounded-3xl p-4 border border-white/5 space-y-3">
                      
                      <div className="flex items-center justify-between pb-3 border-b border-white/5">
                        <div className="space-y-1">
                          <div className="text-sm font-black text-white">{player.full_name}</div>
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{player.teams?.clubs?.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-black uppercase text-zinc-500 tracking-widest leading-none mb-1">OVR</div>
                          <div className={`text-xl font-black italic text-white leading-none`}>
                            {player.current_stats?.overall || '-'}
                          </div>
                        </div>
                      </div>

                      {/* Detail Stats Grid */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white/5 rounded-2xl p-2 text-center">
                          <div className="text-[14px] mb-1">🎮</div>
                          <div className="text-[9px] font-black text-zinc-500 uppercase mb-1">Spiele</div>
                          <div className="text-sm font-black text-white">{s.appearances || 0}</div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-2 text-center">
                          <div className="text-[14px] mb-1">⚽</div>
                          <div className="text-[9px] font-black text-zinc-500 uppercase mb-1">Tore</div>
                          <div className="text-sm font-black text-white">{s.goals || 0}</div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-2 text-center">
                          <div className="text-[14px] mb-1">👟</div>
                          <div className="text-[9px] font-black text-zinc-500 uppercase mb-1">Assists</div>
                          <div className="text-sm font-black text-white">{s.assists || 0}</div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-2 text-center">
                          <div className="text-[14px] mb-1">🏆</div>
                          <div className="text-[9px] font-black text-zinc-500 uppercase mb-1">MVPs</div>
                          <div className="text-sm font-black text-amber-500">{s.mvps || 0}</div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-2 text-center">
                          <div className="text-[14px] mb-1">👍</div>
                          <div className="text-[9px] font-black text-zinc-500 uppercase mb-1">Upvotes</div>
                          <div className="text-sm font-black text-emerald-500">{s.upvotes || 0}</div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-2 text-center">
                          <div className="text-[14px] mb-1">📈</div>
                          <div className="text-[9px] font-black text-zinc-500 uppercase mb-1">Rating</div>
                          <div className={`text-sm font-black ${(s.delta_overall > 0) ? 'text-emerald-500' : (s.delta_overall < 0 ? 'text-red-500' : 'text-zinc-400')}`}>
                            {s.delta_overall > 0 ? '+' : ''}{(s.delta_overall || 0).toFixed(1)}
                          </div>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                );
              })}
            </div>
            
            <div className="text-center mt-10 opacity-50 z-10 relative">
              <div className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">PLYRZ.APP</div>
            </div>
          </div>
        </div>

        {/* Fixed Action Bar for Sharing */}
        <div className="fixed bottom-6 left-0 w-full px-6 z-50">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black italic uppercase tracking-widest py-4 rounded-full flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                Top 10 Teilen
              </>
            )}
          </button>
        </div>

      </div>
    </SafeAreaWrapper>
  );
};
