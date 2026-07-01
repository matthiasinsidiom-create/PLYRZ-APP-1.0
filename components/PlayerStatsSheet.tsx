import React from 'react';
import { Player } from '../types';
import { resolveLatestStats } from '../lib/stats';
import { getPositionShort } from '../lib/positions';

interface PlayerStatsSheetProps {
  player: Player;
  clubLogo?: string;
  className?: string;
}

export const PlayerStatsSheet = React.memo(({
  player,
  clubLogo,
  className
}: PlayerStatsSheetProps) => {
  const stats = player.current_stats || resolveLatestStats(player);
  
  // Injected season stats
  const seasonStats = (player as any).seasonStats || {
    games: 0,
    goals: 0,
    assists: 0,
    mvps: 0,
    yellowCards: 0,
    redCards: 0
  };

  const clubLogoSrc = clubLogo || player.teams?.clubs?.logo_url || "/assets/clubs/rw.png";
  const fullName = player.full_name || 'Unbekannt';
  const positionShort = getPositionShort(player.position);
  const clubName = player.teams?.clubs?.name || 'Unbekannt';

  return (
    <div 
      className={`bg-white text-zinc-900 relative ${className || ''}`}
      style={{
        width: '595px',
        height: '842px', // A4 proportions
        fontFamily: '"Inter", sans-serif',
        padding: '48px',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center border-b-2 border-zinc-200 pb-6 mb-8">
        <div>
          <img 
            src="https://upvzomofjjwaxkfogpuc.supabase.co/storage/v1/object/public/assets/logo/Logo1024.png" 
            alt="PLYRZ Logo" 
            className="h-12 w-auto object-contain brightness-0 opacity-80" 
            crossOrigin="anonymous"
          />
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tracking-tight uppercase text-zinc-800">Saison 2025/26</div>
          <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Offizielles Statistikblatt</div>
        </div>
      </div>

      {/* Player Identity */}
      <div className="flex items-center gap-8 mb-12">
        <div className="w-32 h-32 flex-shrink-0 bg-zinc-50 rounded-2xl flex items-center justify-center border border-zinc-200 shadow-sm">
          <img 
            src={clubLogoSrc} 
            alt="Club" 
            className="w-24 h-24 object-contain" 
            crossOrigin="anonymous" 
          />
        </div>
        <div className="flex-1">
          <h1 className="text-4xl font-black uppercase tracking-tight text-zinc-900 leading-none mb-2">
            {fullName}
          </h1>
          <h2 className="text-xl font-bold uppercase text-zinc-500 tracking-wide mb-6">
            {clubName}
          </h2>
          <div className="flex gap-4">
            <div className="bg-zinc-900 text-white px-6 py-3 rounded-xl flex flex-col items-center min-w-[100px] shadow-md">
              <span className="text-3xl font-black">{stats.overall}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">OVR</span>
            </div>
            <div className="bg-zinc-100 text-zinc-900 px-6 py-3 rounded-xl flex flex-col items-center min-w-[100px] border border-zinc-200 shadow-sm">
              <span className="text-3xl font-black">{positionShort}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">POS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Season Stats */}
      <div className="mb-10">
        <h3 className="text-lg font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-2 mb-6">Saisonstatistik</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-200 flex flex-col items-center shadow-sm">
            <span className="text-4xl font-black text-zinc-800 mb-1">{seasonStats.games}</span>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Spiele</span>
          </div>
          <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-200 flex flex-col items-center shadow-sm">
            <span className="text-4xl font-black text-zinc-800 mb-1">{seasonStats.goals}</span>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Tore</span>
          </div>
          <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-200 flex flex-col items-center shadow-sm">
            <span className="text-4xl font-black text-zinc-800 mb-1">{seasonStats.assists}</span>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Assists</span>
          </div>
          <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-200 flex flex-col items-center shadow-sm">
            <span className="text-4xl font-black text-amber-500 mb-1">{seasonStats.yellowCards}</span>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Gelb</span>
          </div>
          <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-200 flex flex-col items-center shadow-sm">
            <span className="text-4xl font-black text-red-500 mb-1">{seasonStats.redCards}</span>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Rot</span>
          </div>
          <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-200 flex flex-col items-center shadow-sm">
            <span className="text-4xl font-black text-emerald-600 mb-1">{seasonStats.mvps}</span>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">MVPs</span>
          </div>
        </div>
      </div>

      {/* Attributes */}
      <div>
        <h3 className="text-lg font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-2 mb-6">Aktuelle Attribute</h3>
        <div className="grid grid-cols-6 gap-3">
          <div className="bg-zinc-100 py-4 px-2 rounded-lg border border-zinc-200 flex flex-col items-center shadow-sm">
            <span className="text-2xl font-black text-zinc-800">{stats.tem}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">TEM</span>
          </div>
          <div className="bg-zinc-100 py-4 px-2 rounded-lg border border-zinc-200 flex flex-col items-center shadow-sm">
            <span className="text-2xl font-black text-zinc-800">{stats.sch}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">SCH</span>
          </div>
          <div className="bg-zinc-100 py-4 px-2 rounded-lg border border-zinc-200 flex flex-col items-center shadow-sm">
            <span className="text-2xl font-black text-zinc-800">{stats.pas}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">PAS</span>
          </div>
          <div className="bg-zinc-100 py-4 px-2 rounded-lg border border-zinc-200 flex flex-col items-center shadow-sm">
            <span className="text-2xl font-black text-zinc-800">{stats.dri}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">DRI</span>
          </div>
          <div className="bg-zinc-100 py-4 px-2 rounded-lg border border-zinc-200 flex flex-col items-center shadow-sm">
            <span className="text-2xl font-black text-zinc-800">{stats.def}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">DEF</span>
          </div>
          <div className="bg-zinc-100 py-4 px-2 rounded-lg border border-zinc-200 flex flex-col items-center shadow-sm">
            <span className="text-2xl font-black text-zinc-800">{stats.phy}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">PHY</span>
          </div>
        </div>
      </div>

      {/* Footer text */}
      <div className="absolute bottom-12 left-0 right-0 text-center">
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
          Generiert von PLYRZ &bull; offizielle Spielerstatistiken
        </p>
      </div>
    </div>
  );
});
