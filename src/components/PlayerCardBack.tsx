import React from 'react';
import { Player } from '../types';
import { resolveLatestStats } from '../lib/stats';
import { getPositionShort } from '../lib/positions';
import { QrCode, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PlayerCardBackProps {
  player: Player;
  clubLogo?: string;
  className?: string;
  forceTier?: 'bronze' | 'silver' | 'gold';
}

const styles: { [key: string]: React.CSSProperties } = {
  cardContainer: {
    width: '350px',
    height: '490px',
    aspectRatio: '0.71',
    position: 'relative',
    userSelect: 'none',
    overflow: 'visible',
    fontFamily: '"Inter", sans-serif',
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
  contentContainer: {
    position: 'absolute',
    top: '12%',
    left: '12%',
    width: '76%',
    height: '76%',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    color: '#fff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  logoPlaceholder: {
    fontSize: '20px',
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: '-1px',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
  },
  season: {
    fontSize: '10px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: 'rgba(255,255,255,0.7)',
  },
  playerInfoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
    padding: '8px',
    backgroundColor: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  clubLogo: {
    width: '40px',
    height: '40px',
    objectFit: 'contain',
  },
  playerDetails: {
    flex: 1,
  },
  name: {
    fontSize: '16px',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    lineHeight: '1.1',
  },
  clubName: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '2px',
  },
  positionAndOverall: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  overall: {
    fontSize: '24px',
    fontWeight: '900',
    lineHeight: '1',
  },
  position: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: '6px',
    marginBottom: '16px',
  },
  statBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '6px 8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: '9px',
    fontWeight: '600',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  statValue: {
    fontSize: '14px',
    fontWeight: '800',
  },
  footer: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  qrContainer: {
    width: '80px',
    height: '80px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '8px',
  },
  footerText: {
    fontSize: '9px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    maxWidth: '200px',
  }
};

export const PlayerCardBack = React.memo(({
  player,
  clubLogo,
  forceTier,
  className
}: PlayerCardBackProps) => {
  const stats = player.current_stats || resolveLatestStats(player);

  function getTier() {
    if (forceTier) return forceTier;
    const ovr = typeof stats.overall === 'string' ? parseInt(stats.overall) : stats.overall;
    if (ovr >= 75) return 'gold';
    if (ovr >= 65) return 'silver';
    return 'bronze';
  }

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
  const clubLogoSrc = clubLogo || player.teams?.clubs?.logo_url || "/assets/clubs/rw.png";
  const fullName = player.full_name || 'Unbekannt';

  // These should ideally come from aggregated data.
  // We mock them if they are not provided directly on the player object for now.
  const aggregatedStats = {
    games: 0,
    goals: 0,
    assists: 0,
    mvps: 0,
    yellowCards: 0,
    redCards: 0,
    ratingChange: '+2' // Placeholder trend
  };

  const getTextColorForTier = (tier: string) => {
    switch (tier) {
      case 'gold': return '#FFD700';
      case 'silver': return '#C0C0C0';
      default: return '#CD7F32';
    }
  };

  return (
    <div style={styles.cardContainer} className={`relative ${className || ''}`}>
      {/* FRAME */}
      <img
        src={frameSrc}
        style={{
          ...styles.frame,
          objectFit: 'contain'
        }}
        alt={`${tier} card back`}
      />

      {/* CONTENT */}
      <div style={styles.contentContainer}>
        
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoPlaceholder}>PLYRZ</div>
          <div style={styles.season}>Saison 2025/26</div>
        </div>

        {/* Player Profile Bar */}
        <div style={styles.playerInfoBox}>
          <img 
            src={clubLogoSrc} 
            alt="Club" 
            style={styles.clubLogo} 
            crossOrigin="anonymous" 
          />
          <div style={styles.playerDetails}>
            <div style={styles.name}>{fullName}</div>
            <div style={styles.clubName}>{player.teams?.name || player.teams?.clubs?.name || 'Unbekannt'}</div>
          </div>
          <div style={styles.positionAndOverall}>
            <div style={{ ...styles.overall, color: getTextColorForTier(tier) }}>{stats.overall}</div>
            <div style={styles.position}>{getPositionShort(player.position)}</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={styles.statsGrid}>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Spiele</span>
            <span style={styles.statValue}>{aggregatedStats.games}</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Tore</span>
            <span style={styles.statValue}>{aggregatedStats.goals}</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Assists</span>
            <span style={styles.statValue}>{aggregatedStats.assists}</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>MVPs</span>
            <span style={styles.statValue}>{aggregatedStats.mvps}</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Gelb</span>
            <span style={{ ...styles.statValue, color: '#fbbf24' }}>{aggregatedStats.yellowCards}</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Rot</span>
            <span style={{ ...styles.statValue, color: '#ef4444' }}>{aggregatedStats.redCards}</span>
          </div>
        </div>

        {/* Rating Trend (Full Width) */}
        <div style={{ ...styles.statBox, padding: '10px 12px' }}>
          <span style={styles.statLabel}>Rating Trend</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={16} color="#10b981" />
            <span style={{ ...styles.statValue, color: '#10b981' }}>{aggregatedStats.ratingChange}</span>
          </div>
        </div>

        {/* Footer Area with QR Code */}
        <div style={styles.footer}>
          <div style={styles.qrContainer}>
            <QrCode size={64} color="#000" />
          </div>
          <div style={styles.footerText}>
            Scanne die Karte und verfolge meine Saison
          </div>
        </div>

      </div>
    </div>
  );
});
