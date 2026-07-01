
export type PlayerPosition = 'Torwart' | 'Abwehr' | 'Mittelfeld' | 'Sturm';

export const POSITIONS: PlayerPosition[] = ['Torwart', 'Abwehr', 'Mittelfeld', 'Sturm'];

export const POSITION_MAP: Record<string, PlayerPosition> = {
  // Goalkeeper
  'GK': 'Torwart',
  'Goalkeeper': 'Torwart',
  'TW': 'Torwart',
  
  // Defender
  'CB': 'Abwehr',
  'LB': 'Abwehr',
  'RB': 'Abwehr',
  'LWB': 'Abwehr',
  'RWB': 'Abwehr',
  'Defender': 'Abwehr',
  'ABW': 'Abwehr',
  
  // Midfielder
  'CDM': 'Mittelfeld',
  'CM': 'Mittelfeld',
  'CAM': 'Mittelfeld',
  'LM': 'Mittelfeld',
  'RM': 'Mittelfeld',
  'Midfielder': 'Mittelfeld',
  'MIT': 'Mittelfeld',
  
  // Forward
  'LW': 'Sturm',
  'RW': 'Sturm',
  'CF': 'Sturm',
  'ST': 'Sturm',
  'Forward': 'Sturm',
  'STU': 'Sturm'
};

export const getPositionShort = (position: string | undefined): string => {
  if (!position) return 'STU';
  
  // Normalize input
  const normalized = position.trim();
  
  // If it's already one of our main positions, return the short version
  if (normalized === 'Torwart') return 'TW';
  if (normalized === 'Abwehr') return 'ABW';
  if (normalized === 'Mittelfeld') return 'MIT';
  if (normalized === 'Sturm') return 'STU';
  
  // Try mapping from old values
  const mapped = POSITION_MAP[normalized];
  if (mapped) {
    if (mapped === 'Torwart') return 'TW';
    if (mapped === 'Abwehr') return 'ABW';
    if (mapped === 'Mittelfeld') return 'MIT';
    if (mapped === 'Sturm') return 'STU';
  }
  
  // Fallback
  return 'STU';
};

export const mapOldPosition = (position: string | undefined): PlayerPosition => {
  if (!position) return 'Sturm';
  const mapped = POSITION_MAP[position.trim()];
  return mapped || 'Sturm';
};
