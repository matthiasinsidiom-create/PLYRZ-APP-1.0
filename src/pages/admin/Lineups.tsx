import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  ListOrdered, 
  ArrowLeft,
  Search,
  Check,
  Loader2,
  Calendar,
  Users,
  Shield,
  ChevronRight,
  AlertCircle,
  X
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { getPositionShort } from '../../lib/positions';
import { useAuth } from '../../context/AuthContext';

interface LineupEntryState {
  player_id: string;
  jersey_number: string;
  lineup_role: 'starter' | 'sub';
}

// 1. Isolated Player Row Component
const PlayerRow = React.memo(({ 
  team, 
  player, 
  entry, 
  onToggle, 
  onUpdateDetail 
}: { 
  team: 'home' | 'away', 
  player: any, 
  entry: LineupEntryState | null, 
  onToggle: (team: 'home' | 'away', id: string) => void,
  onUpdateDetail: (team: 'home' | 'away', id: string, updates: Partial<LineupEntryState>) => void
}) => {
  useEffect(() => {
    console.log(`DEBUG: [MOUNT] PlayerRow for ${player.full_name} (${player.id})`);
    return () => console.log(`DEBUG: [UNMOUNT] PlayerRow for ${player.full_name} (${player.id})`);
  }, []);

  console.log(`DEBUG: [RENDER] PlayerRow key=${player.id} player_id=${player.id} jersey=${entry?.jersey_number || 'N/A'}`);

  if (!entry) {
    // Available Pool Row
    return (
      <div 
        key={player.id}
        className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl mb-2 hover:border-zinc-700 transition-all cursor-pointer"
        onClick={() => onToggle(team, player.id)}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-zinc-800 text-zinc-600">
          #
        </div>
        <div className="flex-1">
          <p className="font-bold text-white">{player.full_name}</p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            {getPositionShort(player.position)} • {player.teams?.name || 'Kein Team'}
          </p>
        </div>
        <div className="w-6 h-6 rounded-full border border-zinc-800 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-zinc-800" />
        </div>
      </div>
    );
  }

  // Selected Player Row
  return (
    <div 
      key={player.id}
      className={`flex items-center gap-4 p-4 rounded-xl border mb-2 transition-all ${
        entry.lineup_role === 'starter' 
          ? 'bg-emerald-500/5 border-emerald-500/30' 
          : 'bg-zinc-900 border-zinc-800'
      }`}
    >
      {/* Left: Toggle/Select Area (Click to remove) */}
      <div 
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => onToggle(team, player.id)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
          entry.lineup_role === 'starter' ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'
        }`}>
          <Check className="w-5 h-5" />
        </div>
        <div className="min-w-[120px]">
          <p className="font-bold text-sm text-white">{player.full_name}</p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            {getPositionShort(player.position)}
          </p>
        </div>
      </div>

      {/* Middle: Plain Editable Jersey Number Input */}
      <div className="flex-1 flex justify-center">
        <div className="relative w-16">
          <input
            type="text"
            placeholder="#"
            value={entry.jersey_number}
            onChange={(e) => {
              console.log(`DEBUG: [KEYSTROKE] ${player.id}: "${e.target.value}"`);
              onUpdateDetail(team, player.id, { jersey_number: e.target.value });
            }}
            onFocus={() => console.log(`DEBUG: [FOCUS] ${player.id}`)}
            onBlur={() => console.log(`DEBUG: [BLUR] ${player.id}`)}
            className="w-full h-10 bg-black border border-zinc-700 rounded-lg text-center text-white font-black italic focus:border-emerald-500 outline-none transition-all"
          />
          <span className="absolute -top-2 -right-1 text-[6px] font-black text-zinc-600 uppercase bg-zinc-900 px-1 rounded">Nr.</span>
        </div>
      </div>

      {/* Right: Lineup Role Control */}
      <div className="w-24">
        <select
          value={entry.lineup_role}
          onChange={(e) => onUpdateDetail(team, player.id, { lineup_role: e.target.value as 'starter' | 'sub' })}
          className={`w-full h-10 bg-black border rounded-lg text-[10px] font-black uppercase px-2 outline-none transition-all ${
            entry.lineup_role === 'starter' ? 'border-emerald-500/50 text-emerald-500' : 'border-zinc-700 text-zinc-500'
          }`}
        >
          <option value="starter">STARTELF</option>
          <option value="sub">BANK</option>
        </select>
      </div>
    </div>
  );
});

const AdminLineups: React.FC = () => {
  const navigate = useNavigate();
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const location = useLocation();
  const { isAdmin: isSuperAdmin, clubAdminClubIds } = useAuth();

  const isTeamAdminView = location.pathname.startsWith('/team-admin');
  const backPath = isTeamAdminView ? '/team-admin' : '/admin';

  const [fixtures, setFixtures] = useState<any[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<any>(null);
  const [homePlayers, setHomePlayers] = useState<any[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<any[]>([]);
  
  const [canManageHome, setCanManageHome] = useState(true);
  const [canManageAway, setCanManageAway] = useState(true);
  const [lineup, setLineup] = useState<{ home: LineupEntryState[], away: LineupEntryState[] }>({ home: [], away: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  console.log('DEBUG: [RENDER] AdminLineups component');

  // Debug logs for state changes
  useEffect(() => {
    console.log('DEBUG: [STATE] selectedFixture changed:', selectedFixture?.id);
  }, [selectedFixture]);

  useEffect(() => {
    console.log('DEBUG: [STATE] lineup changed:', lineup);
  }, [lineup]);

  useEffect(() => {
    console.log('DEBUG: [STATE] homePlayers count:', homePlayers.length);
  }, [homePlayers]);

  useEffect(() => {
    console.log('DEBUG: [STATE] awayPlayers count:', awayPlayers.length);
  }, [awayPlayers]);

  useEffect(() => {
    loadFixtures();
  }, []);

  const loadFixtures = async () => {
    setLoading(true);
    try {
      console.log('DEBUG: Loading fixtures for appearances...');
      let data = await supabaseService.getFixtures();
      
      // Filter for Team Admin
      if (isTeamAdminView && !isSuperAdmin) {
        const clubAccess = await supabaseService.getClubAdminAccess();
        data = data.filter(f => {
          const hClubId = f.home_team?.club_id;
          const aClubId = f.away_team?.club_id;
          return clubAccess.some(a => 
            (a.club_id === hClubId || a.club_id === aClubId) &&
            (a.team_scope === 'all' || a.team_scope === f.match_type)
          );
        });
      }

      console.log('DEBUG: Raw fixtures received:', data.length);
      
      setFixtures(data);

      // Auto-select fixture if ID provided in URL
      if (fixtureId) {
        const fixture = data.find(f => f.id === fixtureId);
        if (fixture) {
          handleSelectFixture(fixture);
        }
      }
      
      const liveCount = data.filter(f => f.status === 'live').length;
      const finishedCount = data.filter(f => f.status === 'finished').length;
      const upcomingCount = data.filter(f => f.status === 'upcoming').length;
      console.log('DEBUG: Filtered live fixtures count:', liveCount);
      console.log('DEBUG: Filtered finished fixtures count:', finishedCount);
      console.log('DEBUG: Filtered upcoming fixtures count:', upcomingCount);
    } catch (err) {
      console.error('DEBUG: Error loading fixtures:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFixture = async (fixture: any) => {
    setLoading(true);
    setSelectedFixture(fixture);
    
    const homeClubId = fixture.home_team?.club_id;
    const awayClubId = fixture.away_team?.club_id;

    console.log('DEBUG: Selected fixture:', fixture.id);
    console.log('DEBUG: Home Team ID:', fixture.home_team_id);
    console.log('DEBUG: Away Team ID:', fixture.away_team_id);
    console.log('DEBUG: Home Club ID:', homeClubId);
    console.log('DEBUG: Away Club ID:', awayClubId);
    console.log('DEBUG: Home Team:', fixture.home_team?.clubs?.name, '-', fixture.home_team?.name);
    console.log('DEBUG: Away Team:', fixture.away_team?.clubs?.name, '-', fixture.away_team?.name);
    
    try {
      if (!homeClubId || !awayClubId) {
        console.error('DEBUG: Club IDs missing!', { homeClubId, awayClubId });
        throw new Error('Club IDs missing for this fixture');
      }
      
      const isHomeAdmin = isSuperAdmin || clubAdminClubIds.includes(homeClubId);
      const isAwayAdmin = isSuperAdmin || clubAdminClubIds.includes(awayClubId);
      
      setCanManageHome(isHomeAdmin);
      setCanManageAway(isAwayAdmin);

      console.log('DEBUG: Fetching players for clubs:', [homeClubId, awayClubId]);
      const [allPlayers, currentLineup] = await Promise.all([
        supabaseService.getPlayersByClubs([homeClubId, awayClubId]),
        supabaseService.getFixtureLineup(fixture.id)
      ]);

      console.log('DEBUG: Eligible players full result array:', allPlayers);
      allPlayers.forEach(p => {
        console.log(`DEBUG: Player: ${p.id} | Name: ${p.full_name} | Base Team ID: ${p.team_id} | Base Team Name: ${p.teams?.name} | Club ID: ${p.teams?.club_id} | Club Name: ${p.teams?.clubs?.name}`);
      });

      console.log('DEBUG: Existing lineup entries:', currentLineup.length);

      // Filter players strictly by their team_id to match fixture exactly
      const homeTeamPlayers = allPlayers.filter(p => p.team_id === fixture.home_team_id);
      const awayTeamPlayers = allPlayers.filter(p => p.team_id === fixture.away_team_id);
      
      console.log('DEBUG: Eligible players count for home team:', homeTeamPlayers.length);
      console.log('DEBUG: Eligible players count for away team:', awayTeamPlayers.length);

      // If user is not superadmin and cannot manage home, hide home players from selection
      setHomePlayers(isHomeAdmin ? homeTeamPlayers : []);
      // If user is not superadmin and cannot manage away, hide away players from selection
      setAwayPlayers(isAwayAdmin ? awayTeamPlayers : []);
      
      const homeEntries = currentLineup
        .filter(l => l.team_id === fixture.home_team_id)
        .map(l => {
          const player = homeTeamPlayers.find(p => p.id === l.player_id);
          return { 
            player_id: l.player_id, 
            jersey_number: (l.jersey_number || player?.jersey_number || '').toString(), 
            lineup_role: (l.lineup_role as 'starter' | 'sub') || 'starter' 
          };
        });
      const awayEntries = currentLineup
        .filter(l => l.team_id === fixture.away_team_id)
        .map(l => {
          const player = awayTeamPlayers.find(p => p.id === l.player_id);
          return { 
            player_id: l.player_id, 
            jersey_number: (l.jersey_number || player?.jersey_number || '').toString(), 
            lineup_role: (l.lineup_role as 'starter' | 'sub') || 'starter' 
          };
        });
      
      console.log('DEBUG: Mapped home appearance entries:', homeEntries.length);
      console.log('DEBUG: Mapped away appearance entries:', awayEntries.length);
      
      console.log('DEBUG: [INIT] Initializing lineup from backend data');
      setLineup({ home: homeEntries, away: awayEntries });
    } catch (err) {
      console.error('DEBUG: Error loading appearance data:', err);
      alert('Error loading data: ' + (err as any).message);
    } finally {
      setLoading(false);
    }
  };



  const togglePlayer = React.useCallback((team: 'home' | 'away', playerId: string) => {
    setLineup(prev => {
      const otherTeam = team === 'home' ? 'away' : 'home';
      const current = prev[team];
      const other = prev[otherTeam];

      const isAlreadyInCurrent = current.some(e => e.player_id === playerId);

      if (isAlreadyInCurrent) {
        console.log('DEBUG: [ACTION] Removing player from lineup:', playerId);
        return { ...prev, [team]: current.filter(e => e.player_id !== playerId) };
      } else {
        // Check 11 starters limit
        const starterCount = current.filter(e => e.lineup_role === 'starter').length;
        const defaultRole = starterCount < 11 ? 'starter' : 'sub';

        // Add to current team, and remove from other team if they were there
        const playerPool = team === 'home' ? homePlayers : awayPlayers;
        const player = playerPool.find(p => p.id === playerId);
        const newEntry: LineupEntryState = {
          player_id: playerId,
          jersey_number: (player?.jersey_number ?? '').toString(),
          lineup_role: defaultRole
        };
        console.log('DEBUG: [ACTION] Adding player to lineup:', playerId, 'as', defaultRole);
        return {
          ...prev,
          [team]: [...current, newEntry],
          [otherTeam]: other.filter(e => e.player_id !== playerId)
        };
      }
    });
  }, [homePlayers, awayPlayers]);

  const updatePlayerDetail = React.useCallback((team: 'home' | 'away', playerId: string, updates: Partial<LineupEntryState>) => {
    setLineup(prev => {
      // If changing to starter, check 11 limit
      if (updates.lineup_role === 'starter') {
        const starterCount = prev[team].filter(e => e.lineup_role === 'starter').length;
        if (starterCount >= 11) {
          alert('Maximum 11 starters allowed per team.');
          return prev;
        }
      }

      // If changing jersey number, check for duplicates in the same team (non-blocking warning)
      if (updates.jersey_number !== undefined && updates.jersey_number !== null) {
        const isDuplicate = prev[team].some(e => e.player_id !== playerId && e.jersey_number === updates.jersey_number);
        if (isDuplicate) {
          console.warn(`DEBUG: Jersey number ${updates.jersey_number} is already assigned to another player in this team.`);
          // We'll allow it in state to not block typing, but the admin should fix it before saving or we can warn on save.
        }
      }

      console.log('DEBUG: [ACTION] Updating player detail:', playerId, updates);
      return {
        ...prev,
        [team]: prev[team].map(e => e.player_id === playerId ? { ...e, ...updates } : e)
      };
    });
  }, []);

  const handleSaveLineup = async () => {
    if (!selectedFixture) return;
    setSaving(true);
    try {
      const lineupData = [
        ...lineup.home.map(e => ({ 
          fixture_id: selectedFixture.id, 
          team_id: selectedFixture.home_team_id, 
          player_id: e.player_id,
          jersey_number: e.jersey_number ? parseInt(e.jersey_number) : null,
          lineup_role: e.lineup_role
        })),
        ...lineup.away.map(e => ({ 
          fixture_id: selectedFixture.id, 
          team_id: selectedFixture.away_team_id, 
          player_id: e.player_id,
          jersey_number: e.jersey_number ? parseInt(e.jersey_number) : null,
          lineup_role: e.lineup_role
        }))
      ];
      
      console.log('DEBUG: [SAVE] Attempting to save lineup for fixture:', selectedFixture.id);
      console.log('DEBUG: [SAVE] Full Payload (converted to integers):', JSON.stringify(lineupData, null, 2));
      
      await supabaseService.updateFixtureLineup(selectedFixture.id, lineupData);
      
      console.log('DEBUG: [SAVE] Lineup saved successfully for fixture:', selectedFixture.id);
      alert('Lineup saved successfully!');
    } catch (err) {
      console.error('DEBUG: [SAVE] Error saving lineup:', err);
      alert('Error saving lineup: ' + (err as any).message);
    } finally {
      setSaving(false);
    }
  };

  const liveFixtures = fixtures.filter(f => 
    f.status === 'live' && (
      f.home_team?.clubs?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.home_team?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.away_team?.clubs?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.away_team?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const finishedFixtures = fixtures.filter(f => 
    f.status === 'finished' && (
      f.home_team?.clubs?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.home_team?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.away_team?.clubs?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.away_team?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const upcomingFixtures = fixtures.filter(f => 
    f.status === 'upcoming' && (
      f.home_team?.clubs?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.home_team?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.away_team?.clubs?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.away_team?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  if (selectedFixture) {
    return (
      <div className="min-h-screen bg-transparent p-4 sm:p-6 pb-32 text-white font-sans">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4 w-full">
                  <button 
                    onClick={() => {
                      if (fixtureId) {
                        navigate(backPath);
                      } else {
                        setSelectedFixture(null);
                      }
                    }}
                    className="p-3 shrink-0 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-zinc-400" />
                  </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase whitespace-normal leading-tight">AUFSTELLUNGEN</h1>
                <div className="flex items-center gap-2 text-zinc-500 font-medium text-sm mt-1">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-600 font-bold truncate">{selectedFixture.home_team?.clubs?.name}</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-zinc-700 font-black italic">VS</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-600 font-bold truncate">{selectedFixture.away_team?.clubs?.name}</span>
                  </div>
                </div>
              </div>
                </div>
              <button
                disabled={saving}
                onClick={handleSaveLineup}
                className="hidden md:flex bg-emerald-500 hover:bg-emerald-600 text-black font-black py-3 px-8 rounded-xl transition-all disabled:opacity-50 items-center gap-2 whitespace-nowrap"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                AUFSTELLUNG SPEICHERN
              </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {(!canManageHome && !canManageAway) ? (
              <div className="lg:col-span-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-12 text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-xl font-black italic uppercase tracking-tight text-white mb-2">Keine Berechtigung</h3>
                <p className="text-zinc-500 max-w-md mx-auto text-sm">
                  Du hast keine Berechtigung, die Aufstellung für dieses Spiel zu bearbeiten.
                </p>
              </div>
            ) : homePlayers.length === 0 && awayPlayers.length === 0 ? (
              <div className="lg:col-span-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-12 text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-xl font-black italic uppercase tracking-tight text-white mb-2">Keine Spieler gefunden</h3>
                <p className="text-zinc-500 max-w-md mx-auto text-sm">
                  Wir konnten keine Spieler für die beteiligten Vereine finden. 
                  Bitte stelle sicher, dass Spieler im Spieler-Manager hinzugefügt wurden.
                </p>
              </div>
            ) : (
              <>
                {/* Home Team */}
                {canManageHome && (
            <div className="space-y-4">
              <div className="flex flex-col gap-1 p-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-emerald-500" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">{selectedFixture.home_team?.clubs?.name}</span>
                    <h3 className="text-lg font-black uppercase italic tracking-tight leading-none text-white">{selectedFixture.home_team?.name}</h3>
                  </div>
                  <div className="ml-auto flex flex-col items-end">
                    <span className="text-xs font-bold text-zinc-500">{lineup.home.length} Gesamt</span>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{lineup.home.filter(e => e.lineup_role === 'starter').length} Startelf</span>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mt-2 border-t border-zinc-800 pt-2">
                  Spieler auswählen, Rückennummern und Rollen zuweisen
                </p>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {/* Starters */}
                {lineup.home.filter(e => e.lineup_role === 'starter').length > 0 && (
                  <div className="space-y-1 mb-4">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest px-2 mb-2">Startelf</p>
                    {lineup.home.filter(e => e.lineup_role === 'starter').map(entry => {
                      const player = homePlayers.find(p => p.id === entry.player_id);
                      if (!player) return null;
                      return (
                        <PlayerRow 
                          key={player.id}
                          team="home"
                          player={player}
                          entry={entry}
                          onToggle={togglePlayer}
                          onUpdateDetail={updatePlayerDetail}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Substitutes */}
                {lineup.home.filter(e => e.lineup_role === 'sub').length > 0 && (
                  <div className="space-y-1 mb-4">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 mb-2">Auswechselspieler</p>
                    {lineup.home.filter(e => e.lineup_role === 'sub').map(entry => {
                      const player = homePlayers.find(p => p.id === entry.player_id);
                      if (!player) return null;
                      return (
                        <PlayerRow 
                          key={player.id}
                          team="home"
                          player={player}
                          entry={entry}
                          onToggle={togglePlayer}
                          onUpdateDetail={updatePlayerDetail}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Available Players */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-2 mb-2">Verfügbare Spieler</p>
                  {homePlayers.filter(p => !lineup.home.some(e => e.player_id === p.id)).map(player => (
                    <PlayerRow 
                      key={player.id}
                      team="home"
                      player={player}
                      entry={null}
                      onToggle={togglePlayer}
                      onUpdateDetail={updatePlayerDetail}
                    />
                  ))}
                </div>
              </div>
            </div>
                )}

                {/* Away Team */}
                {canManageAway && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Shield className="w-6 h-6 text-blue-500" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">{selectedFixture.away_team?.clubs?.name}</span>
                        <h3 className="text-lg font-black uppercase italic tracking-tight leading-none text-white">{selectedFixture.away_team?.name}</h3>
                      </div>
                      <div className="ml-auto flex flex-col items-end">
                        <span className="text-xs font-bold text-zinc-500">{lineup.away.length} Gesamt</span>
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{lineup.away.filter(e => e.lineup_role === 'starter').length} Startelf</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mt-2 border-t border-zinc-800 pt-2">
                      Spieler auswählen, Rückennummern und Rollen zuweisen
                    </p>
                  </div>
                  {awayPlayers.length === 0 ? (
                    <div className="p-8 bg-zinc-900/50 border border-zinc-800 border-dashed rounded-xl text-center">
                      <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">Keine Spieler für diesen Verein gefunden</p>
                    </div>
                  ) : (
                  <div className="grid grid-cols-1 gap-1">
                    {/* Starters */}
                    {lineup.away.filter(e => e.lineup_role === 'starter').length > 0 && (
                      <div className="space-y-1 mb-4">
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest px-2 mb-2">Startelf</p>
                        {lineup.away.filter(e => e.lineup_role === 'starter').map(entry => {
                          const player = awayPlayers.find(p => p.id === entry.player_id);
                          if (!player) return null;
                          return (
                            <PlayerRow 
                              key={player.id}
                              team="away"
                              player={player}
                              entry={entry}
                              onToggle={togglePlayer}
                              onUpdateDetail={updatePlayerDetail}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Substitutes */}
                    {lineup.away.filter(e => e.lineup_role === 'sub').length > 0 && (
                      <div className="space-y-1 mb-4">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 mb-2">Auswechselspieler</p>
                        {lineup.away.filter(e => e.lineup_role === 'sub').map(entry => {
                          const player = awayPlayers.find(p => p.id === entry.player_id);
                          if (!player) return null;
                          return (
                            <PlayerRow 
                              key={player.id}
                              team="away"
                              player={player}
                              entry={entry}
                              onToggle={togglePlayer}
                              onUpdateDetail={updatePlayerDetail}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Available Players */}
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-2 mb-2">Verfügbare Spieler</p>
                      {awayPlayers.filter(p => !lineup.away.some(e => e.player_id === p.id)).map(player => (
                        <PlayerRow 
                          key={player.id}
                          team="away"
                          player={player}
                          entry={null}
                          onToggle={togglePlayer}
                          onUpdateDetail={updatePlayerDetail}
                        />
                      ))}
                    </div>
                  </div>
                  )}
                </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mobile Sticky Save Bar */}
        <div className="md:hidden fixed bottom-24 sm:bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-xl border-t border-white/10 z-50">
          <button
            disabled={saving}
            onClick={handleSaveLineup}
            className="w-full justify-center bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-black font-black py-4 px-8 rounded-2xl transition-all disabled:opacity-50 flex items-center gap-2 text-sm uppercase tracking-widest shadow-[0_0_40px_rgba(16,185,129,0.3)]"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            AUFSTELLUNG SPEICHERN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-6 text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(backPath)}
            className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">AUFSTELLUNGEN</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-zinc-500 font-medium text-sm">Spieler zuweisen, die an Spielen teilgenommen haben</p>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20">
                Anstehend, Live & Beendet
              </span>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text"
            placeholder="Spiele suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-yellow-500/50 transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Spiele werden geladen...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Upcoming Matches Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <h2 className="text-xl font-black italic uppercase tracking-tight text-white">ANSTEHENDE SPIELE</h2>
              </div>
              
              {upcomingFixtures.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl p-8 text-center">
                  <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">Keine anstehenden Spiele gefunden</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingFixtures.map(fixture => (
                    <button
                      key={fixture.id}
                      onClick={() => handleSelectFixture(fixture)}
                      className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center justify-between group hover:border-blue-500/30 transition-all"
                    >
                      <div className="flex items-center gap-6">
                        <div className="p-3 bg-zinc-800 rounded-xl group-hover:bg-blue-500/10 transition-colors">
                          <Calendar className="w-6 h-6 text-zinc-500 group-hover:text-blue-500" />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                            <Shield className="w-3 h-3" />
                            {fixture.leagues?.name}
                          </div>
                          <div className="flex flex-col">
                            <p className="font-bold text-lg italic uppercase tracking-tight text-white">
                              {fixture.home_team?.clubs?.name} <span className="text-zinc-600 mx-1">VS</span> {fixture.away_team?.clubs?.name}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                              <span>{fixture.home_team?.name}</span>
                              <span className="text-zinc-800">vs</span>
                              <span>{fixture.away_team?.name}</span>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500 font-medium mt-1">
                            {new Date(fixture.kickoff_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-blue-500 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live Matches Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <h2 className="text-xl font-black italic uppercase tracking-tight text-white">LIVE-SPIELE</h2>
              </div>
              
              {liveFixtures.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl p-8 text-center">
                  <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">Keine Live-Spiele gefunden</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {liveFixtures.map(fixture => (
                    <button
                      key={fixture.id}
                      onClick={() => handleSelectFixture(fixture)}
                      className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center justify-between group hover:border-red-500/30 transition-all"
                    >
                      <div className="flex items-center gap-6">
                        <div className="p-3 bg-zinc-800 rounded-xl group-hover:bg-red-500/10 transition-colors">
                          <Calendar className="w-6 h-6 text-zinc-500 group-hover:text-red-500" />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                            <Shield className="w-3 h-3" />
                            {fixture.leagues?.name}
                          </div>
                          <div className="flex flex-col">
                            <p className="font-bold text-lg italic uppercase tracking-tight text-white">
                              {fixture.home_team?.clubs?.name} <span className="text-zinc-600 mx-1">VS</span> {fixture.away_team?.clubs?.name}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                              <span>{fixture.home_team?.name}</span>
                              <span className="text-zinc-800">vs</span>
                              <span>{fixture.away_team?.name}</span>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500 font-medium mt-1">
                            {new Date(fixture.kickoff_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-red-500 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Finished Matches Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-zinc-500 rounded-full" />
                <h2 className="text-xl font-black italic uppercase tracking-tight text-white">BEENDETE SPIELE</h2>
              </div>

              {finishedFixtures.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl p-8 text-center">
                  <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">Keine beendeten Spiele gefunden</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {finishedFixtures.map(fixture => (
                    <button
                      key={fixture.id}
                      onClick={() => handleSelectFixture(fixture)}
                      className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center justify-between group hover:border-yellow-500/30 transition-all"
                    >
                      <div className="flex items-center gap-6">
                        <div className="p-3 bg-zinc-800 rounded-xl group-hover:bg-yellow-500/10 transition-colors">
                          <Calendar className="w-6 h-6 text-zinc-500 group-hover:text-yellow-500" />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                            <Shield className="w-3 h-3" />
                            {fixture.leagues?.name}
                          </div>
                          <div className="flex flex-col">
                            <p className="font-bold text-lg italic uppercase tracking-tight text-white">
                              {fixture.home_team?.clubs?.name} <span className="text-zinc-600 mx-1">VS</span> {fixture.away_team?.clubs?.name}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                              <span>{fixture.home_team?.name}</span>
                              <span className="text-zinc-800">vs</span>
                              <span>{fixture.away_team?.name}</span>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500 font-medium mt-1">
                            {new Date(fixture.kickoff_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-yellow-500 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLineups;
