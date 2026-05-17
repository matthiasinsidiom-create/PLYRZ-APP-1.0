import React, { useState, useEffect, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Users, 
  Trophy, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Shield, 
  ChevronRight,
  Plus,
  Minus,
  Trash2,
  Star,
  Check,
  X,
  Calendar,
  Zap,
  Timer,
  Search
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../lib/supabase';
import { getPositionShort } from '../../lib/positions';
import { Fixture, FixtureLineup, MatchEvent, ClubAdmin } from '../../types';
import SafeAreaWrapper from '../../components/SafeAreaWrapper';

interface LineupEntryState {
  player_id: string;
  jersey_number: string;
  lineup_role: 'starter' | 'sub';
}

const PlayerRow = memo(({ 
  player, 
  entry, 
  onToggle, 
  onUpdateDetail,
  disabled
}: { 
  player: any, 
  entry: LineupEntryState | null, 
  onToggle: (id: string) => void,
  onUpdateDetail: (id: string, updates: Partial<LineupEntryState>) => void,
  disabled?: boolean
}) => {
  if (!entry) {
    return (
      <div 
        className={`flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl mb-2 transition-all ${disabled ? 'opacity-50 grayscale pointer-events-none' : 'hover:border-zinc-700 cursor-pointer'}`}
        onClick={() => !disabled && onToggle(player.id)}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-zinc-800 text-zinc-600">#</div>
        <div className="flex-1">
          <p className="font-bold text-white text-sm">{player.full_name}</p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">{getPositionShort(player.position)}</p>
        </div>
        <Plus className="w-4 h-4 text-zinc-700" />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border mb-2 transition-all ${entry.lineup_role === 'starter' ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-zinc-900 border-zinc-800'}`}>
      <div className="flex items-center gap-3 flex-1">
        <button 
          onClick={() => onToggle(player.id)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${entry.lineup_role === 'starter' ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}
        >
          <Check className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-white truncate">{player.full_name}</p>
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">{getPositionShort(player.position)}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={entry.jersey_number}
          onChange={(e) => onUpdateDetail(player.id, { jersey_number: e.target.value })}
          className="w-10 h-10 bg-black border border-zinc-800 rounded-lg text-center text-white font-bold text-sm focus:border-emerald-500 outline-none"
          placeholder="#"
        />
        <select
          value={entry.lineup_role}
          onChange={(e) => onUpdateDetail(player.id, { lineup_role: e.target.value as 'starter' | 'sub' })}
          className="h-10 bg-black border border-zinc-800 rounded-lg text-[9px] font-bold uppercase px-1 text-zinc-400"
        >
          <option value="starter">S</option>
          <option value="sub">B</option>
        </select>
      </div>
    </div>
  );
});

export const TeamAdminMatchControl: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [access, setAccess] = useState<ClubAdmin[]>([]);
  const [managedTeamId, setManagedTeamId] = useState<string | null>(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'lineup' | 'live'>('lineup');
  
  // Lineup State
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [lineup, setLineup] = useState<LineupEntryState[]>([]);
  
  // Event state
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Check Access
      const clubAccess = await supabaseService.getClubAdminAccess();
      const isMainAdmin = await supabaseService.isMainAdmin();
      
      const { data: fixtureData, error: fixtureError } = await supabase
        .from('fixtures')
        .select('*, home_team:home_team_id(*, clubs(*)), away_team:away_team_id(*, clubs(*))')
        .eq('id', id)
        .single();

      if (fixtureError || !fixtureData) throw new Error('Match nicht gefunden');
      setFixture(fixtureData);

      // Determine which team this admin can manage
      let targetTeamId: string | null = null;
      if (isMainAdmin) {
        targetTeamId = fixtureData.home_team_id; // Default to home for super admin in this simplified view
      } else {
        const canManageHome = clubAccess.some(a => a.club_id === fixtureData.home_team?.club_id && (a.team_scope === 'all' || a.team_scope === fixtureData.match_type));
        const canManageAway = clubAccess.some(a => a.club_id === fixtureData.away_team?.club_id && (a.team_scope === 'all' || a.team_scope === fixtureData.match_type));
        
        if (canManageHome) targetTeamId = fixtureData.home_team_id;
        else if (canManageAway) targetTeamId = fixtureData.away_team_id;
        else {
          alert('Keine Berechtigung für dieses Spiel.');
          navigate('/team-admin');
          return;
        }
      }
      setManagedTeamId(targetTeamId);
      setAccess(clubAccess);

      // 2. Load Players & Lineup
      const clubId = targetTeamId === fixtureData.home_team_id ? fixtureData.home_team?.club_id : fixtureData.away_team?.club_id;
      const [players, currentLineup, matchEvents] = await Promise.all([
        supabaseService.getPlayersByClubs([clubId]),
        supabaseService.getFixtureLineup(id!),
        supabaseService.getMatchEvents(id!)
      ]);

      setAllPlayers(players);
      setEvents(matchEvents);
      
      const teamLineup = currentLineup
        .filter(l => l.team_id === targetTeamId)
        .map(l => ({
          player_id: l.player_id,
          jersey_number: (l.jersey_number || '').toString(),
          lineup_role: (l.lineup_role as 'starter' | 'sub') || 'starter'
        }));
      setLineup(teamLineup);

    } catch (err) {
      console.error('Error loading match data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLineup = async () => {
    if (!id || !managedTeamId) return;
    setSaving(true);
    try {
      // For team admin, we only update THEIR team's lineup entries
      // We first fetch all entries for this fixture
      const { data: currentAll } = await supabase
        .from('fixture_lineups')
        .select('*')
        .eq('fixture_id', id);

      const otherTeamEntries = (currentAll || []).filter(l => l.team_id !== managedTeamId);
      
      const myTeamEntries = lineup.map(e => ({
        fixture_id: id,
        team_id: managedTeamId,
        player_id: e.player_id,
        jersey_number: e.jersey_number ? parseInt(e.jersey_number) : null,
        lineup_role: e.lineup_role
      }));

      const finalLineup = [...otherTeamEntries, ...myTeamEntries];
      await supabaseService.updateFixtureLineup(id, finalLineup);
      alert('Aufstellung gespeichert!');
    } catch (err) {
      alert('Fehler beim Speichern: ' + (err as any).message);
    } finally {
      setSaving(false);
    }
  };

  const togglePlayer = (playerId: string) => {
    setLineup(prev => {
      const exists = prev.some(e => e.player_id === playerId);
      if (exists) return prev.filter(e => e.player_id !== playerId);
      
      const player = allPlayers.find(p => p.id === playerId);
      const starterCount = prev.filter(e => e.lineup_role === 'starter').length;
      return [...prev, {
        player_id: playerId,
        jersey_number: (player?.jersey_number || '').toString(),
        lineup_role: starterCount < 11 ? 'starter' : 'sub'
      }];
    });
  };

  const updatePlayerDetail = (playerId: string, updates: Partial<LineupEntryState>) => {
    setLineup(prev => prev.map(e => e.player_id === playerId ? { ...e, ...updates } : e));
  };

  const addEvent = async (type: MatchEvent['event_type'], playerId: string | null = null, extra: any = {}) => {
    if (!id || isSubmittingEvent) return;
    setIsSubmittingEvent(true);
    try {
      const now = new Date();
      // Simple minute calculation
      let minute = 0;
      if (fixture?.status === 'live' && fixture.first_half_started_at) {
        const start = new Date(fixture.first_half_started_at);
        minute = Math.ceil((now.getTime() - start.getTime()) / 60000);
      }

      await supabaseService.addMatchEvent({
        fixture_id: id,
        player_id: playerId,
        team_id: managedTeamId,
        event_type: type,
        minute: minute > 0 ? minute : null,
        ...extra
      });
      
      // Update local state and scores
      if (type === 'goal') {
        if (managedTeamId === fixture?.home_team_id) {
          await supabaseService.updateFixture(id, { home_score: (fixture.home_score || 0) + 1 });
        } else {
          await supabaseService.updateFixture(id, { away_score: (fixture.away_score || 0) + 1 });
        }
      } else if (type === 'opponent_goal') {
        if (managedTeamId === fixture?.home_team_id) {
          await supabaseService.updateFixture(id, { away_score: (fixture.away_score || 0) + 1 });
        } else {
          await supabaseService.updateFixture(id, { home_score: (fixture.home_score || 0) + 1 });
        }
      }

      await loadData(); // Reload for consistency
    } catch (err) {
      alert('Event konnte nicht gespeichert werden.');
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  const handleMatchStatus = async (action: 'start' | 'halftime' | 'second_half' | 'finish') => {
    if (!fixture) return;
    setSaving(true);
    try {
      if (action === 'start') {
        await supabaseService.startMatch(fixture.id);
      } else if (action === 'halftime') {
        await supabaseService.startHalftime(fixture.id);
      } else if (action === 'second_half') {
        await supabaseService.startSecondHalf(fixture.id);
      } else if (action === 'finish') {
        if (confirm('Spiel wirklich beenden?')) {
          await supabaseService.finishMatch(fixture.id);
        }
      }
      await loadData();
    } catch (err) {
      alert('Aktion fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-zinc-500">Laden...</div>;
  if (!fixture) return <div className="p-12 text-center text-zinc-500">Match nicht gefunden.</div>;

  const currentTeamPlayers = lineup.map(l => ({ ...l, player: allPlayers.find(p => p.id === l.player_id) }));
  const starters = currentTeamPlayers.filter(l => l.lineup_role === 'starter');
  const subs = currentTeamPlayers.filter(l => l.lineup_role === 'sub');

  return (
    <SafeAreaWrapper>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="bg-zinc-900 border-b border-white/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/team-admin')} className="p-2 -ml-2 text-zinc-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-tight">Team Admin</p>
              <h1 className="text-sm font-black text-white uppercase italic truncate max-w-[150px]">
                {fixture.home_team?.name} vs {fixture.away_team?.name}
              </h1>
            </div>
          </div>
          <div className="flex bg-black p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('lineup')}
              className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-tight transition-colors ${activeTab === 'lineup' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Kader
            </button>
            <button 
              onClick={() => setActiveTab('live')}
              className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-tight transition-colors ${activeTab === 'live' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Live
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {activeTab === 'lineup' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Deine Aufstellung</h2>
                <div className="text-[10px] font-bold text-emerald-500">
                  {starters.length}/11 STARTELF
                </div>
              </div>

              <div className="space-y-1">
                {starters.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-2">Startelf</p>
                    {starters.map(l => (
                      <PlayerRow key={l.player_id} player={l.player} entry={l} onToggle={togglePlayer} onUpdateDetail={updatePlayerDetail} />
                    ))}
                  </div>
                )}

                {subs.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-2">Ersatz</p>
                    {subs.map(l => (
                      <PlayerRow key={l.player_id} player={l.player} entry={l} onToggle={togglePlayer} onUpdateDetail={updatePlayerDetail} />
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t border-white/5">
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-2">Spielerpool</p>
                  {allPlayers.filter(p => !lineup.some(l => l.player_id === p.id)).map(p => (
                    <PlayerRow key={p.id} player={p} entry={null} onToggle={togglePlayer} onUpdateDetail={updatePlayerDetail} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Scoreboard */}
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 flex flex-col items-center">
                <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">
                  {fixture.status === 'live' ? (fixture.match_phase === 'first_half' ? '1. Halbzeit' : fixture.match_phase === 'halftime' ? 'Halbzeit' : '2. Halbzeit') : 'Bevorstehend'}
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-center space-y-1">
                    <div className="text-4xl font-black italic tracking-tighter">{fixture.home_score ?? 0}</div>
                    <div className="text-[8px] text-zinc-500 uppercase font-bold">{fixture.home_team?.name}</div>
                  </div>
                  <div className="text-xl font-black text-zinc-700">:</div>
                  <div className="text-center space-y-1">
                    <div className="text-4xl font-black italic tracking-tighter">{fixture.away_score ?? 0}</div>
                    <div className="text-[8px] text-zinc-500 uppercase font-bold">{fixture.away_team?.name}</div>
                  </div>
                </div>
              </div>

              {/* Status Controls */}
              <div className="grid grid-cols-2 gap-3">
                {fixture.status === 'upcoming' && (
                  <button onClick={() => handleMatchStatus('start')} className="col-span-2 bg-emerald-500 text-black font-black py-4 rounded-xl uppercase italic tracking-tighter">Spiel starten</button>
                )}
                {fixture.status === 'live' && fixture.match_phase === 'first_half' && (
                  <button onClick={() => handleMatchStatus('halftime')} className="col-span-2 bg-zinc-800 text-white font-black py-4 rounded-xl uppercase italic tracking-tighter">Halbzeit pfeifen</button>
                )}
                {fixture.status === 'live' && fixture.match_phase === 'halftime' && (
                  <button onClick={() => handleMatchStatus('second_half')} className="col-span-2 bg-emerald-500 text-black font-black py-4 rounded-xl uppercase italic tracking-tighter">2. Halbzeit starten</button>
                )}
                {fixture.status === 'live' && fixture.match_phase === 'second_half' && (
                  <button onClick={() => handleMatchStatus('finish')} className="col-span-2 bg-red-500 text-white font-black py-4 rounded-xl uppercase italic tracking-tighter">Abpfiff</button>
                )}
              </div>

              {/* Event Actions */}
              {fixture.status === 'live' && (
                <div className="space-y-4">
                  <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Events Eintragen</h2>
                  
                  <div className="bg-zinc-900 border border-white/5 rounded-2x p-1 space-y-1">
                    {/* Goal & Cards */}
                    <div className="grid grid-cols-2 gap-1 p-2">
                      <button onClick={() => addEvent('goal')} className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-emerald-500 font-bold text-xs uppercase tracking-tight flex items-center justify-center gap-2">
                        <Trophy className="w-4 h-4" /> Eigenes Tor
                      </button>
                      <button onClick={() => addEvent('opponent_goal')} className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 font-bold text-xs uppercase tracking-tight flex items-center justify-center gap-2">
                        <AlertCircle className="w-4 h-4" /> Gegentor
                      </button>
                    </div>

                    <div className="px-4 py-2 border-t border-white/5">
                      <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Spieler-Events</p>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                        {currentTeamPlayers.filter(l => l.player).map(l => (
                          <div key={l.player_id} className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                            <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-[10px] font-bold">#{l.jersey_number}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate">{l.player?.full_name}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => addEvent('goal', l.player_id)} className="w-8 h-8 bg-emerald-500/20 text-emerald-500 rounded-lg flex items-center justify-center hover:bg-emerald-500 hover:text-black transition-colors"><Trophy size={14}/></button>
                              <button onClick={() => addEvent('yellow_card', l.player_id)} className="w-8 h-8 bg-yellow-500/20 text-yellow-500 rounded-lg flex items-center justify-center hover:bg-yellow-500 hover:text-black transition-colors"><div className="w-3 h-4 bg-yellow-500 rounded-sm"/></button>
                              <button onClick={() => addEvent('red_card', l.player_id)} className="w-8 h-8 bg-red-500/20 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-black transition-colors"><div className="w-3 h-4 bg-red-500 rounded-sm"/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Event History */}
              <div className="space-y-3">
                <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Letzte Events</h2>
                {events.filter(e => e.team_id === managedTeamId || e.event_type === 'opponent_goal').slice(0, 5).map(e => (
                  <div key={e.id} className="bg-zinc-900/50 p-3 rounded-xl flex items-center justify-between text-xs border border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500 font-mono">{e.minute}'</span>
                      <span className="font-bold uppercase tracking-tight">
                        {e.event_type === 'goal' ? 'TOR' : e.event_type === 'opponent_goal' ? 'GEGENTOR' : e.event_type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-zinc-600 font-medium">#{e.id.substring(0, 4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Action */}
        {activeTab === 'lineup' && (
          <div className="p-4 border-t border-white/5 bg-zinc-900">
            <button 
              disabled={saving}
              onClick={handleSaveLineup}
              className="w-full bg-emerald-500 text-black font-black py-4 rounded-xl uppercase italic tracking-tighter flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Aufstellung Speichern
            </button>
          </div>
        )}
      </div>
    </SafeAreaWrapper>
  );
};
