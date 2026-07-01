import type { Player, PlayerStats } from '../types.ts';

export const DEFAULT_STATS: Omit<PlayerStats, 'player_id' | 'updated_at'> = {
  overall: 50,
  tem: 50,
  sch: 50,
  pas: 50,
  dri: 50,
  def: 50,
  phy: 50
};

/**
 * Resolves the latest stats for a player from their player_stats array.
 * @param player The player object containing player_stats
 * @returns The latest stats or default values
 */
export function resolveLatestStats(player: Partial<Player>): PlayerStats {
  const statsArray = player.player_stats;
  
  if (!Array.isArray(statsArray) || statsArray.length === 0) {
    console.log(`DEBUG: [STATS] No stats found for player ${player.full_name || player.id}. Using defaults.`);
    return {
      player_id: player.id || '',
      updated_at: new Date().toISOString(),
      ...DEFAULT_STATS
    };
  }

  console.log(`DEBUG: [STATS] Found ${statsArray.length} stats rows for player ${player.full_name || player.id}.`);

  // Sort by updated_at descending
  // We use slice() to avoid mutating the original array if it's passed by reference
  const sorted = [...statsArray].sort((a, b) => {
    const dateA = new Date(a.updated_at || 0).getTime();
    const dateB = new Date(b.updated_at || 0).getTime();
    
    if (!isNaN(dateA) && !isNaN(dateB) && dateB !== dateA) {
      return dateB - dateA; // Descending (latest first)
    }
    
    return 0;
  });

  const latest = sorted[0];
  console.log(`DEBUG: [STATS] Selected latest row for ${player.full_name || player.id}: Updated=${latest.updated_at}, OVR=${latest.overall}`);
  
  // Ensure we return a clean object with all required fields
  return {
    ...latest,
    player_id: player.id || latest.player_id || '',
    updated_at: latest.updated_at || new Date().toISOString(),
    overall: latest.overall ?? DEFAULT_STATS.overall,
    tem: latest.tem ?? DEFAULT_STATS.tem,
    sch: latest.sch ?? DEFAULT_STATS.sch,
    pas: latest.pas ?? DEFAULT_STATS.pas,
    dri: latest.dri ?? DEFAULT_STATS.dri,
    def: latest.def ?? DEFAULT_STATS.def,
    phy: latest.phy ?? DEFAULT_STATS.phy
  };
}

/**
 * Merges the latest stats into a player object for UI consumption.
 * This creates a 'current_stats' property on the player object.
 */
export function mergePlayerStats<T extends Partial<Player>>(player: T): T & { current_stats: PlayerStats } {
  const latest = resolveLatestStats(player);
  console.log(`DEBUG: [STATS] Merging stats into ${player.full_name || player.id}:`, latest);
  return {
    ...player,
    current_stats: latest
  };
}

/**
 * Maps a player (or array of players) to include the resolved current_stats.
 */
export function mapPlayerWithStats<T extends Partial<Player>>(player: T): T & { current_stats: PlayerStats };
export function mapPlayerWithStats<T extends Partial<Player>>(players: T[]): (T & { current_stats: PlayerStats })[];
export function mapPlayerWithStats<T extends Partial<Player>>(input: T | T[]): any {
  if (Array.isArray(input)) {
    return input.map(p => mergePlayerStats(p));
  }
  return mergePlayerStats(input);
}
