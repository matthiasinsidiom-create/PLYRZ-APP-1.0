import React from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Player } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ==================================================
// 1. TIER DEFINITIONS & STYLES
// ==================================================
type CardTier = 'bronze' | 'silver' | 'gold';

interface TierStyle {
  bgGradient: string;
  borderColor: string;
  textColor: string;
  bannerBg: string;
  statsDivider: string;
  glowColor: string;
  shineOpacity: string;
  textureOpacity: string;
}

/**
 * BRONZE STYLE DEFINITION
 */
const BRONZE_STYLE: TierStyle = {
  bgGradient: 'from-[#5d3a1a] via-[#8b4513] to-[#2d1a0a]',
  borderColor: 'border-[#8b4513]/40',
  textColor: 'text-[#f5e6d3]',
  bannerBg: 'bg-black/30',
  statsDivider: 'bg-[#f5e6d3]/15',
  glowColor: 'rgba(139,69,19,0.15)',
  shineOpacity: 'opacity-10',
  textureOpacity: 'opacity-20',
};

/**
 * SILVER STYLE DEFINITION
 */
const SILVER_STYLE: TierStyle = {
  bgGradient: 'from-[#3a3a3a] via-[#a0a0a0] to-[#1a1a1a]',
  borderColor: 'border-[#a0a0a0]/40',
  textColor: 'text-[#e8e8e8]',
  bannerBg: 'bg-black/30',
  statsDivider: 'bg-[#e8e8e8]/15',
  glowColor: 'rgba(160,160,160,0.15)',
  shineOpacity: 'opacity-15',
  textureOpacity: 'opacity-25',
};

/**
 * GOLD STYLE DEFINITION
 */
const GOLD_STYLE: TierStyle = {
  bgGradient: 'from-[#6c4d0f] via-[#d4af37] to-[#2a1f00]',
  borderColor: 'border-[#d4af37]/40',
  textColor: 'text-[#fff4d1]',
  bannerBg: 'bg-black/30',
  statsDivider: 'bg-[#fff4d1]/15',
  glowColor: 'rgba(212,175,55,0.25)',
  shineOpacity: 'opacity-25',
  textureOpacity: 'opacity-30',
};

const TIER_STYLES: Record<CardTier, TierStyle> = {
  bronze: BRONZE_STYLE,
  silver: SILVER_STYLE,
  gold: GOLD_STYLE,
};

const getCardTier = (overall: number): CardTier => {
  if (overall >= 75) return 'gold';
  if (overall >= 65) return 'silver';
  return 'bronze';
};

// ==================================================
// 2. SHARED LAYOUT COMPONENTS (GEOMETRY)
// ==================================================

/**
 * SHARED CARD SHIELD GEOMETRY
 * Defines the silhouette and physical frame.
 */
const CardShield: React.FC<{ children: React.ReactNode; style: TierStyle; className?: string }> = ({ children, style, className }) => (
  <div 
    className={cn(
      "relative w-full h-full overflow-hidden border-[3px] transition-all duration-500 clip-fut-shield bg-gradient-to-br",
      style.bgGradient,
      style.borderColor,
      className
    )}
    style={{ boxShadow: `0 0 40px ${style.glowColor}` }}
  >
    {children}
  </div>
);

/**
 * SHARED LAYOUT STRUCTURE
 * This component defines the exact positioning for all elements.
 * It is used identically by all tiers.
 */
