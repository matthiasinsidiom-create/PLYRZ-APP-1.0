import React from 'react';

interface PlayerCardProps {
  type: 'bronze' | 'silver' | 'gold';
  overall: number;
  position: string;
  name: string;
  stats: {
    tem: number;
    sch: number;
    pas: number;
    dri: number;
    def: number;
    phy: number;
  };
}

const styles: { [key: string]: React.CSSProperties } = {
  screen: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f0f0f0',
    minHeight: '100vh',
    width: '100%',
  },
  scrollContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 0',
    overflowY: 'auto',
  },
  cardContainer: {
    width: '280px',
    height: '410px',
    marginBottom: '30px',
    position: 'relative',
    fontFamily: '"Inter", sans-serif',
    userSelect: 'none',
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
  },
  overall: {
    position: 'absolute',
    left: '18%',
    top: '8%',
    fontSize: '52px',
    fontWeight: '900',
    color: '#ffffff',
    zIndex: 10,
    lineHeight: '1',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
  },
  position: {
    position: 'absolute',
    left: '18%',
    top: '18%',
    fontSize: '24px',
    fontWeight: '900',
    color: '#ffffff',
    zIndex: 10,
    textTransform: 'uppercase',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
  },
  flag: {
    position: 'absolute',
    left: '18%',
    top: '28%',
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
    left: '18%',
    top: '38%',
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
    left: '50%',
    transform: 'translateX(-50%)',
    top: '5%',
    width: '95%',
    height: 'auto',
    objectFit: 'contain',
    objectPosition: 'bottom',
    zIndex: 5,
    display: 'block',
    pointerEvents: 'none',
  },
  nameContainer: {
    position: 'absolute',
    top: '53%',
    width: '100%',
    height: '45px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  name: {
    fontSize: '28px',
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
    textAlign: 'center',
  },
  statsContainer: {
    position: 'absolute',
    top: '66%',
    width: '100%',
    zIndex: 15,
  },
  statsColumnLeft: {
    position: 'absolute',
    left: '20%',
    top: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  statsColumnRight: {
    position: 'absolute',
    left: '55%',
    top: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  statText: {
    fontSize: '24px',
    fontWeight: '900',
    color: '#ffffff',
    margin: '0px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    height: '32px',
  },
};

export const PlayerCard = ({ type, overall, position, name, stats }: PlayerCardProps) => {
  const getFrame = () => {
    switch (type) {
      case 'bronze': return '/assets/cards/bronze.png';
      case 'silver': return '/assets/cards/silver.png';
      case 'gold': return '/assets/cards/gold.png';
      default: return '/assets/cards/gold.png';
    }
  };

  return (
    <div style={styles.cardContainer}>
      <img src={getFrame()} style={styles.frame} alt="Card Frame" />
      
      <div style={styles.overall}>{overall}</div>
      <div style={styles.position}>{position}</div>
      
      <img src="/assets/flags/de.png" style={styles.flag} alt="Flag" />
      <img src="/assets/clubs/rw.png" style={styles.club} alt="Club" />
      
      <img src="/assets/players/mueller.png" style={styles.playerImage} alt="Player" />
      
      <div style={styles.nameContainer}>
        <div style={styles.name}>{name.toUpperCase()}</div>
      </div>
      
      <div style={styles.statsContainer}>
        <div style={styles.statsColumnLeft}>
          <div style={styles.statText}>
            <span>{stats.tem}</span>
            <span style={{ fontSize: '16px', opacity: 0.9 }}>TEM</span>
          </div>
          <div style={styles.statText}>
            <span>{stats.sch}</span>
            <span style={{ fontSize: '16px', opacity: 0.9 }}>SCH</span>
          </div>
          <div style={styles.statText}>
            <span>{stats.pas}</span>
            <span style={{ fontSize: '16px', opacity: 0.9 }}>PAS</span>
          </div>
        </div>
        <div style={styles.statsColumnRight}>
          <div style={styles.statText}>
            <span>{stats.dri}</span>
            <span style={{ fontSize: '16px', opacity: 0.9 }}>DRI</span>
          </div>
          <div style={styles.statText}>
            <span>{stats.def}</span>
            <span style={{ fontSize: '16px', opacity: 0.9 }}>DEF</span>
          </div>
          <div style={styles.statText}>
            <span>{stats.phy}</span>
            <span style={{ fontSize: '16px', opacity: 0.9 }}>PHY</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PlayerCardTestScreen = () => {
  return (
    <div style={styles.screen}>
      <div style={styles.scrollContent}>
        <PlayerCard 
          type="gold"
          overall={91}
          position="ST"
          name="Müller"
          stats={{ tem: 84, sch: 92, pas: 82, dri: 86, def: 45, phy: 78 }}
        />
        <PlayerCard 
          type="silver"
          overall={78}
          position="ST"
          name="Müller"
          stats={{ tem: 72, sch: 78, pas: 70, dri: 74, def: 38, phy: 68 }}
        />
        <PlayerCard 
          type="bronze"
          overall={64}
          position="ST"
          name="Müller"
          stats={{ tem: 60, sch: 64, pas: 58, dri: 62, def: 32, phy: 58 }}
        />
      </div>
    </div>
  );
};
