import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
  AlertCircle
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';

interface LineupEntryState {
  player_id: string;
  shirt_number: number | null;
  lineup_role: 'starter' | 'sub';
}

const AdminLineups: React.FC = () => {
  const navigate = useNavigate();
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<any>(null);
  const [homePlayers, setHomePlayers] = useState<any[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<any[]>([]);
  const [lineup, setLineup] = useState<{ home: LineupEntryState[], away: LineupEntryState[] }>({ home: [], away: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFixtures();
  }, []);

  const loadFixtures = async () => {
    setLoading(true);
    try {
      console.log('DEBUG: Loading fixtures for appearances...');
      const data = await supabaseService.getFixtures();
      console.log('DEBUG: Raw fixtures received:', data.length);
      const uniqueStatuses = Array.from(new Set(data.map(f => f.status)));
      console.log('DEBUG: Unique statuses in database:', uniqueStatuses);
      
      // Store all fixtures, but we'll filter them in the render logic
      setFixtures(data);
      
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

      // Filter players by their club
      const homeClubPlayers = allPlayers.filter(p => (p as any).teams?.club_id === homeClubId);
      const awayClubPlayers = allPlayers.filter(p => (p as any).teams?.club_id === awayClubId);
      
      console.log('DEBUG: Eligible players count for home club:', homeClubPlayers.length);
      console.log('DEBUG: Eligible players count for away club:', awayClubPlayers.length);

      setHomePlayers(homeClubPlayers);
      setAwayPlayers(awayClubPlayers);
      
      const homeEntries = currentLineup
        .filter(l => l.team_id === fixture.home_team_id)
        .map(l => ({ 
          player_id: l.player_id, 
          shirt_number: l.shirt_number || null, 
          lineup_role: (l.lineup_role as 'starter' | 'sub') || 'starter' 
        }));
      const awayEntries = currentLineup
        .filter(l => l.team_id === fixture.away_team_id)
        .map(l => ({ 
          player_id: l.player_id, 
          shirt_number: l.shirt_number || null, 
          lineup_role: (l.lineup_role as 'starter' | 'sub') || 'starter' 
        }));
      
      console.log('DEBUG: Mapped home appearance entries:', homeEntries.length);
      console.log('DEBUG: Mapped away appearance entries:', awayEntries.length);
      
      setLineup({ home: homeEntries, away: awayEntries });
    } catch (err) {
      console.error('DEBUG: Error loading appearance data:', err);
      alert('Error loading data: ' + (err as any).message);
    } finally {
      setLoading(false);
    }
  };



  const togglePlayer = (team: 'home' | 'away', playerId: string) => {
    setLineup(prev => {
      const otherTeam = team === 'home' ? 'away' : 'home';
      const current = prev[team];
      const other = prev[otherTeam];

      const isAlreadyInCurrent = current.some(e => e.player_id === playerId);

      if (isAlreadyInCurrent) {
        return { ...prev, [team]: current.filter(e => e.player_id !== playerId) };
      } else {
        // Check 11 starters limit
        const starterCount = current.filter(e => e.lineup_role === 'starter').length;
        const defaultRole = starterCount < 11 ? 'starter' : 'sub';

        // Add to current team, and remove from other team if they were there
        const newEntry: LineupEntryState = {
          player_id: playerId,
          shirt_number: null,
          lineup_role: defaultRole
        };
        return {
          ...prev,
          [team]: [...current, newEntry],
          [otherTeam]: other.filter(e => e.player_id !== playerId)
        };
      }
    });
  };

  const updatePlayerDetail = (team: 'home' | 'away', playerId: string, updates: Partial<LineupEntryState>) => {
    setLineup(prev => {
      // If changing to starter, check 11 limit
      if (updates.lineup_role === 'starter') {
        const starterCount = prev[team].filter(e => e.lineup_role === 'starter').length;
        if (starterCount >= 11) {
          alert('Maximum 11 starters allowed per team.');
          return prev;
        }
      }

      // If changing shirt number, check for duplicates in the same team
      if (updates.shirt_number !== undefined && updates.shirt_number !== null) {
        const isDuplicate = prev[team].some(e => e.player_id !== playerId && e.shirt_number === updates.shirt_number);
        if (isDuplicate) {
          alert(`Shirt number ${updates.shirt_number} is already assigned to another player in this team.`);
          // We'll still allow it in state but warn, or we can block it. 
          // The user said "If possible, prevent duplicate shirt numbers".
          // Let's block it for better UX.
          return prev;
        }
      }

      return {
        ...prev,
        [team]: prev[team].map(e => e.player_id === playerId ? { ...e, ...updates } : e)
      };
    });
  };

  const handleSaveLineup = async () => {
    if (!selectedFixture) return;
    setSaving(true);
    try {
      const lineupData = [
        ...lineup.home.map(e => ({ 
          fixture_id: selectedFixture.id, 
          team_id: selectedFixture.home_team_id, 
          player_id: e.player_id,
          shirt_number: e.shirt_number,
          lineup_role: e.lineup_role
        })),
        ...lineup.away.map(e => ({ 
          fixture_id: selectedFixture.id, 
          team_id: selectedFixture.away_team_id, 
          player_id: e.player_id,
          shirt_number: e.shirt_number,
          lineup_role: e.lineup_role
        }))
      ];
      console.log('DEBUG: Final fixture_lineups payload:', JSON.stringify(lineupData, null, 2));
      await supabaseService.updateFixtureLineup(selectedFixture.id, lineupData);
      alert('Lineup saved successfully!');
    } catch (err) {
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
      <div className="min-h-screen bg-transparent p-6 text-white font-sans">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedFixture(null)}
                    className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-zinc-400" />
                  </button>
              <div>
                <h1 className="text-2xl font-black italic tracking-tighter uppercase">MATCH APPEARANCES</h1>
                <div className="flex items-center gap-2 text-zinc-500 font-medium text-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">{selectedFixture.home_team?.clubs?.name}</span>
                    <span className="font-bold text-white">{selectedFixture.home_team?.name}</span>
                  </div>
                  <span className="mx-2 text-zinc-700">VS</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">{selectedFixture.away_team?.clubs?.name}</span>
                    <span className="font-bold text-white">{selectedFixture.away_team?.name}</span>
                  </div>
                </div>
              </div>
                </div>
              <button
                disabled={saving}
                onClick={handleSaveLineup}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-black py-3 px-8 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                SAVE APPEARANCES
              </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {homePlayers.length === 0 && awayPlayers.length === 0 ? (
              <div className="lg:col-span-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-12 text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-xl font-black italic uppercase tracking-tight text-white mb-2">No Players Found</h3>
                <p className="text-zinc-500 max-w-md mx-auto text-sm">
                  We couldn't find any players registered for the clubs involved in this match. 
                  Please ensure players are added to the clubs in the Player Manager.
                </p>
              </div>
            ) : (
              <>
                {/* Home Team */}
            <div className="space-y-4">
              <div className="flex flex-col gap-1 p-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-emerald-500" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">{selectedFixture.home_team?.clubs?.name}</span>
                    <h3 className="text-lg font-black uppercase italic tracking-tight leading-none text-white">{selectedFixture.home_team?.name}</h3>
                  </div>
                  <div className="ml-auto flex flex-col items-end">
                    <span className="text-xs font-bold text-zinc-500">{lineup.home.length} Total</span>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{lineup.home.filter(e => e.lineup_role === 'starter').length} Starters</span>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mt-2 border-t border-zinc-800 pt-2">
                  Select players, assign shirt numbers and roles
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {/* Starters */}
                {lineup.home.filter(e => e.lineup_role === 'starter').length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest px-2">Starting XI</p>
                    {lineup.home.filter(e => e.lineup_role === 'starter').map(entry => {
                      const player = homePlayers.find(p => p.id === entry.player_id);
                      if (!player) return null;
                      return (
                        <div key={player.id} className="flex gap-2">
                          <button
                            onClick={() => togglePlayer('home', player.id)}
                            className="flex-1 flex items-center justify-between p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/50 text-emerald-500 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-emerald-500 text-black">
                                {entry.shirt_number || '#'}
                              </div>
                              <div className="text-left">
                                <p className="font-bold">{player.full_name}</p>
                                <p className="text-[10px] uppercase tracking-wider opacity-60">
                                  {player.position} • {player.teams?.name || 'No Team'}
                                </p>
                              </div>
                            </div>
                            <Check className="w-5 h-5" />
                          </button>
                          <div className="flex flex-col gap-1">
                            <input 
                              type="number"
                              placeholder="#"
                              min="1"
                              max="99"
                              value={entry.shirt_number || ''}
                              onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value) : null;
                                if (val !== null && (val < 1 || val > 99)) return;
                                updatePlayerDetail('home', player.id, { shirt_number: val });
                              }}
                              className="w-12 h-1/2 bg-zinc-900 border border-zinc-800 rounded-lg text-center text-xs font-bold focus:border-emerald-500 outline-none"
                            />
                            <button 
                              onClick={() => updatePlayerDetail('home', player.id, { lineup_role: 'sub' })}
                              className="w-12 h-1/2 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-[8px] font-bold uppercase hover:bg-zinc-800"
                            >
                              SUB
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Substitutes */}
                {lineup.home.filter(e => e.lineup_role === 'sub').length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">Substitutes</p>
                    {lineup.home.filter(e => e.lineup_role === 'sub').map(entry => {
                      const player = homePlayers.find(p => p.id === entry.player_id);
                      if (!player) return null;
                      return (
                        <div key={player.id} className="flex gap-2">
                          <button
                            onClick={() => togglePlayer('home', player.id)}
                            className="flex-1 flex items-center justify-between p-4 rounded-xl border bg-zinc-800/50 border-zinc-700 text-zinc-400 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-zinc-800">
                                {entry.shirt_number || '#'}
                              </div>
                              <div className="text-left">
                                <p className="font-bold">{player.full_name}</p>
                                <p className="text-[10px] uppercase tracking-wider opacity-60">
                                  {player.position} • {player.teams?.name || 'No Team'}
                                </p>
                              </div>
                            </div>
                            <Check className="w-5 h-5 opacity-40" />
                          </button>
                          <div className="flex flex-col gap-1">
                            <input 
                              type="number"
                              placeholder="#"
                              min="1"
                              max="99"
                              value={entry.shirt_number || ''}
                              onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value) : null;
                                if (val !== null && (val < 1 || val > 99)) return;
                                updatePlayerDetail('home', player.id, { shirt_number: val });
                              }}
                              className="w-12 h-1/2 bg-zinc-900 border border-zinc-800 rounded-lg text-center text-xs font-bold focus:border-zinc-500 outline-none"
                            />
                            <button 
                              onClick={() => updatePlayerDetail('home', player.id, { lineup_role: 'starter' })}
                              className="w-12 h-1/2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center text-[8px] font-bold uppercase hover:bg-emerald-500/20 text-emerald-500"
                            >
                              START
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Available Players */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-2">Available Pool</p>
                  {homePlayers.filter(p => !lineup.home.some(e => e.player_id === p.id)).map(player => (
                    <button
                      key={player.id}
                      onClick={() => togglePlayer('home', player.id)}
                      className="w-full flex items-center justify-between p-4 rounded-xl border bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-zinc-800">
                          #
                        </div>
                        <div className="text-left">
                          <p className="font-bold">{player.full_name}</p>
                          <p className="text-[10px] uppercase tracking-wider opacity-60">
                            {player.position} • {player.teams?.name || 'No Team'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

                {/* Away Team */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-1 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Shield className="w-6 h-6 text-blue-500" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">{selectedFixture.away_team?.clubs?.name}</span>
                        <h3 className="text-lg font-black uppercase italic tracking-tight leading-none text-white">{selectedFixture.away_team?.name}</h3>
                      </div>
                      <div className="ml-auto flex flex-col items-end">
                        <span className="text-xs font-bold text-zinc-500">{lineup.away.length} Total</span>
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{lineup.away.filter(e => e.lineup_role === 'starter').length} Starters</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mt-2 border-t border-zinc-800 pt-2">
                      Select players, assign shirt numbers and roles
                    </p>
                  </div>
                  {awayPlayers.length === 0 ? (
                    <div className="p-8 bg-zinc-900/50 border border-zinc-800 border-dashed rounded-xl text-center">
                      <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">No players found for this club</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {/* Starters */}
                      {lineup.away.filter(e => e.lineup_role === 'starter').length > 0 && (
                        <div className="space-y-2 mb-4">
                          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest px-2">Starting XI</p>
                          {lineup.away.filter(e => e.lineup_role === 'starter').map(entry => {
                            const player = awayPlayers.find(p => p.id === entry.player_id);
                            if (!player) return null;
                            return (
                              <div key={player.id} className="flex gap-2">
                                <button
                                  onClick={() => togglePlayer('away', player.id)}
                                  className="flex-1 flex items-center justify-between p-4 rounded-xl border bg-blue-500/10 border-blue-500/50 text-blue-500 transition-all"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-blue-500 text-white">
                                      {entry.shirt_number || '#'}
                                    </div>
                                    <div className="text-left">
                                      <p className="font-bold">{player.full_name}</p>
                                      <p className="text-[10px] uppercase tracking-wider opacity-60">
                                        {player.position} • {player.teams?.name || 'No Team'}
                                      </p>
                                    </div>
                                  </div>
                                  <Check className="w-5 h-5" />
                                </button>
                                <div className="flex flex-col gap-1">
                                  <input 
                                    type="number"
                                    placeholder="#"
                                    min="1"
                                    max="99"
                                    value={entry.shirt_number || ''}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseInt(e.target.value) : null;
                                      if (val !== null && (val < 1 || val > 99)) return;
                                      updatePlayerDetail('away', player.id, { shirt_number: val });
                                    }}
                                    className="w-12 h-1/2 bg-zinc-900 border border-zinc-800 rounded-lg text-center text-xs font-bold focus:border-blue-500 outline-none"
                                  />
                                  <button 
                                    onClick={() => updatePlayerDetail('away', player.id, { lineup_role: 'sub' })}
                                    className="w-12 h-1/2 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-[8px] font-bold uppercase hover:bg-zinc-800"
                                  >
                                    SUB
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Substitutes */}
                      {lineup.away.filter(e => e.lineup_role === 'sub').length > 0 && (
                        <div className="space-y-2 mb-4">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">Substitutes</p>
                          {lineup.away.filter(e => e.lineup_role === 'sub').map(entry => {
                            const player = awayPlayers.find(p => p.id === entry.player_id);
                            if (!player) return null;
                            return (
                              <div key={player.id} className="flex gap-2">
                                <button
                                  onClick={() => togglePlayer('away', player.id)}
                                  className="flex-1 flex items-center justify-between p-4 rounded-xl border bg-zinc-800/50 border-zinc-700 text-zinc-400 transition-all"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-zinc-800">
                                      {entry.shirt_number || '#'}
                                    </div>
                                    <div className="text-left">
                                      <p className="font-bold">{player.full_name}</p>
                                      <p className="text-[10px] uppercase tracking-wider opacity-60">
                                        {player.position} • {player.teams?.name || 'No Team'}
                                      </p>
                                    </div>
                                  </div>
                                  <Check className="w-5 h-5 opacity-40" />
                                </button>
                                <div className="flex flex-col gap-1">
                                  <input 
                                    type="number"
                                    placeholder="#"
                                    min="1"
                                    max="99"
                                    value={entry.shirt_number || ''}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseInt(e.target.value) : null;
                                      if (val !== null && (val < 1 || val > 99)) return;
                                      updatePlayerDetail('away', player.id, { shirt_number: val });
                                    }}
                                    className="w-12 h-1/2 bg-zinc-900 border border-zinc-800 rounded-lg text-center text-xs font-bold focus:border-zinc-500 outline-none"
                                  />
                                  <button 
                                    onClick={() => updatePlayerDetail('away', player.id, { lineup_role: 'starter' })}
                                    className="w-12 h-1/2 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center text-[8px] font-bold uppercase hover:bg-blue-500/20 text-blue-500"
                                  >
                                    START
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Available Players */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-2">Available Pool</p>
                        {awayPlayers.filter(p => !lineup.away.some(e => e.player_id === p.id)).map(player => (
                          <button
                            key={player.id}
                            onClick={() => togglePlayer('away', player.id)}
                            className="w-full flex items-center justify-between p-4 rounded-xl border bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-zinc-800">
                                #
                              </div>
                              <div className="text-left">
                                <p className="font-bold">{player.full_name}</p>
                                <p className="text-[10px] uppercase tracking-wider opacity-60">
                                  {player.position} • {player.teams?.name || 'No Team'}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-6 text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin')}
            className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">MATCH APPEARANCES</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-zinc-500 font-medium text-sm">Assign players who participated in matches</p>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20">
                Upcoming, Live & Finished
              </span>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text"
            placeholder="Search fixtures..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-yellow-500/50 transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Loading matches...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Upcoming Matches Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <h2 className="text-xl font-black italic uppercase tracking-tight text-white">UPCOMING MATCHES</h2>
              </div>
              
              {upcomingFixtures.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl p-8 text-center">
                  <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">No upcoming fixtures found</p>
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
                <h2 className="text-xl font-black italic uppercase tracking-tight text-white">LIVE MATCHES</h2>
              </div>
              
              {liveFixtures.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl p-8 text-center">
                  <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">No live fixtures found</p>
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
                <h2 className="text-xl font-black italic uppercase tracking-tight text-white">FINISHED MATCHES</h2>
              </div>

              {finishedFixtures.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl p-8 text-center">
                  <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">No finished fixtures found</p>
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
