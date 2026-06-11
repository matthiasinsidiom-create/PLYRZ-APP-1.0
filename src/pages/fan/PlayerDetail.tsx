import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Award,
  History,
  Info,
  Zap,
  Target,
  Shield,
  Activity,
  ChevronRight,
  Star,
  Users,
  Share2
} from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { useAuth } from '../../context/AuthContext';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { supabaseService } from '../../services/supabaseService';
import { Player, PlayerStats, PlayerRatingHistory, Team, Club } from '../../types';
import { PlayerCard } from '../../components/PlayerCard';
import { getPositionShort } from '../../lib/positions';

type ExtendedHistory = PlayerRatingHistory & { 
  fixtures: { 
    kickoff_at: string, 
    home_team: { name: string, clubs: { name: string } }, 
    away_team: { name: string, clubs: { name: string } } 
  } 
};

export const PlayerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<(Player & { teams: Team & { clubs: Club }, player_stats: PlayerStats[] }) | null>(null);
  const [history, setHistory] = useState<ExtendedHistory[]>([]);
  const [sharing, setSharing] = useState(false);
  const exportRef = React.useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    if (!exportRef.current || !player) return;
    setSharing(true);
    try {
      // Add slight delay to ensure fonts/images are ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const dataUrl = await htmlToImage.toPng(exportRef.current, {
        pixelRatio: 3,
        backgroundColor: 'transparent',
      });

      const blob = await fetch(dataUrl).then(r => r.blob());
      const file = new File([blob], `plyrz_card_${player.full_name?.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Meine PLYRZ Karte: ${player.full_name}`,
          text: `Schau dir meine aktuelle PLYRZ Karte an!`
        });
      } else {
        // Fallback to download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error sharing card:', err);
      alert('Fehler beim Teilen der Karte. Ggf. blockieren externe Bilder den Export.');
    } finally {
      setSharing(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadPlayerData();
    }
  }, [id]);

  const loadPlayerData = async () => {
    setLoading(true);
    try {
      const [playerData, historyData] = await Promise.all([
        supabaseService.getPlayerById(id!),
        supabaseService.getPlayerRatingHistory(id!)
      ]);
      setPlayer(playerData);
      setHistory(historyData);
    } catch (err) {
      console.error('Error loading player details:', err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!history.length) return [];
    return [...history]
      .reverse()
      .map((item, index) => ({
        name: `Spiel ${index + 1}`,
        rating: item.new_overall,
        date: new Date(item.processed_at).toLocaleDateString(),
        delta: item.delta_overall
      }));
  }, [history]);

  const insights = useMemo(() => {
    if (!history.length) return { avg: 0, best: 0, worst: 0 };
    const ratings = history.map(h => h.new_overall);
    return {
      avg: Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length),
      best: Math.max(...ratings),
      worst: Math.min(...ratings)
    };
  }, [history]);

  const latestChange = useMemo(() => {
    if (!history.length) return null;
    const latest = history[0];
    return {
      previous: latest.new_overall - latest.delta_overall,
      current: latest.new_overall,
      delta: latest.delta_overall
    };
  }, [history]);

  const trendColor = useMemo(() => {
    if (chartData.length < 2) return '#10b981';
    const first = chartData[0].rating;
    const last = chartData[chartData.length - 1].rating;
    return last >= first ? '#10b981' : '#ef4444';
  }, [chartData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-transparent text-white p-6 flex flex-col items-center justify-center space-y-4">
        <Info className="w-12 h-12 text-zinc-700" />
        <h2 className="text-xl font-bold">Spieler nicht gefunden</h2>
        <button 
          onClick={() => navigate(-1)}
          className="text-emerald-500 font-bold flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Zurück
        </button>
      </div>
    );
  }

  const clubLogo = player.teams?.clubs?.logo_url;
  const stats = player.current_stats;
  const overall = stats?.overall || 0;
  const tier = overall >= 75 ? 'gold' : overall >= 65 ? 'silver' : 'bronze';
  const glowColor = tier === 'gold' ? '#fbbf24' : tier === 'silver' ? '#94a3b8' : '#b45309';

  return (
    <div className="min-h-screen bg-transparent text-white font-sans pb-24 overflow-x-hidden w-full max-w-full">
      {/* Header */}
      <div className="p-6 pt-[10px] sticky top-0 bg-black/20 backdrop-blur-xl z-50 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-xl font-black italic tracking-tighter uppercase">Spielerprofil</h1>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{player.full_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Award className="w-5 h-5 text-emerald-500" />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-12">
        {/* HERO SECTION */}
        <section className="flex flex-col md:flex-row items-center md:items-start gap-16 pt-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1.1 }}
            className="flex-shrink-0 relative"
          >
            {/* Tier Glow */}
            <div 
              className="absolute -inset-8 blur-3xl rounded-full opacity-30 animate-pulse"
              style={{ backgroundColor: glowColor }}
            />
            
            <div className="absolute -left-[9999px] top-0 pointer-events-none opacity-0 flex">
               <div ref={exportRef} className="bg-transparent w-[350px] h-[490px]">
                   <PlayerCard 
                     player={{ ...player, claimed_by_user_id: null } as any} 
                     clubLogo={clubLogo}
                     jerseyNumber={null}
                   />
               </div>
            </div>

            <div className="relative z-10 w-fit mx-auto">
                <PlayerCard 
                  player={player} 
                  clubLogo={clubLogo}
                  jerseyNumber={player.jersey_number}
                  onClick={() => navigate(`/players/${player.id}`)}
                />
            </div>

            <div className="relative z-10">
              {player.claimed_by_user_id === user?.id && (
                <button 
                  onClick={handleShare}
                  disabled={sharing}
                  className="mt-6 w-full bg-zinc-800 hover:bg-zinc-700 border border-white/10 transition-all text-white font-black italic uppercase tracking-tighter py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xl disabled:opacity-50"
                >
                  <Share2 className="w-5 h-5 text-emerald-500" />
                  {sharing ? 'Wird verarbeitet...' : 'Meine Karte teilen'}
                </button>
              )}
            </div>
          </motion.div>

          <div className="flex-1 space-y-10 w-full pt-4">
            <div className="space-y-6 text-center md:text-left">
              <div className="space-y-2">
                <motion.h2 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-6xl md:text-7xl font-black italic uppercase tracking-tighter leading-none text-white drop-shadow-2xl"
                >
                  <div className="flex items-center gap-4">
                    {player.full_name}
                    {player.claimed_by_user_id && (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-black uppercase tracking-widest border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                        BEANSPRUCHT
                      </span>
                    )}
                  </div>
                </motion.h2>
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex flex-wrap items-center justify-center md:justify-start gap-6"
                >
                  <div className="text-5xl font-black italic text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                    {overall} <span className="text-xl text-zinc-500 not-italic uppercase tracking-widest font-bold">OVR</span>
                  </div>

                  {latestChange && (
                    <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-md">
                      <div className="text-center">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Vorher</div>
                        <div className="text-lg font-black italic text-zinc-400">{Number(latestChange.previous).toFixed(1)}</div>
                      </div>
                      <div className="w-px h-8 bg-white/10" />
                      <div className="text-center">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Trend</div>
                        <div className={`text-lg font-black italic flex items-center gap-1 ${latestChange.delta > 0 ? 'text-emerald-500' : latestChange.delta < 0 ? 'text-red-500' : 'text-zinc-500'}`}>
                          {latestChange.delta > 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : latestChange.delta < 0 ? (
                            <TrendingDown className="w-4 h-4" />
                          ) : null}
                          {latestChange.delta > 0 ? `+${Number(latestChange.delta).toFixed(1)}` : Number(latestChange.delta).toFixed(1)}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
                  {clubLogo && <img src={clubLogo} alt="" className="w-5 h-5 object-contain" />}
                  <span className="text-sm font-bold text-zinc-300 uppercase tracking-widest">
                    {player.teams?.clubs?.name}
                  </span>
                </div>
                <div className="text-sm font-bold text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20 uppercase tracking-widest backdrop-blur-md">
                  {getPositionShort(player.position)}
                </div>
                <div className="text-sm font-bold text-blue-500 bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20 uppercase tracking-widest backdrop-blur-md">
                  #{player.jersey_number || '--'}
                </div>
              </div>
            </div>

            {/* PERFORMANCE INSIGHTS */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl text-center">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Ø Rating</div>
                <div className="text-2xl font-black italic text-white">{insights.avg || '--'}</div>
              </div>
              <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl text-center border-emerald-500/20">
                <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Bestwert</div>
                <div className="text-2xl font-black italic text-white">{insights.best || '--'}</div>
              </div>
              <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl text-center border-red-500/20">
                <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Tiefstwert</div>
                <div className="text-2xl font-black italic text-white">{insights.worst || '--'}</div>
              </div>
            </div>

            {/* STATS BREAKDOWN */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'TEM', value: stats?.tem, icon: Zap, color: 'text-amber-500' },
                { label: 'SCH', value: stats?.sch, icon: Target, color: 'text-red-500' },
                { label: 'PAS', value: stats?.pas, icon: Activity, color: 'text-blue-500' },
                { label: 'DRI', value: stats?.dri, icon: Star, color: 'text-purple-500' },
                { label: 'DEF', value: stats?.def, icon: Shield, color: 'text-emerald-500' },
                { label: 'PHY', value: stats?.phy, icon: Users, color: 'text-orange-500' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col items-center justify-center space-y-1">
                  <div className="flex items-center gap-1.5">
                    <stat.icon className={`w-3 h-3 ${stat.color}`} />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{stat.label}</span>
                  </div>
                  <div className="text-2xl font-black italic text-white leading-none">{stat.value || '--'}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RATING HISTORY CHART */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <h2 className="text-xl font-black italic uppercase tracking-tight">Rating Verlauf</h2>
            </div>
          </div>

          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-3xl h-[300px] w-full">
            {history.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={trendColor} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={trendColor} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#71717a" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#71717a" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    domain={['dataMin - 3', 'dataMax + 3']}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      borderColor: '#ffffff10', 
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                    }}
                    itemStyle={{ color: trendColor, fontWeight: 'bold' }}
                    labelStyle={{ color: '#71717a', marginBottom: '4px' }}
                    cursor={{ stroke: '#ffffff10', strokeWidth: 2 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="rating" 
                    stroke={trendColor} 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorRating)" 
                    animationDuration={1500}
                    activeDot={{ 
                      r: 6, 
                      fill: trendColor, 
                      stroke: '#fff', 
                      strokeWidth: 2,
                      shadowBlur: 10
                    }}
                    dot={(props: any) => {
                      const { cx, cy, payload, index } = props;
                      if (index === chartData.length - 1) {
                        return (
                          <circle 
                            key={`dot-${index}`}
                            cx={cx} 
                            cy={cy} 
                            r={6} 
                            fill={trendColor} 
                            stroke="#fff" 
                            strokeWidth={2} 
                          />
                        );
                      }
                      return null;
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-2">
                <Activity className="w-8 h-8 opacity-20" />
                <p className="text-sm font-medium">Nicht genug Daten für Chart.</p>
              </div>
            )}
          </div>
        </section>

        {/* LAST MATCHES */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <History className="w-5 h-5 text-blue-500" />
            </div>
            <h2 className="text-xl font-black italic uppercase tracking-tight">Letzte Spiele</h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {history.length > 0 ? (
              history.map((item) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="bg-black/40 backdrop-blur-md border border-white/10 p-4 sm:p-5 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6"
                >
                  <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 ${item.delta_overall >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      {item.delta_overall >= 0 ? (
                        <TrendingUp className={`w-5 h-5 sm:w-6 sm:h-6 ${item.delta_overall > 0 ? 'text-emerald-500' : 'text-zinc-500'}`} />
                      ) : (
                        <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] sm:text-sm font-black italic uppercase tracking-tight text-white line-clamp-2 leading-tight">
                        {item.fixtures?.home_team?.clubs?.name} vs {item.fixtures?.away_team?.clubs?.name}
                      </div>
                      <div className="flex flex-col gap-0.5 mt-1.5">
                        <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest leading-none">
                          {item.fixtures?.home_team?.name === item.fixtures?.away_team?.name 
                            ? item.fixtures?.home_team?.name 
                            : `${item.fixtures?.home_team?.name} • ${item.fixtures?.away_team?.name}`}
                        </div>
                        <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.processed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 sm:gap-8 w-full sm:w-auto justify-between sm:justify-end border-t border-white/5 pt-4 sm:pt-0 sm:border-0">
                    <div className="text-center sm:text-right">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Veränderung</div>
                      <div className={`flex items-center gap-1 text-lg font-black italic ${item.delta_overall > 0 ? 'text-emerald-500' : item.delta_overall < 0 ? 'text-red-500' : 'text-zinc-500'}`}>
                        {item.delta_overall > 0 ? (
                          <>
                            <TrendingUp className="w-4 h-4" />
                            +{item.delta_overall}
                          </>
                        ) : item.delta_overall < 0 ? (
                          <>
                            <TrendingDown className="w-4 h-4" />
                            {item.delta_overall}
                          </>
                        ) : (
                          item.delta_overall
                        )}
                      </div>
                    </div>
                    <div className="text-center sm:text-right">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Neuer OVR</div>
                      <div className="text-3xl font-black italic text-white drop-shadow-sm">{item.new_overall}</div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-12 text-center bg-white/5 border border-dashed border-white/10 rounded-3xl">
                <Award className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-500 font-medium">Keine Spielhistorie gefunden.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PlayerDetail;