const CardLayout: React.FC<{ 
  player: Player; 
  stats: any; 
  style: TierStyle; 
  clubLogo?: string;
}> = ({ player, stats, style, clubLogo }) => {
  const lastName = player.full_name.split(' ').pop() || player.full_name;

  return (
    <>
      {/* Layer 1: Background Texture */}
      <div className={cn("absolute inset-0 pointer-events-none mix-blend-overlay opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]", style.textureOpacity)} />
      
      {/* Layer 2: Shine Effect */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transform skew-x-12", 
        style.shineOpacity
      )} />

      {/* Layer 3: Top-Left Rating Area (Rating, Position, Flag, Club) */}
      <div className={cn("absolute top-7 left-4 flex flex-col items-center gap-0 z-30", style.textColor)}>
        <span className="text-[48px] font-black leading-none tracking-tighter drop-shadow-md">{stats.overall}</span>
        <span className="text-base font-bold uppercase tracking-widest leading-none mb-2">{player.position || 'N/A'}</span>
        
        <div className={cn("w-8 h-[1px] mb-2 opacity-30", style.statsDivider)} />
        
        <img 
          src={`https://flagcdn.com/w40/es.png`} 
          alt="Nationality"
          className="w-8 h-5 object-cover shadow-sm rounded-[1px] mb-2"
          referrerPolicy="no-referrer"
        />
        
        {clubLogo && (
          <img 
            src={clubLogo} 
            alt="Club"
            className="w-8 h-8 object-contain drop-shadow-lg"
            referrerPolicy="no-referrer"
          />
        )}
      </div>

      {/* Layer 4: Dominant Central Player Image */}
      <div className="absolute top-2 right-0 w-[92%] h-[75%] z-20 pointer-events-none overflow-hidden">
        <img 
          src={player.photo_url || `https://picsum.photos/seed/${lastName}/400/600`} 
          alt={lastName}
          className="w-full h-full object-contain object-bottom drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
          referrerPolicy="no-referrer"
          style={{
            maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)'
          }}
        />
      </div>

      {/* Layer 5: Lower-Middle Name Banner Area */}
      <div className="absolute bottom-[105px] left-0 w-full flex flex-col items-center z-30">
        <div className={cn("w-[75%] h-[1px] mb-2.5 opacity-30", style.statsDivider)} />
        <div className="relative w-full flex justify-center px-4">
          <div className={cn("absolute inset-0 h-8 top-1/2 -translate-y-1/2 mx-10 rounded-sm skew-x-[-10deg]", style.bannerBg)} />
          <h3 className={cn("relative text-[22px] font-black uppercase tracking-tight text-center leading-none drop-shadow-md", style.textColor)}>
            {lastName}
          </h3>
        </div>
      </div>

      {/* Layer 6: Bottom Stats Placement */}
      <div className={cn("absolute bottom-6 left-0 w-full px-8 grid grid-cols-2 gap-x-6 gap-y-1 z-30", style.textColor)}>
        <div className={cn("absolute top-[-10px] left-1/2 -translate-x-1/2 w-[75%] h-[1px] opacity-30", style.statsDivider)} />
        
        <StatItem label="TEM" value={stats.tem} />
        <StatItem label="DRI" value={stats.dri} />
        <StatItem label="SCH" value={stats.sch} />
        <StatItem label="DEF" value={stats.def} />
        <StatItem label="PAS" value={stats.pas} />
        <StatItem label="PHY" value={stats.phy} />
      </div>

      {/* Layer 7: Inner Frame Metallic Detail */}
      <div className={cn("absolute inset-0 pointer-events-none border-[1px] m-2 opacity-20 clip-fut-shield", style.borderColor)} />
      <div className={cn("absolute inset-0 pointer-events-none border-[1px] m-4 opacity-10 clip-fut-shield", style.borderColor)} />
    </>
  );
};

const StatItem: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-base font-black leading-none">{value}</span>
    <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</span>
  </div>
);

// ==================================================
// 3. MAIN PLAYERCARD COMPONENT
// ==================================================

interface PlayerCardProps {
  player: Player;
  clubLogo?: string;
  className?: string;
  forceTier?: CardTier; // For debug/preview
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, clubLogo, className, forceTier }) => {
  const stats = player.player_stats?.[0] || {
    overall: 50,
    tem: 50,
    sch: 50,
    pas: 50,
    dri: 50,
    def: 50,
    phy: 50
  };

  const tier = forceTier || getCardTier(stats.overall);
  const style = TIER_STYLES[tier];

  // Mouse tilt effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["12deg", "-12deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-12deg", "12deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn("relative w-64 h-96 flex flex-col font-sans cursor-pointer group perspective-1000", className)}
    >
      <CardShield style={style}>
        <CardLayout 
          player={player} 
          stats={stats} 
          style={style} 
          clubLogo={clubLogo} 
        />
      </CardShield>

      <style dangerouslySetInnerHTML={{ __html: `
        .clip-fut-shield {
          clip-path: polygon(
            0% 12%, 
            12% 0%, 
            88% 0%, 
            100% 12%, 
            100% 82%, 
            50% 100%, 
            0% 82%
          );
        }
        .perspective-1000 {
          perspective: 1000px;
        }
      `}} />
    </motion.div>
  );
};

