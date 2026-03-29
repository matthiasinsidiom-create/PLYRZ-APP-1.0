import React from 'react';
import { Player } from '../types';
import { resolveLatestStats } from '../lib/stats';

interface PlayerCardProps {
  player: Player;
  clubLogo?: string;
  className?: string;
  forceTier?: 'bronze' | 'silver' | 'gold';
  shirtNumber?: number | null;
  lineupRole?: 'starter' | 'sub';
  onClick?: () => void;
}

const styles: { [key: string]: React.CSSProperties } = {
  cardContainer: {
    width: '350px',
    height: '490px',
    aspectRatio: '0.71',
    position: 'relative',
    fontFamily: '"Inter", sans-serif',
    userSelect: 'none',
    overflow: 'hidden',
  },
  frame: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
    display: 'block',
    pointerEvents: 'none',
    objectFit: 'contain',
  },
  overall: {
    position: 'absolute',
    fontWeight: '900',
    color: '#ffffff',
    zIndex: 10,
    lineHeight: '1',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
  },
  position: {
    position: 'absolute',
    fontWeight: '900',
    color: '#ffffff',
    zIndex: 10,
    textTransform: 'uppercase',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
  },
  flag: {
    position: 'absolute',
    width: '52px',
    height: 'auto',
    objectFit: 'cover',
    zIndex: 10,
    display: 'block',
    pointerEvents: 'none',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  club: {
    position: 'absolute',
    width: '56px',
    height: 'auto',
    objectFit: 'contain',
    zIndex: 10,
    display: 'block',
    pointerEvents: 'none',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
  },
  playerImage: {
    position: 'absolute',
    transform: 'translateX(-50%)',
    objectFit: 'contain',
    objectPosition: 'bottom',
    zIndex: 5,
    display: 'block',
    pointerEvents: 'none',
  },
  nameContainer: {
    position: 'absolute',
    width: '100%',
    height: '45px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  name: {
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
    textAlign: 'center',
  },
  statsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 15,
  },
  statsColumnLeft: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    transform: 'translateX(-50%)',
  },
  statsColumnRight: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    transform: 'translateX(-50%)',
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    justifyContent: 'center',
  },
  statValue: {
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: '1',
  },
  statLabel: {
    fontWeight: '700',
    color: '#ffffff',
    opacity: 0.9,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  shirtNumberBadge: {
    position: 'absolute',
    top: '15px',
    right: '15px',
    width: '42px',
    height: '42px',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    zIndex: 20,
    backdropFilter: 'blur(12px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  },
  shirtNumberText: {
    color: '#ffffff',
    fontSize: '18px',
    fontWeight: '900',
    fontFamily: '"Inter", sans-serif',
    fontStyle: 'italic',
    letterSpacing: '-0.05em',
  },
  roleBadge: {
    position: 'absolute',
    bottom: '100px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '4px 16px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    zIndex: 20,
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    fontStyle: 'italic',
  },
  starterBadge: {
    backgroundColor: '#10b981', // emerald-500
    color: '#000000',
  },
  subBadge: {
    backgroundColor: '#fbbf24', // amber-400
    color: '#000000',
  },
};

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, clubLogo, forceTier, className, shirtNumber, lineupRole, onClick }) => {
  // Use the new consistent stats resolver, prioritizing already resolved stats
  const stats = player.current_stats || resolveLatestStats(player);

  // Debug log to see what stats are being used for this player
  console.log(`DEBUG: [UI] PlayerCard for ${player.full_name} using stats:`, stats);

  const [showDebug, setShowDebug] = React.useState(false);

  function getTier() {
    if (forceTier) return forceTier;
    const ovr = typeof stats.overall === 'string' ? parseInt(stats.overall) : stats.overall;
    if (ovr >= 75) return 'gold';
    if (ovr >= 65) return 'silver';
    return 'bronze';
  }

  const layout = (() => {
    const rawLayout = player.card_layout || {};
    const tier = getTier();
    
    // Define absolute defaults
    const defaultColor = {
      mode: 'solid',
      color: '#ffffff',
      gradientStart: '#ffffff',
      gradientEnd: '#cccccc',
      gradientDirection: 'vertical'
    };

    const defaults = {
      overall: { x: 18, y: 8, fontSize: 60, ...defaultColor },
      position: { x: 18, y: 18, fontSize: 28, ...defaultColor },
      flag: { x: 18, y: 28, width: 60, height: 36 },
      club: { x: 18, y: 38, width: 64, height: 64 },
      player: { x: 50, y: 5, scale: 0.95 },
      name: { x: 50, y: 53, fontSize: 32, ...defaultColor },
      statsLeft: { x: 24, y: 74, fontSize: 21, ...defaultColor },
      statsRight: { x: 58, y: 74, fontSize: 21, ...defaultColor },
      card: { scale: 1, x: 0, y: 0 },
      frame: { scale: 1, x: 0, y: 0 }
    };

    // Determine source: tiered or flat
    const isMultiTier = !!(rawLayout.bronze || rawLayout.silver || rawLayout.gold);
    const tierSource = isMultiTier ? (rawLayout[tier] || {}) : rawLayout;
    
    // Deep merge with defaults to ensure all keys and sub-keys exist
    const merged: any = {};
    Object.keys(defaults).forEach(key => {
      const elementDefaults = (defaults as any)[key];
      const elementSource = tierSource[key] || {};
      merged[key] = { ...elementDefaults, ...elementSource };
    });
    
    return merged;
  })();

  const frameScale = layout.frame?.scale || 1;
  const frameX = layout.frame?.x || 0;
  const frameY = layout.frame?.y || 0;
  const baseWidth = 350;
  const baseHeight = 490;

  const dynamicCardStyle: React.CSSProperties = {
    ...styles.cardContainer,
    width: `${baseWidth}px`,
    height: `${baseHeight}px`,
  };

  const getFrameSrc = (tier: string) => {
    switch (tier) {
      case 'bronze': return '/assets/cards/bronze.png';
      case 'silver': return '/assets/cards/silver.png';
      case 'gold': return '/assets/cards/gold.png';
      default: return '/assets/cards/gold.png';
    }
  };

  const tier = getTier();
  const frameSrc = getFrameSrc(tier);
  const lastName = player.full_name.split(' ').pop() || player.full_name;
  const displayName = lastName;
  
  // Use nationality flag from flagcdn
  const flagCode = (player.nationality || 'de').toLowerCase();
  const flagSrc = `https://flagcdn.com/w80/${flagCode}.png`;
  
  // Use club logo from props or relation
  const clubLogoSrc = clubLogo || player.teams?.clubs?.logo_url || "/assets/clubs/rw.png";

  const getTextStyle = (config: any): React.CSSProperties => {
    if (!config) return {};
    
    if (config.mode === 'gradient') {
      let direction = 'to bottom';
      if (config.gradientDirection === 'horizontal') direction = 'to right';
      if (config.gradientDirection === 'diagonal') direction = 'to bottom right';
      
      return {
        background: `linear-gradient(${direction}, ${config.gradientStart || '#ffffff'}, ${config.gradientEnd || '#cccccc'})`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        color: 'transparent',
      };
    }
    
    return {
      color: config.color || '#ffffff',
    };
  };

  return (
    <div 
      style={dynamicCardStyle} 
      className={`relative group ${className || ''} ${onClick ? 'cursor-pointer active:scale-95 transition-transform duration-200' : ''}`}
      onMouseEnter={() => setShowDebug(true)}
      onMouseLeave={() => setShowDebug(false)}
      onClick={onClick}
    >
      {/* DEBUG OVERLAY - ALWAYS VISIBLE AT BOTTOM, EXPANDS ON HOVER */}
      <div className={`absolute bottom-0 left-0 right-0 z-[100] bg-black/95 border-t border-emerald-500/50 p-2 text-[8px] font-mono text-emerald-400 transition-all duration-300 ${showDebug ? 'max-h-[300px] opacity-100 overflow-auto' : 'max-h-[40px] opacity-80 overflow-hidden'}`}>
        <div className="flex justify-between items-center border-b border-emerald-500/20 mb-1 pb-1">
          <span className="font-bold uppercase tracking-widest">DEBUG: {player.full_name}</span>
          <span className="text-zinc-500">ID: {player.id?.slice(0, 8)}...</span>
        </div>
        
        <div className="flex gap-2 mb-1">
          <span className="text-emerald-500 font-bold">FINAL:</span>
          <span>OVR:{stats.overall}</span>
          <span>T:{stats.tem}</span>
          <span>S:{stats.sch}</span>
          <span>P:{stats.pas}</span>
          <span>D:{stats.dri}</span>
          <span>DF:{stats.def}</span>
          <span>PH:{stats.phy}</span>
        </div>

        {showDebug && (
          <>
            <div className="mt-2 text-zinc-400 uppercase font-bold text-[7px]">Raw Stats Rows: {player.player_stats?.length || 0}</div>
            <div className="space-y-1 mt-1">
              {(Array.isArray(player.player_stats) ? player.player_stats : []).slice().sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()).map((s, i) => (
                <div key={i} className={`p-1 rounded ${i === 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-zinc-900/50'}`}>
                  <div className="flex justify-between">
                    <span className={i === 0 ? 'text-emerald-300' : 'text-zinc-500'}>Row {i+1} {i === 0 ? '(LATEST)' : ''}</span>
                    <span className="text-zinc-600">{new Date(s.updated_at || 0).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-x-1 mt-0.5">
                    <span>OVR:{s.overall}</span>
                    <span>T:{s.tem}</span>
                    <span>S:{s.sch}</span>
                    <span>P:{s.pas}</span>
                    <span>D:{s.dri}</span>
                    <span>DF:{s.def}</span>
                    <span>PH:{s.phy}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-zinc-500 italic text-[7px]">Source: {player.current_stats ? 'current_stats (pre-resolved)' : 'resolved (on-the-fly)'}</div>
          </>
        )}
      </div>

      {/* BASE LAYER: FRAME */}
      <img 
        src={frameSrc} 
        style={{
          ...styles.frame,
          width: `${100 * frameScale}%`,
          height: `${100 * frameScale}%`,
          transform: 'translate(-50%, -50%)',
          position: 'absolute',
          left: `${50 + frameX}%`,
          top: `${50 + frameY}%`,
        }} 
        alt={`${tier} card frame`} 
      />
      
      {/* OVERALL & POSITION */}
      <div style={{ 
        ...styles.overall, 
        left: `${layout.overall.x}%`, 
        top: `${layout.overall.y}%`,
        fontSize: `${layout.overall.fontSize || 52}px`,
        ...getTextStyle(layout.overall)
      }}>
        {stats.overall}
      </div>
      <div style={{ 
        ...styles.position, 
        left: `${layout.position.x}%`, 
        top: `${layout.position.y}%`,
        fontSize: `${layout.position.fontSize || 24}px`,
        ...getTextStyle(layout.position)
      }}>
        {player.position || 'ST'}
      </div>

      {/* SHIRT NUMBER & ROLE */}
      {shirtNumber !== undefined && shirtNumber !== null && (
        <div style={styles.shirtNumberBadge}>
          <span style={styles.shirtNumberText}>#{shirtNumber}</span>
        </div>
      )}
      {lineupRole && (
        <div style={{
          ...styles.roleBadge,
          ...(lineupRole === 'starter' ? styles.starterBadge : styles.subBadge)
        }}>
          {lineupRole === 'starter' ? 'STARTER' : 'SUBSTITUTE'}
        </div>
      )}
      
      {/* NATIONALITY & CLUB */}
      <img 
        src={flagSrc} 
        style={{ 
          ...styles.flag, 
          left: `${layout.flag.x}%`, 
          top: `${layout.flag.y}%`,
          width: `${layout.flag.width || 52}px`,
          height: layout.flag.height ? `${layout.flag.height}px` : 'auto'
        }} 
        alt="Nationality" 
      />
      <img 
        src={clubLogoSrc} 
        style={{ 
          ...styles.club, 
          left: `${layout.club.width ? layout.club.x : layout.club.x}%`, 
          top: `${layout.club.y}%`,
          width: `${layout.club.width || 56}px`,
          height: layout.club.height ? `${layout.club.height}px` : 'auto'
        }} 
        alt="Club" 
      />
      
      {/* PLAYER IMAGE */}
      <img 
        src={player.photo_url || "/assets/players/mueller.png"} 
        style={{ 
          ...styles.playerImage, 
          left: `${layout.player.x}%`, 
          top: `${layout.player.y}%`,
          width: `${(layout.player.scale || 0.95) * 100}%`
        }} 
        alt={player.full_name} 
      />
      
      {/* NAME BANNER */}
      <div style={{ ...styles.nameContainer, top: `${layout.name.y}%`, left: `${layout.name.x - 50}%` }}>
        <div style={{ 
          ...styles.name,
          fontSize: `${layout.name.fontSize || 28}px`,
          ...getTextStyle(layout.name)
        }}>
          {displayName}
        </div>
      </div>
      
      {/* STATS SECTION */}
      <div style={styles.statsContainer}>
        <div style={{ ...styles.statsColumnLeft, left: `${layout.statsLeft.x}%`, top: `${layout.statsLeft.y}%` }}>
          <div style={styles.statRow}>
            <span style={{ ...styles.statValue, fontSize: `${layout.statsLeft.fontSize || 18}px`, ...getTextStyle(layout.statsLeft) }}>{stats.tem}</span>
            <span style={{ ...styles.statLabel, fontSize: `${(layout.statsLeft.fontSize || 18) * 0.7}px`, ...getTextStyle(layout.statsLeft) }}>TEM</span>
          </div>
          <div style={styles.statRow}>
            <span style={{ ...styles.statValue, fontSize: `${layout.statsLeft.fontSize || 18}px`, ...getTextStyle(layout.statsLeft) }}>{stats.sch}</span>
            <span style={{ ...styles.statLabel, fontSize: `${(layout.statsLeft.fontSize || 18) * 0.7}px`, ...getTextStyle(layout.statsLeft) }}>SCH</span>
          </div>
          <div style={styles.statRow}>
            <span style={{ ...styles.statValue, fontSize: `${layout.statsLeft.fontSize || 18}px`, ...getTextStyle(layout.statsLeft) }}>{stats.pas}</span>
            <span style={{ ...styles.statLabel, fontSize: `${(layout.statsLeft.fontSize || 18) * 0.7}px`, ...getTextStyle(layout.statsLeft) }}>PAS</span>
          </div>
        </div>
        <div style={{ ...styles.statsColumnRight, left: `${layout.statsRight.x}%`, top: `${layout.statsRight.y}%` }}>
          <div style={styles.statRow}>
            <span style={{ ...styles.statValue, fontSize: `${layout.statsRight.fontSize || 18}px`, ...getTextStyle(layout.statsRight) }}>{stats.dri}</span>
            <span style={{ ...styles.statLabel, fontSize: `${(layout.statsRight.fontSize || 18) * 0.7}px`, ...getTextStyle(layout.statsRight) }}>DRI</span>
          </div>
          <div style={styles.statRow}>
            <span style={{ ...styles.statValue, fontSize: `${layout.statsRight.fontSize || 18}px`, ...getTextStyle(layout.statsRight) }}>{stats.def}</span>
            <span style={{ ...styles.statLabel, fontSize: `${(layout.statsRight.fontSize || 18) * 0.7}px`, ...getTextStyle(layout.statsRight) }}>DEF</span>
          </div>
          <div style={styles.statRow}>
            <span style={{ ...styles.statValue, fontSize: `${layout.statsRight.fontSize || 18}px`, ...getTextStyle(layout.statsRight) }}>{stats.phy}</span>
            <span style={{ ...styles.statLabel, fontSize: `${(layout.statsRight.fontSize || 18) * 0.7}px`, ...getTextStyle(layout.statsRight) }}>PHY</span>
          </div>
        </div>
      </div>
    </div>
  );
};

