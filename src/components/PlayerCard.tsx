import React from 'react';
import { Player } from '../types';
import { resolveLatestStats } from '../lib/stats';
import { Check, ShieldCheck, Crown } from 'lucide-react';
import { getPositionShort } from '../lib/positions';

interface PlayerCardProps {
  player: Player;
  clubLogo?: string;
  className?: string;
  forceTier?: 'bronze' | 'silver' | 'gold';
  jerseyNumber?: number | null;
  lineupRole?: 'starter' | 'sub';
  isTopPerformer?: boolean;
  onClick?: () => void;
}

const styles: { [key: string]: React.CSSProperties } = {
  cardContainer: {
    width: '350px',
    height: '490px',
    aspectRatio: '0.71',
    position: 'relative',
    userSelect: 'none',
    overflow: 'visible',
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
  jerseyNumberBadge: {
    position: 'absolute',
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    backdropFilter: 'blur(12px)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  jerseyNumberText: {
    color: '#ffffff',
    fontSize: '20px',
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: '-0.02em',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
    lineHeight: '1',
    display: 'block',
    marginTop: '1px',
  },
  roleBadge: {
    position: 'absolute',
    bottom: '-48px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 24px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    zIndex: 50,
    boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
    fontStyle: 'italic',
    whiteSpace: 'nowrap',
    border: '2px solid rgba(255,255,255,0.2)',
  },
  starterBadge: {
    backgroundColor: '#10b981', // emerald-500
    color: '#000000',
  },
  subBadge: {
    backgroundColor: '#fbbf24', // amber-400
    color: '#000000',
  },
  badgesContainer: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    display: 'flex',
    flexDirection: 'row',
    gap: '6px',
    zIndex: 30,
  } as React.CSSProperties,
  iconBadge: {
    width: '28px',
    height: '28px',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(8px)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  } as React.CSSProperties,
};

export const PlayerCard = React.memo(({ 
  player, 
  clubLogo, 
  forceTier, 
  className, 
  jerseyNumber, 
  lineupRole, 
  isTopPerformer,
  onClick 
}: PlayerCardProps) => {
  // Use the new consistent stats resolver, prioritizing already resolved stats
  const stats = player.current_stats || resolveLatestStats(player);

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
      statsLeft: { x: 28, y: 74, fontSize: 21, ...defaultColor },
      statsRight: { x: 72, y: 74, fontSize: 21, ...defaultColor },
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
      case 'bronze': return 'https://upvzomofjjwaxkfogpuc.supabase.co/storage/v1/object/public/assets/cards/bronze.png';
      case 'silver': return 'https://upvzomofjjwaxkfogpuc.supabase.co/storage/v1/object/public/assets/cards/silver.png';
      case 'gold': return 'https://upvzomofjjwaxkfogpuc.supabase.co/storage/v1/object/public/assets/cards/gold.png';
      default: return 'https://upvzomofjjwaxkfogpuc.supabase.co/storage/v1/object/public/assets/cards/gold.png';
    }
  };

  const tier = getTier();
  const frameSrc = getFrameSrc(tier);

  // Tier-specific styling for the jersey number badge
  const getBadgeTierStyle = (tier: string): React.CSSProperties => {
    switch (tier) {
      case 'gold':
        return {
          backgroundColor: 'rgba(20, 15, 0, 0.85)',
          border: '1.5px solid rgba(255, 215, 0, 0.4)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5), 0 0 15px rgba(255, 215, 0, 0.1)',
        };
      case 'silver':
        return {
          backgroundColor: 'rgba(15, 15, 15, 0.85)',
          border: '1.5px solid rgba(192, 192, 192, 0.4)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5), 0 0 15px rgba(192, 192, 192, 0.1)',
        };
      case 'bronze':
      default:
        return {
          backgroundColor: 'rgba(15, 10, 5, 0.85)',
          border: '1.5px solid rgba(205, 127, 50, 0.4)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5), 0 0 15px rgba(205, 127, 50, 0.1)',
        };
    }
  };

  const fullName = player.full_name || 'Unbekannt';
  const lastName = fullName.split(' ').pop() || fullName;
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
      onClick={onClick}
    >
      {/* BASE LAYER: FRAME */}
      <img
        src={frameSrc}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        style={{
          ...styles.frame,
          width: `${100 * frameScale}%`,
          height: `${100 * frameScale}%`,
          transform: 'translate(-50%, -50%)',
          position: 'absolute',
          left: `${50 + frameX}%`,
          top: `${50 + frameY}%`,
          objectFit: 'fill',
          filter: (player.is_premium && (!player.premium_until || new Date(player.premium_until).getTime() + 86400000 > Date.now()))
            ? 'drop-shadow(0 0 20px rgba(251, 191, 36, 0.5)) drop-shadow(0 0 40px rgba(251, 191, 36, 0.2))'
            : 'none',
        }} 
        alt={`${tier} card frame`} 
      />

      {/* PREMIUM SHINE OVERLAY */}
      {player.is_premium && (!player.premium_until || new Date(player.premium_until).getTime() + 86400000 > Date.now()) && (
        <div 
          className="absolute inset-0 pointer-events-none z-20 opacity-40 mix-blend-screen"
          style={{
            background: 'linear-gradient(125deg, transparent 0%, transparent 40%, rgba(255, 230, 100, 0.4) 45%, rgba(255, 255, 255, 0.6) 50%, rgba(255, 230, 100, 0.4) 55%, transparent 60%, transparent 100%)',
            backgroundSize: '200% 200%',
            animation: 'shine 6s ease-in-out infinite',
            WebkitMaskImage: `url(${frameSrc})`,
            WebkitMaskSize: `${100 * frameScale}% ${100 * frameScale}%`,
            WebkitMaskPosition: `${50 + frameX}% ${50 + frameY}%`,
            WebkitMaskRepeat: 'no-repeat'
          }}
        />
      )}
      
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
        {getPositionShort(player.position)}
      </div>

      {/* JERSEY NUMBER & ROLE */}
      {jerseyNumber !== undefined && jerseyNumber !== null && (
        <div style={{
          ...styles.jerseyNumberBadge,
          ...getBadgeTierStyle(tier),
          // Special positioning for Top Performer to avoid collision with growth badge
          top: isTopPerformer ? '68px' : '28px',
          right: isTopPerformer ? '24px' : '28px',
        }}>
          <span style={styles.jerseyNumberText}>#{jerseyNumber}</span>
        </div>
      )}
      
      {/* BADGES CONTAINER */}
      <div style={styles.badgesContainer}>
        {/* PREMIUM BADGE */}
        {player.is_premium && (!player.premium_until || new Date(player.premium_until).getTime() + 86400000 > Date.now()) && (
          <div 
            style={styles.iconBadge} 
            title="Premium"
            aria-label="Premium"
          >
            <Crown className="w-4 h-4 text-amber-400" strokeWidth={2.5} />
          </div>
        )}
        
        {/* CLAIMED BADGE */}
        {player.claimed_by_user_id && (
          <div 
            style={styles.iconBadge} 
            title="Beansprucht"
            aria-label="Beansprucht"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" strokeWidth={2.5} />
          </div>
        )}
      </div>

      {lineupRole && (
        <div style={{
          ...styles.roleBadge,
          ...(lineupRole === 'starter' ? styles.starterBadge : styles.subBadge)
        }}>
          {lineupRole === 'starter' ? 'STARTELF' : 'RESERVE'}
        </div>
      )}
      
      {/* NATIONALITY & CLUB */}
      <img 
        src={flagSrc} 
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
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
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
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
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
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
});

