import React, { useState, useEffect, useCallback, memo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  MapPin,
  Settings,
  Zap,
  Timer,
  Search,
  ChevronLeft
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../lib/supabase';
import { getPositionShort } from '../../lib/positions';
import { Fixture, FixtureLineup, MatchEvent } from '../../types';
import { calculateMatchScore } from '../../lib/score';
import { useAuth } from '../../context/AuthContext';

interface LineupEntryState {
  player_id: string;
  jersey_number: string;
  lineup_role: 'starter' | 'sub';
}

const AdminMatchControl: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin: isSuperAdmin, clubAdminClubIds } = useAuth();
  
  const isTeamAdminView = location.pathname.startsWith('/team-admin');
  const backPath = isTeamAdminView ? '/team-admin' : '/admin/fixtures';
  
  const [fixture, setFixture] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ checkins: 0, votes: 0 });
  
  // Lineup State
  const [homePlayers, setHomePlayers] = useState<any[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<any[]>([]);
  const [lineup, setLineup] = useState<{ home: LineupEntryState[], away: LineupEntryState[] }>({ home: [], away: [] });
  
  // Events State
  const [events, setEvents] = useState<any[]>([]);
  const [subbingOutPlayerId, setSubbingOutPlayerId] = useState<string | null>(null);

  const isPlayerOnPitch = useCallback((playerId: string) => {
    const entry = [...lineup.home, ...lineup.away].find(l => l.player_id === playerId);
    if (!entry) return false;
    
    let onPitch = entry.lineup_role === 'starter';
    const subs = events.filter(e => e.event_type === 'sub_out' && e.related_player_id);
    
    subs.forEach(sub => {
      if (sub.player_id === playerId) onPitch = false;
      if (sub.related_player_id === playerId) onPitch = true;
    });
    
    return onPitch;
  }, [lineup, events]);
  const [isAddingOpponentGoal, setIsAddingOpponentGoal] = useState<'home' | 'away' | null>(null);
  const [opponentJerseyNumber, setOpponentJerseyNumber] = useState('');
  const [opponentMinute, setOpponentMinute] = useState('');
  
  // UI State
  const [canManageHome, setCanManageHome] = useState(true);
  const [canManageAway, setCanManageAway] = useState(true);
  const [homeHasAdmins, setHomeHasAdmins] = useState(false);
  const [awayHasAdmins, setAwayHasAdmins] = useState(false);
  
  const [activeSection, setActiveSection] = useState<'live' | 'lineups' | 'events' | 'votes' | 'processing'>(() => {
    // Default to lineups if not live, or events/live if live
    return 'lineups';
  });
  const [showLiveGoalModal, setShowLiveGoalModal] = useState(false);
  const [liveGoalTeam, setLiveGoalTeam] = useState<'home' | 'away' | null>(null);
  const [liveGoalFormType, setLiveGoalFormType] = useState<'player' | 'opponent' | null>(null);
  const [assistSelectionPhase, setAssistSelectionPhase] = useState<'scorer' | 'assist'>('scorer');
  const [selectedGoalScorerId, setSelectedGoalScorerId] = useState<string | null>(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [showConfirmProcess, setShowConfirmProcess] = useState(false);
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });
  
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const handleStatusChangeClick = (newStatus: string) => {
    if (newStatus === 'finished' || newStatus === 'cancelled') {
      setPendingStatus(newStatus);
    } else {
      handleUpdateFixture({ status: newStatus as any });
    }
  };

  const confirmStatusChange = () => {
    if (pendingStatus) {
      handleUpdateFixture({ status: pendingStatus as any });
      setPendingStatus(null);
    }
  };

  const cancelStatusChange = () => {
    setPendingStatus(null);
  };

  useEffect(() => {
    if (id) {
      loadMatchData();

      // Realtime subscription for fixture changes
      const fixtureChannel = supabase
        .channel(`fixture_admin:${id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'fixtures', filter: `id=eq.${id}` },
          (payload) => {
            setFixture((prev: any) => ({ ...prev, ...payload.new }));
          }
        )
        .subscribe();

      // Realtime subscription for event changes
      const eventsChannel = supabase
        .channel(`events_admin:${id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'match_events', filter: `fixture_id=eq.${id}` },
          () => {
             // Reload events when they change
             supabaseService.getMatchEvents(id).then(setEvents);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(fixtureChannel);
        supabase.removeChannel(eventsChannel);
      };
    }
  }, [id]);

  const loadMatchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const currentFixture = await supabaseService.getFixtureById(id);
      
      if (!currentFixture) {
        navigate(backPath);
        return;
      }
      
      setFixture(currentFixture);
      
      // Check permission if it's the team admin view
      if (isTeamAdminView && !isSuperAdmin) {
        const canManage = await supabaseService.canManageFixture(id);
        if (!canManage) {
          navigate('/team-admin');
          return;
        }
      }
      
      // Load Lineups with Players to ensure all lineup players are available
      const currentLineup = await supabaseService.getFixtureLineupWithPlayers(id);
      
      // Load Players for both clubs
      const homeClubId = currentFixture.home_team?.club_id;
      const awayClubId = currentFixture.away_team?.club_id;
      
      if (homeClubId && awayClubId) {
        setCanManageHome(isSuperAdmin || clubAdminClubIds.includes(homeClubId));
        setCanManageAway(isSuperAdmin || clubAdminClubIds.includes(awayClubId));
        
        const homeAdmins = await supabaseService.hasClubAdmins(homeClubId);
        const awayAdmins = await supabaseService.hasClubAdmins(awayClubId);
        setHomeHasAdmins(homeAdmins);
        setAwayHasAdmins(awayAdmins);

        const allPlayers = await supabaseService.getPlayersByClubs([homeClubId, awayClubId]);
        
        // Combine allPlayers with players from currentLineup to ensure lineup players are always available
        const lineupPlayers = currentLineup.map(l => (l as any).players).filter(Boolean);
        const mergedPlayers = [...allPlayers];
        
        lineupPlayers.forEach(lp => {
          if (!mergedPlayers.find(p => p.id === lp.id)) {
            mergedPlayers.push(lp);
          }
        });
        
        const homeClubPlayers = mergedPlayers.filter(p => (p as any).teams?.club_id === homeClubId || (p as any).team_id === currentFixture.home_team_id);
        const awayClubPlayers = mergedPlayers.filter(p => (p as any).teams?.club_id === awayClubId || (p as any).team_id === currentFixture.away_team_id);
        
        setHomePlayers(homeClubPlayers);
        setAwayPlayers(awayClubPlayers);
        
        const homeEntries = currentLineup
          .filter(l => l.team_id === currentFixture.home_team_id)
          .map(l => {
            const player = homeClubPlayers.find(p => p.id === l.player_id);
            return {
              player_id: l.player_id,
              player_name: (l as any).players?.full_name || player?.full_name,
              jersey_number: (l.jersey_number || player?.jersey_number || '').toString(),
              lineup_role: (l.lineup_role as 'starter' | 'sub') || 'starter'
            };
          });
        const awayEntries = currentLineup
          .filter(l => l.team_id === currentFixture.away_team_id)
          .map(l => {
            const player = awayClubPlayers.find(p => p.id === l.player_id);
            return {
              player_id: l.player_id,
              player_name: (l as any).players?.full_name || player?.full_name,
              jersey_number: (l.jersey_number || player?.jersey_number || '').toString(),
              lineup_role: (l.lineup_role as 'starter' | 'sub') || 'starter'
            };
          });
        
        setLineup({ home: homeEntries, away: awayEntries });
      }
      
      // Load Events
      const matchEvents = await supabaseService.getMatchEvents(id);
      setEvents(matchEvents);

      // Load Stats
      const matchStats = await supabaseService.getFixtureStats(id);
      setStats(matchStats);

      // Robust score calculation for initialization
      const { homeScore, awayScore } = calculateMatchScore(currentFixture, matchEvents);
      if (currentFixture) {
        currentFixture.home_score = homeScore;
        currentFixture.away_score = awayScore;
      }
      
    } catch (err) {
      console.error('Error loading match data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPlayerName = (id: string | null) => {
    if (!id) return '';
    const p = [...homePlayers, ...awayPlayers].find(p => p.id === id);
    return p ? p.full_name : 'Unknown';
  };

  const handleUpdateFixture = async (updates: Partial<Fixture>) => {
    if (!id) return;
    setSaving(true);
    
    // Initialize scores to 0 if transitioning to live and currently null
    const fixtureUpdates: any = { ...updates };
    if (updates.status === 'live' && fixture) {
      const { homeScore, awayScore } = calculateMatchScore(fixture, events);
      fixtureUpdates.home_score = homeScore;
      fixtureUpdates.away_score = awayScore;
      
      // Auto-start first half if not already started
      if (!fixture.match_phase || fixture.match_phase === 'upcoming') {
        fixtureUpdates.match_phase = 'first_half';
        fixtureUpdates.first_half_started_at = new Date().toISOString();
      }
    }

    if (updates.status === 'finished') {
      const hasHome = (lineup?.home?.length || 0) > 0;
      const hasAway = (lineup?.away?.length || 0) > 0;
      if (!hasHome || !hasAway) {
        fixtureUpdates.voting_open_at = null;
        fixtureUpdates.voting_close_at = null;
        fixtureUpdates.results_processed_at = new Date().toISOString();
        fixtureUpdates.match_phase = 'full_time';
      }
    }

    try {
      const updated = await supabaseService.updateFixture(id, fixtureUpdates);
      setFixture(updated);
      setStatusModal({
        isOpen: true,
        title: 'Erfolg',
        message: updates.status === 'finished' && ((lineup?.home?.length || 0) === 0 || (lineup?.away?.length || 0) === 0)
          ? 'Spiel erfolgreich beendet. Da keine vollständige Aufstellung vorliegt, entfällt das Voting.'
          : 'Spiel erfolgreich aktualisiert.',
        type: 'success'
      });
    } catch (err) {
      console.error('Error updating fixture:', err);
      setStatusModal({
        isOpen: true,
        title: 'Error',
        message: 'Failed to update fixture.',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLineup = async () => {
    if (!id || !fixture) return;
    setSaving(true);
    try {
      const lineupData = [
        ...lineup.home.map(e => ({ 
          fixture_id: id, 
          team_id: fixture.home_team_id, 
          player_id: e.player_id,
          jersey_number: e.jersey_number ? parseInt(e.jersey_number) : null,
          lineup_role: e.lineup_role
        })),
        ...lineup.away.map(e => ({ 
          fixture_id: id, 
          team_id: fixture.away_team_id, 
          player_id: e.player_id,
          jersey_number: e.jersey_number ? parseInt(e.jersey_number) : null,
          lineup_role: e.lineup_role
        }))
      ];
      await supabaseService.updateFixtureLineup(id, lineupData);
      setStatusModal({
        isOpen: true,
        title: 'Success',
        message: 'Lineup saved successfully.',
        type: 'success'
      });
    } catch (err) {
      console.error('Error saving lineup:', err);
      setStatusModal({
        isOpen: true,
        title: 'Error',
        message: 'Failed to save lineup.',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddEvent = async (playerId: string, type: string, relatedPlayerId?: string | null, assistPlayerId?: string | null) => {
    if (!id || !fixture) return;
    
    // Handle Substitution Flow
    if (type === 'sub_out' && !relatedPlayerId) {
      console.log(`DEBUG: Substitution gestartet (player_out_id: ${playerId})`);
      setSubbingOutPlayerId(playerId);
      return;
    }

    // Handle Goal without assist selected yet
    if (type === 'goal' && assistPlayerId === undefined) {
      const isHomeTeam = lineup.home.some(e => e.player_id === playerId);
      setLiveGoalTeam(isHomeTeam ? 'home' : 'away');
      setLiveGoalFormType('player');
      setSelectedGoalScorerId(playerId);
      setAssistSelectionPhase('assist');
      setShowLiveGoalModal(true);
      return;
    }

    let eventType: any = type;
    if (type === 'sub_out' && relatedPlayerId) {
      console.log(`DEBUG: Auswahl player_in_id: ${relatedPlayerId}`);
    }

    const isHome = lineup.home.some(l => l.player_id === playerId);
    const teamId = isHome ? fixture.home_team_id : fixture.away_team_id;

    const tempId = `temp-${Math.random().toString(36).substring(7)}`;
    const newEvent = {
      id: tempId,
      fixture_id: id,
      team_id: teamId,
      player_id: playerId,
      event_type: eventType,
      related_player_id: relatedPlayerId,
      assist_player_id: assistPlayerId,
      created_at: new Date().toISOString()
    };
    
    // We calculate updatedEvents first to avoid stale state in score calculation
    const updatedEvents = [...events, newEvent];
    setEvents(updatedEvents);
    
    // Update score if goal
    if (eventType === 'goal') {
      setFixture((prev: any) => {
        if (!prev) return prev;
        const { homeScore, awayScore } = calculateMatchScore(prev, updatedEvents);
        
        supabaseService.updateFixture(id, { 
          home_score: homeScore,
          away_score: awayScore
        }).catch(err => {
          console.error(`Error updating score in DB:`, err);
        });
        
        return { ...prev, home_score: homeScore, away_score: awayScore };
      });
    }

    try {
      const created = await supabaseService.createMatchEvent({
        fixture_id: id,
        team_id: teamId,
        player_id: playerId,
        event_type: eventType,
        related_player_id: relatedPlayerId,
        assist_player_id: assistPlayerId
      });
      setEvents(prev => prev.map(e => e.id === tempId ? created : e));
      
      if (eventType === 'sub_out' && relatedPlayerId) {
        console.log(`DEBUG: Substitution gespeichert (out: ${playerId}, in: ${relatedPlayerId})`);
        // We'll trust the realtime update for the log of on-pitch players if needed, 
        // but let's log current state for debug
        const updatedOnPitch = [...lineup.home, ...lineup.away].filter(l => {
           let onPitch = l.lineup_role === 'starter';
           const allEvents = [...events, created];
           const playerSubs = allEvents.filter(e => e.event_type === 'sub_out' && e.related_player_id);
           playerSubs.forEach(sub => {
             if (sub.player_id === l.player_id) onPitch = false;
             if (sub.related_player_id === l.player_id) onPitch = true;
           });
           return onPitch;
        }).length;
        console.log(`DEBUG: Aktive Spieler nach Update: ${updatedOnPitch}`);
      }
    } catch (err) {
      console.error('Error adding event:', err);
      setEvents(prev => prev.filter(e => e.id !== tempId));
    }

    if (type === 'sub_out') {
      setSubbingOutPlayerId(null);
    }
  };

  const handleRemoveEvent = async (playerId: string, eventType: string) => {
    const eventToRemove = [...events].reverse().find(e => e.player_id === playerId && e.event_type === eventType);
    if (eventToRemove) {
      await handleDeleteEvent(eventToRemove.id);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!id || !fixture) return;
    
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    console.log(`DEBUG: Event gelöscht (ID: ${eventId}, Type: ${event.event_type})`);
    console.log(`DEBUG: Recalculation gestartet`);

    const originalEvents = [...events];
    const updatedEvents = originalEvents.filter(e => e.id !== eventId);
    setEvents(updatedEvents);
    
    if (event.event_type === 'goal' || event.event_type === 'opponent_goal') {
      setFixture((prev: any) => {
        if (!prev) return prev;
        const { homeScore, awayScore } = calculateMatchScore(prev, updatedEvents);
        
        supabaseService.updateFixture(id, { 
          home_score: homeScore,
          away_score: awayScore
        }).catch(err => {
          console.error(`Error reverting score in DB:`, err);
        });
        
        return { ...prev, home_score: homeScore, away_score: awayScore };
      });
    }
    
    try {
      if (!eventId.toString().startsWith('temp-')) {
        await supabaseService.deleteMatchEvent(eventId);
      }
    } catch (err) {
      console.error('Error deleting event:', err);
      setEvents(originalEvents);
    }
  };

  const handleProcessResults = async () => {
    if (!id) return;
    setSaving(true);
    let originalError: any = null;
    
    try {
      await supabaseService.processFixtureRatings(id);
    } catch (err: any) {
      console.warn('Error processing ratings, verifying if results exist anyway:', err);
      originalError = err;
    }
    
    try {
      // Add a small delay to allow DB processing to finish if API timed out but started
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const updatedFixture = await supabaseService.getFixtureById(id);
      let resultsExist = !!updatedFixture.results_processed_at;
      
      if (!resultsExist) {
        const { data, error } = await supabase
          .from('player_rating_history')
          .select('id')
          .eq('fixture_id', id)
          .limit(1);
        if (!error && data && data.length > 0) {
          resultsExist = true;
        }
      }

      if (resultsExist) {
        setStatusModal({
          isOpen: true,
          title: 'Processing Complete',
          message: 'Ratings processed successfully.',
          type: 'success'
        });
        await loadMatchData();
      } else {
        console.error('Error processing ratings:', originalError);
        setStatusModal({
          isOpen: true,
          title: 'Processing Failed',
          message: originalError?.message || 'Failed to process ratings.',
          type: 'error'
        });
      }
    } catch (refreshErr) {
      console.error('Error checking processing status:', refreshErr);
      if (originalError) {
        setStatusModal({
          isOpen: true,
          title: 'Processing Failed',
          message: originalError?.message || 'Failed to process ratings.',
          type: 'error'
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOpponentGoal = async (teamType: 'home' | 'away', eventId: string) => {
    await handleDeleteEvent(eventId);
  };

  const handleAddOpponentGoal = async (teamType: 'home' | 'away') => {
    if (!id || !fixture) return;
    
    const teamId = teamType === 'home' ? fixture.home_team_id : fixture.away_team_id;
    const jersey = opponentJerseyNumber;
    const minute = parseInt(opponentMinute) || null;

    const tempId = `temp-${Math.random().toString(36).substring(7)}`;
    const newEvent = {
      id: tempId,
      fixture_id: id,
      team_id: teamId,
      player_id: null,
      event_type: 'opponent_goal',
      opponent_jersey_number: jersey,
      minute: minute,
      created_at: new Date().toISOString()
    };
    
    const updatedEvents = [...events, newEvent];
    setEvents(updatedEvents);

    // Update score
    setFixture((prev: any) => {
      if (!prev) return prev;
      const { homeScore, awayScore } = calculateMatchScore(prev, updatedEvents);

      // DB update
      supabaseService.updateFixture(id, { 
        home_score: homeScore,
        away_score: awayScore 
      }).catch(err => {
        console.error('Error updating opponent goal in DB:', err);
      });

      return { ...prev, home_score: homeScore, away_score: awayScore };
    });

    try {
      const created = await supabaseService.createMatchEvent({
        fixture_id: id,
        team_id: teamId,
        event_type: 'opponent_goal',
        opponent_jersey_number: jersey,
        minute: minute
      });
      setEvents(prev => prev.map(e => e.id === tempId ? created : e));
      
      // Reset state
      setIsAddingOpponentGoal(null);
      setOpponentJerseyNumber('');
      setOpponentMinute('');
    } catch (err) {
      console.error('Error adding opponent goal:', err);
      setEvents(prev => prev.filter(e => e.id !== tempId));
      // Revert score locally if DB error (though the update is non-blocking above, we could sync here)
    }
  };

  const togglePlayer = useCallback((team: 'home' | 'away', playerId: string) => {
    setLineup(prev => {
      const current = prev[team];
      const isAlreadyIn = current.some(e => e.player_id === playerId);

      if (isAlreadyIn) {
        return { ...prev, [team]: current.filter(e => e.player_id !== playerId) };
      } else {
        const starterCount = current.filter(e => e.lineup_role === 'starter').length;
        const playerPool = team === 'home' ? homePlayers : awayPlayers;
        const player = playerPool.find(p => p.id === playerId);
        const newEntry: LineupEntryState = {
          player_id: playerId,
          jersey_number: (player?.jersey_number ?? '').toString(),
          lineup_role: starterCount < 11 ? 'starter' : 'sub'
        };
        return { ...prev, [team]: [...current, newEntry] };
      }
    });
  }, [homePlayers, awayPlayers]);

  const updatePlayerDetail = useCallback((team: 'home' | 'away', playerId: string, updates: Partial<LineupEntryState>) => {
    setLineup(prev => ({
      ...prev,
      [team]: prev[team].map(e => e.player_id === playerId ? { ...e, ...updates } : e)
    }));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!fixture) return null;

  const isProcessed = !!fixture.results_processed_at;
  const hasHomeLineup = lineup.home.length >= 11;
  const hasAwayLineup = lineup.away.length >= 11;
  const hasScore = fixture.home_score !== null && fixture.away_score !== null;
  const hasEvents = events.length > 0;
  // Allow processing if lineups and score exist. 
  // If already processed, the button will act as "Re-process".
  const canProcess = hasHomeLineup && hasAwayLineup && hasScore;

  return (
    <div className="min-h-screen bg-transparent p-4 pb-24 text-white font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(backPath)}
            className="p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{fixture.leagues?.name}</p>
            <h1 className="text-xl font-black italic uppercase tracking-tighter">SPIELSTEUERUNG</h1>
          </div>
          <button 
            onClick={() => loadMatchData()}
            className="p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl"
          >
            <Clock className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Fixture Card */}
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 text-center space-y-2">
              <div className="w-12 h-12 bg-zinc-800 rounded-2xl mx-auto flex items-center justify-center">
                <Shield className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="font-bold text-sm uppercase italic tracking-tight">{fixture.home_team?.clubs?.name}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{fixture.home_team?.name}</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <input 
                  type="number"
                  value={fixture.home_score ?? ''}
                  onChange={(e) => setFixture({ ...fixture, home_score: e.target.value === '' ? null : parseInt(e.target.value) })}
                  onBlur={(e) => handleUpdateFixture({ home_score: e.target.value === '' ? null : parseInt(e.target.value) })}
                  className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl text-center text-xl font-black focus:border-emerald-500 outline-none"
                  placeholder="-"
                />
                <span className="text-zinc-700 font-black">:</span>
                <input 
                  type="number"
                  value={fixture.away_score ?? ''}
                  onChange={(e) => setFixture({ ...fixture, away_score: e.target.value === '' ? null : parseInt(e.target.value) })}
                  onBlur={(e) => handleUpdateFixture({ away_score: e.target.value === '' ? null : parseInt(e.target.value) })}
                  className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl text-center text-xl font-black focus:border-emerald-500 outline-none"
                  placeholder="-"
                />
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                fixture.status === 'live' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                fixture.status === 'finished' ? 'bg-zinc-800 text-zinc-500 border-zinc-700' :
                'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              }`}>
                {fixture.status}
              </span>
            </div>

            <div className="flex-1 text-center space-y-2">
              <div className="w-12 h-12 bg-zinc-800 rounded-2xl mx-auto flex items-center justify-center">
                <Shield className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="font-bold text-sm uppercase italic tracking-tight">{fixture.away_team?.clubs?.name}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{fixture.away_team?.name}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
            <div className="flex items-center gap-2 text-zinc-500">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-bold">{new Date(fixture.kickoff_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-500 justify-end">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold">{new Date(fixture.kickoff_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        {/* Live Match Screen - Primary Workflow Controls */}
        {fixture.status === 'live' && (
          <div className="bg-black/40 backdrop-blur-md border border-amber-500/30 rounded-3xl p-6 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
            {console.log('MatchControl: Rendering Live Match Control area')}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-amber-500 text-black rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black italic uppercase tracking-tighter leading-none">Live Match-Steuerung</h2>
                <p className="text-[10px] font-bold text-amber-500/60 uppercase tracking-widest mt-1">Primäre Live-Aktionen</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tor Eigenes Team - Player selection */}
              <button 
                onClick={() => {
                  console.log('Live own-team goal button clicked');
                  setLiveGoalTeam('home');
                  setLiveGoalFormType('player');
                  setAssistSelectionPhase('scorer');
                  setSelectedGoalScorerId(null);
                  setShowLiveGoalModal(true);
                }}
                className="p-6 bg-emerald-500 hover:bg-emerald-400 text-black rounded-3xl flex items-center gap-4 transition-all active:scale-[0.98] shadow-xl shadow-emerald-500/10 group overflow-hidden relative"
              >
                 <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform">
                   <Trophy className="w-16 h-16 -mr-4 -mt-4" />
                 </div>
                 <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center shrink-0">
                   <Trophy className="w-6 h-6" />
                 </div>
                 <div className="text-left">
                   <p className="text-sm font-black uppercase italic tracking-tighter">Tor {fixture.home_team?.clubs?.name || 'Eigenes Team'}</p>
                   <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Spielerauswahl</p>
                 </div>
              </button>

              {/* Tor Gegner - Lightweight selection */}
              <button 
                onClick={() => {
                  console.log('Opponent goal button clicked');
                  console.log('Opening Lightweight Opponent Goal form');
                  setLiveGoalTeam('away');
                  setLiveGoalFormType('opponent');
                  setShowLiveGoalModal(true);
                  setIsAddingOpponentGoal('away');
                }}
                className="p-6 bg-zinc-900 border border-white/10 text-white rounded-3xl flex items-center gap-4 transition-all active:scale-[0.98] hover:bg-zinc-800 shadow-xl group overflow-hidden relative"
              >
                 <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:scale-110 transition-transform">
                   <Plus className="w-16 h-16 -mr-4 -mt-4 text-emerald-500" />
                 </div>
                 <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center shrink-0">
                   <Plus className="w-6 h-6 text-emerald-500" />
                 </div>
                 <div className="text-left">
                   <p className="text-sm font-black uppercase italic tracking-tighter">Tor Gegner</p>
                   <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Schnelleingabe</p>
                 </div>
              </button>
            </div>

            {events.length > 0 && (
              <div className="mt-6 pt-6 border-t border-white/5">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Letzte Ereignisse</span>
                  <button 
                    onClick={() => setActiveSection('events')}
                    className="text-[8px] font-black text-emerald-500 uppercase tracking-widest"
                  >
                    Alle anzeigen
                  </button>
                </div>
                <div className="space-y-1.5 text-left">
                  {events.slice(-3).reverse().map(event => (
                    <div key={event.id} className="flex items-center justify-between p-2.5 bg-zinc-900/50 rounded-xl border border-white/5">
                      <div className="flex items-center gap-2 text-left">
                        <span className="text-[10px]">{event.event_type === 'goal' || event.event_type === 'opponent_goal' ? '⚽' : '🎫'}</span>
                        <span className="text-[9px] font-black italic text-zinc-500">{event.minute || '??'}'</span>
                        <span className="text-[10px] font-black italic uppercase text-zinc-300">
                          {event.event_type === 'opponent_goal' ? (
                            `Tor Gegner #${event.opponent_jersey_number || '?'}`
                          ) : (event.event_type === 'sub_out' && event.related_player_id) ? (
                            <span className="flex items-center gap-1">
                              <span className="text-red-500">Aus:</span> {getPlayerName(event.player_id)}
                              <span className="text-zinc-600 mx-1">/</span>
                              <span className="text-emerald-500">Ein:</span> {getPlayerName(event.related_player_id)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              {getPlayerName(event.player_id)}
                              {event.assist_player_id && (
                                <span className="text-zinc-500 font-bold ml-1 text-[8px]">(Assist: {getPlayerName(event.assist_player_id)})</span>
                              )}
                            </span>
                          )}
                        </span>
                      </div>
                      {(() => {
                        const isOpponentGoalFallback = event.event_type === 'opponent_goal' && !event.player_id;
                        const canManageEvent = isSuperAdmin || isOpponentGoalFallback ||
                          (event.team_id === fixture.home_team_id ? (canManageHome || (!canManageHome && !homeHasAdmins)) : 
                          event.team_id === fixture.away_team_id ? (canManageAway || (!canManageAway && !awayHasAdmins)) : false);
                        
                        return canManageEvent ? (
                          <button 
                            onClick={() => event.event_type === 'opponent_goal' ? handleRemoveOpponentGoal(event.team_id === fixture.home_team_id ? 'home' : 'away', event.id) : handleRemoveEvent(event.player_id, event.event_type)}
                            className="p-1 hover:bg-red-500/10 rounded group transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-zinc-700 group-hover:text-red-500" />
                          </button>
                        ) : (
                          <div className="p-1 px-2 bg-zinc-800/50 rounded-lg" title="Dieses Ereignis gehört zur gegnerischen Mannschaft und kann nur vom zuständigen Clubadmin bearbeitet werden.">
                            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Nur Lesezugriff</span>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hub Sections */}
        <div className="grid grid-cols-1 gap-4">
          {/* 1. Lineups Hub */}
          <HubCard 
            title="Aufstellungen" 
            icon={<Users className="w-5 h-5" />}
            status={hasHomeLineup && hasAwayLineup ? 'complete' : 'pending'}
            isActive={activeSection === 'lineups'}
            onClick={() => setActiveSection('lineups')}
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TeamLineupSelector 
                  teamName={fixture.home_team?.name}
                  players={homePlayers}
                  selectedLineup={lineup.home}
                  onToggle={(id) => togglePlayer('home', id)}
                  onUpdateDetail={(id, updates) => updatePlayerDetail('home', id, updates)}
                  color="emerald"
                />
                <TeamLineupSelector 
                  teamName={fixture.away_team?.name}
                  players={awayPlayers}
                  selectedLineup={lineup.away}
                  onToggle={(id) => togglePlayer('away', id)}
                  onUpdateDetail={(id, updates) => updatePlayerDetail('away', id, updates)}
                  color="blue"
                />
              </div>
              <button 
                onClick={handleSaveLineup}
                disabled={saving}
                className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                AUFSTELLUNG SPEICHERN
              </button>
            </div>
          </HubCard>

          {/* 2. Match Events Hub */}
          <HubCard 
            title="Spielereignisse" 
            icon={<Trophy className="w-5 h-5" />}
            status={hasEvents ? 'complete' : 'pending'}
            isActive={activeSection === 'events'}
            onClick={() => setActiveSection('events')}
          >
            <div className="space-y-8">
              {/* Home Team */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1 h-3 bg-emerald-500 rounded-full" />
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{fixture.home_team?.name}</h4>
                </div>
                <div className="space-y-2">
                  {lineup.home.map(entry => {
                    const player = homePlayers.find(p => p.id === entry.player_id) || {
                      id: entry.player_id,
                      full_name: (entry as any).player_name || 'Spieler unbekannt',
                      position: 'Unbekannt'
                    };
                    const currentlyOnPitch = isPlayerOnPitch(player.id);
                    
                    if (subbingOutPlayerId && currentlyOnPitch && subbingOutPlayerId !== player.id) return null;

                    return (
                      <PlayerEventRow 
                        key={player.id}
                        player={player}
                        events={events.filter(e => e.player_id === player.id || e.related_player_id === player.id)}
                        onAdd={handleAddEvent}
                        onRemove={handleRemoveEvent}
                        currentlyOnPitch={currentlyOnPitch}
                        isSubbingMode={!!subbingOutPlayerId}
                        subbingOutPlayerId={subbingOutPlayerId}
                        readOnly={!canManageHome}
                      />
                    );
                  })}

                  {/* Opponent Goal Actions for Home */}
                  {!canManageHome && homeHasAdmins && (
                    <div className="p-2 mb-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <p className="text-[9px] text-blue-400 text-center leading-relaxed font-bold">
                        Gegner nutzt PLYRZ. Gegner-Tore werden hier als Teamtore ohne Spielerwertung als Fallback erfasst.
                      </p>
                    </div>
                  )}
                  <OpponentGoalSection 
                    teamType="home"
                    isAdding={isAddingOpponentGoal === 'home'}
                    jerseyNumber={opponentJerseyNumber}
                    minute={opponentMinute}
                    events={events.filter(e => e.event_type === 'opponent_goal' && e.team_id === fixture.home_team_id)}
                    onStartAdd={() => setIsAddingOpponentGoal('home')}
                    onCancel={() => setIsAddingOpponentGoal(null)}
                    onJerseyChange={setOpponentJerseyNumber}
                    onMinuteChange={setOpponentMinute}
                    onAdd={() => handleAddOpponentGoal('home')}
                    onRemove={(eventId) => handleRemoveOpponentGoal('home', eventId)}
                  />
                </div>
              </div>

              {/* Away Team */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1 h-3 bg-blue-500 rounded-full" />
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{fixture.away_team?.name}</h4>
                </div>
                <div className="space-y-2">
                  {lineup.away.map(entry => {
                    const player = awayPlayers.find(p => p.id === entry.player_id) || {
                      id: entry.player_id,
                      full_name: (entry as any).player_name || 'Spieler unbekannt',
                      position: 'Unbekannt'
                    };
                    const currentlyOnPitch = isPlayerOnPitch(player.id);

                    if (subbingOutPlayerId && currentlyOnPitch && subbingOutPlayerId !== player.id) return null;

                    return (
                      <PlayerEventRow 
                        key={player.id}
                        player={player}
                        events={events.filter(e => e.player_id === player.id || e.related_player_id === player.id)}
                        onAdd={handleAddEvent}
                        onRemove={handleRemoveEvent}
                        currentlyOnPitch={currentlyOnPitch}
                        isSubbingMode={!!subbingOutPlayerId}
                        subbingOutPlayerId={subbingOutPlayerId}
                        readOnly={!canManageAway}
                      />
                    );
                  })}
                  
                  {/* Opponent Goal Actions for Away */}
                  {!canManageAway && awayHasAdmins && (
                    <div className="p-2 mb-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <p className="text-[9px] text-blue-400 text-center leading-relaxed font-bold">
                        Gegner nutzt PLYRZ. Gegner-Tore werden hier als Teamtore ohne Spielerwertung als Fallback erfasst.
                      </p>
                    </div>
                  )}
                  <OpponentGoalSection 
                    teamType="away"
                    isAdding={isAddingOpponentGoal === 'away'}
                    jerseyNumber={opponentJerseyNumber}
                    minute={opponentMinute}
                    events={events.filter(e => e.event_type === 'opponent_goal' && e.team_id === fixture.away_team_id)}
                    onStartAdd={() => setIsAddingOpponentGoal('away')}
                    onCancel={() => setIsAddingOpponentGoal(null)}
                    onJerseyChange={setOpponentJerseyNumber}
                    onMinuteChange={setOpponentMinute}
                    onAdd={() => handleAddOpponentGoal('away')}
                    onRemove={(eventId) => handleRemoveOpponentGoal('away', eventId)}
                  />
                </div>
              </div>
            </div>
          </HubCard>

          {/* 3. Votes & Status Hub */}
          <HubCard 
            title="Votes & Status" 
            icon={<Star className="w-5 h-5" />}
            status={fixture.status === 'finished' ? 'complete' : 'pending'}
            isActive={activeSection === 'votes'}
            onClick={() => setActiveSection('votes')}
          >
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 space-y-1">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Spielstatus</p>
                  <select 
                    value={fixture.status}
                    onChange={(e) => handleStatusChangeClick(e.target.value)}
                    className="w-full bg-transparent font-black italic uppercase tracking-tighter text-lg outline-none"
                  >
                    <option value="upcoming">Anstehend</option>
                    <option value="live">Live</option>
                    <option value="finished">Beendet</option>
                    <option value="cancelled">Abgebrochen</option>
                  </select>
                </div>
                <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 space-y-1">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Abstimmungsfenster</p>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">
                      {fixture.voting_open_at ? new Date(fixture.voting_open_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Nicht gesetzt'}
                    </span>
                    <span className="text-[10px] text-zinc-600">bis</span>
                    <span className="text-xs font-bold text-white">
                      {fixture.voting_close_at ? new Date(fixture.voting_close_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Nicht gesetzt'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-emerald-500">Voting Aktivität</h4>
                  <span className="px-2 py-0.5 bg-emerald-500 text-black text-[10px] font-black rounded-full">LIVE</span>
                </div>
                <div className="flex items-center justify-around text-center">
                  <div>
                    <p className="text-2xl font-black italic tracking-tighter">{stats.checkins}</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Check-ins</p>
                  </div>
                  <div className="w-px h-8 bg-zinc-800" />
                  <div>
                    <p className="text-2xl font-black italic tracking-tighter">{stats.votes}</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Stimmen gesamt</p>
                  </div>
                </div>
              </div>
            </div>
          </HubCard>

          {/* 4. Processing & Results Hub */}
          <HubCard 
            title="Verarbeitung & Ergebnisse" 
            icon={<Settings className="w-5 h-5" />}
            status={isProcessed ? 'complete' : 'pending'}
            isActive={activeSection === 'processing'}
            onClick={() => setActiveSection('processing')}
          >
            <div className="space-y-6">
              <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">Pre-Processing Checkliste</h4>
                <div className="space-y-3">
                  <ChecklistItem label="Ergebnis eingetragen" checked={hasScore} />
                  <ChecklistItem label="Aufstellung Heim (min. 11)" checked={hasHomeLineup} />
                  <ChecklistItem label="Aufstellung Auswärts (min. 11)" checked={hasAwayLineup} />
                  <ChecklistItem label="Spielereignisse erfasst" checked={hasEvents} />
                  <ChecklistItem label="Spielergebnisse noch nicht verarbeitet" checked={!isProcessed} />
                </div>
              </div>

              {isProcessed ? (
                <div className="space-y-3">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    <div>
                      <p className="text-sm font-bold text-white">Ergebnisse verarbeitet</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                        {new Date(fixture.results_processed_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => navigate(`/matches/${id}/result`)}
                      className="bg-zinc-800 text-white font-bold py-4 rounded-2xl text-xs uppercase tracking-widest"
                    >
                      ERGEBNISSE ANSEHEN
                    </button>
                    <button 
                      onClick={handleProcessResults}
                      disabled={saving}
                      className="bg-red-500/10 text-red-500 font-bold py-4 rounded-2xl text-xs uppercase tracking-widest border border-red-500/20"
                    >
                      NEU VERARBEITEN
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setShowConfirmProcess(true)}
                  disabled={!canProcess || saving}
                  className={`w-full font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all ${
                    canProcess 
                      ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                      : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Trophy className="w-6 h-6" />}
                  <span className="uppercase tracking-tighter italic text-lg">JETZT BERECHNEN</span>
                </button>
              )}
              
              {!canProcess && !isProcessed && (
                <p className="text-center text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                  Fülle alle Punkte der Checkliste aus, um die Verarbeitung zu aktivieren
                </p>
              )}
            </div>
          </HubCard>
        </div>
      </div>

      {/* Live Goal Modal */}
      <AnimatePresence>
        {showLiveGoalModal && (
          <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-zinc-900 border border-white/10 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-950/30">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${liveGoalFormType === 'player' ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black italic uppercase tracking-tighter">
                      {liveGoalFormType === 'player' 
                        ? (assistSelectionPhase === 'scorer' ? 'Torschütze' : 'Assistgeber')
                        : 'Tor Gegner'}
                    </h3>
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                      {liveGoalTeam === 'home' ? fixture.home_team?.clubs?.name : fixture.away_team?.clubs?.name}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowLiveGoalModal(false);
                    setIsAddingOpponentGoal(null);
                    setAssistSelectionPhase('scorer');
                    setSelectedGoalScorerId(null);
                  }}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="p-6">
                {liveGoalFormType === 'opponent' ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Rückennummer</label>
                        <input 
                          type="text" 
                          placeholder="#"
                          value={opponentJerseyNumber}
                          onChange={(e) => setOpponentJerseyNumber(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded-2xl px-5 py-4 text-xl font-black italic focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-800"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Minute</label>
                        <input 
                          type="text" 
                          placeholder="Min"
                          value={opponentMinute}
                          onChange={(e) => setOpponentMinute(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded-2xl px-5 py-4 text-xl font-black italic focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-800"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                      <button 
                        onClick={() => handleAddOpponentGoal(liveGoalTeam!)}
                        disabled={!opponentMinute || saving}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black italic uppercase tracking-tighter py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 text-lg"
                      >
                        {saving ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'TOR SPEICHERN'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      <input 
                        type="text"
                        placeholder="Spieler suchen..."
                        value={playerSearchQuery}
                        onChange={(e) => setPlayerSearchQuery(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-2xl px-12 py-4 text-sm font-bold focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>

                    <div className="max-h-[350px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                      {assistSelectionPhase === 'assist' && (
                        <button
                          onClick={() => {
                            handleAddEvent(selectedGoalScorerId!, 'goal', null, null);
                            setShowLiveGoalModal(false);
                            setAssistSelectionPhase('scorer');
                            setSelectedGoalScorerId(null);
                          }}
                          className="w-full mb-4 flex items-center justify-center p-4 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-2xl transition-all group active:scale-[0.98]"
                        >
                          <span className="text-[12px] font-black uppercase italic text-zinc-300 group-hover:text-white transition-colors">Kein Assist</span>
                        </button>
                      )}

                      {(liveGoalTeam === 'home' ? lineup.home : lineup.away).map(entry => {
                        const player = (liveGoalTeam === 'home' ? homePlayers : awayPlayers).find(p => p.id === entry.player_id) || {
                          id: entry.player_id,
                          full_name: (entry as any).player_name || 'Spieler unbekannt',
                          position: 'Unbekannt'
                        };
                        if (playerSearchQuery && !player.full_name.toLowerCase().includes(playerSearchQuery.toLowerCase())) return null;
                        if (assistSelectionPhase === 'assist' && player.id === selectedGoalScorerId) return null;

                        return (
                          <button
                            key={player.id}
                            onClick={() => {
                              if (assistSelectionPhase === 'scorer') {
                                setSelectedGoalScorerId(player.id);
                                setAssistSelectionPhase('assist');
                                setPlayerSearchQuery('');
                              } else {
                                handleAddEvent(selectedGoalScorerId!, 'goal', null, player.id);
                                setShowLiveGoalModal(false);
                                setAssistSelectionPhase('scorer');
                                setSelectedGoalScorerId(null);
                              }
                            }}
                            className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 rounded-2xl transition-all group active:scale-[0.98]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-400 group-hover:text-emerald-500 transition-colors">
                                #{entry.jersey_number || '?'}
                              </div>
                              <div className="text-left">
                                <p className="text-[11px] font-black uppercase italic text-white group-hover:text-emerald-400 transition-colors">{player.full_name}</p>
                                <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{getPositionShort(player.position)}</p>
                              </div>
                            </div>
                            <Plus className="w-4 h-4 text-zinc-700 group-hover:text-emerald-500 transition-colors" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Status Modal */}
      <AnimatePresence>
        {statusModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex justify-center p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center space-y-6 my-auto"
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                statusModal.type === 'success' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'
              }`}>
                {statusModal.type === 'success' ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
              </div>
              <div>
                <h3 className="text-xl font-black italic uppercase tracking-tight">{statusModal.title}</h3>
                <p className="text-zinc-400 text-sm mt-2">{statusModal.message}</p>
              </div>
              <button 
                onClick={() => setStatusModal({ ...statusModal, isOpen: false })}
                className="w-full bg-white text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs"
              >
                WEITER
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Status Confirmation Modal */}
      <AnimatePresence>
        {pendingStatus && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-white/10 rounded-[2.5rem] p-8 max-w-sm w-full relative overflow-hidden shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
              
              <div className="relative flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-3xl bg-blue-500/20 flex items-center justify-center mb-6">
                  <AlertCircle className="w-8 h-8 text-blue-500" />
                </div>
                
                <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2">Spielstatus ändern?</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-8">
                  Möchtest du den Status wirklich auf <span className="text-white font-bold">{pendingStatus === 'finished' ? 'Beendet' : 'Abgebrochen'}</span> setzen? 
                  {pendingStatus === 'finished' ? (
                    ((lineup?.home?.length || 0) === 0 || (lineup?.away?.length || 0) === 0)
                      ? ' Da nicht für beide Mannschaften Aufstellungen hinterlegt sind, wird das Spiel direkt als beendet gewertet und kein Voting gestartet.'
                      : ' Die Abstimmung für Spieler des Spiels wird gestartet.'
                  ) : ' Keine Ergebnisse werden gewertet.'}
                </p>
                
                <div className="flex flex-col gap-3 w-full">
                  <button 
                    onClick={confirmStatusChange}
                    className="w-full h-12 bg-blue-500 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-blue-600 transition-colors"
                  >
                    Bestätigen
                  </button>
                  <button 
                    onClick={cancelStatusChange}
                    className="w-full h-12 bg-white/5 text-white font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-white/10 transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmProcess && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full space-y-6 relative overflow-hidden"
            >
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 blur-[100px]" />
              
              <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="p-3 bg-blue-500/10 rounded-2xl">
                    <Trophy className="w-6 h-6 text-blue-500" />
                  </div>
                  <button 
                    onClick={() => setShowConfirmProcess(false)}
                    className="p-2 text-zinc-500 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">
                    Ergebnisse Berechnen?
                  </h2>
                  <p className="text-zinc-400 font-medium leading-relaxed">
                    Bist du sicher, dass du die Resultate für dieses Spiel jetzt berechnen möchtest? Dies aktualisiert die Spieler-Ratings und kann nicht rückgängig gemacht werden.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setShowConfirmProcess(false);
                      handleProcessResults();
                    }}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                  >
                    JETZT BERECHNEN
                  </button>
                  <button
                    onClick={() => setShowConfirmProcess(false)}
                    className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all border border-white/5"
                  >
                    ABBRECHEN
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Helper Components
const HubCard: React.FC<{ 
  title: string; 
  icon: React.ReactNode; 
  status: 'complete' | 'pending'; 
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, icon, status, isActive, onClick, children }) => (
  <div className={`bg-black/40 backdrop-blur-md border rounded-3xl transition-all overflow-hidden ${
    isActive ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-white/10'
  }`}>
    <button 
      onClick={onClick}
      className="w-full p-6 flex items-center justify-between group"
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl transition-colors ${
          isActive ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700'
        }`}>
          {icon}
        </div>
        <div className="text-left">
          <h3 className="text-lg font-black italic uppercase tracking-tight">{title}</h3>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${status === 'complete' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-widest ${status === 'complete' ? 'text-emerald-500' : 'text-amber-500'}`}>
              {status === 'complete' ? 'DONE' : 'PENDING'}
            </span>
          </div>
        </div>
      </div>
      <ChevronRight className={`w-5 h-5 transition-transform ${isActive ? 'rotate-90 text-emerald-500' : 'text-zinc-700'}`} />
    </button>
    
    <AnimatePresence>
      {isActive && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-6 pb-6"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const TeamLineupSelector: React.FC<{
  teamName: string;
  players: any[];
  selectedLineup: LineupEntryState[];
  onToggle: (id: string) => void;
  onUpdateDetail: (id: string, updates: Partial<LineupEntryState>) => void;
  color: 'emerald' | 'blue';
}> = memo(({ teamName, players, selectedLineup, onToggle, onUpdateDetail, color }) => {
  const colorClass = color === 'emerald' ? 'text-emerald-500' : 'text-blue-500';
  const bgClass = color === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500';
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col mb-4">
        <span className="text-sm font-black text-zinc-300 uppercase tracking-widest leading-none mb-1">{teamName}</span>
        <span className={`text-xs font-bold uppercase italic ${colorClass}`}>
          {selectedLineup.filter(l => l.lineup_role === 'starter').length}/11 Startelf
        </span>
      </div>
      
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {players.map(player => {
          const entry = selectedLineup.find(l => l.player_id === player.id);
          const isSelected = !!entry;
          
          return (
            <div key={player.id} className="space-y-2">
              <div className={`w-full p-3 rounded-xl border text-left transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isSelected 
                  ? `bg-${color}-500/10 border-${color}-500/30` 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}>
                <div 
                  className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                  onClick={() => onToggle(player.id)}
                >
                  <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    isSelected ? `${bgClass} text-black` : 'bg-zinc-800 text-zinc-600'
                  }`}>
                    {isSelected ? <Check className="w-5 h-5" /> : <Plus className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm md:text-base font-bold truncate ${isSelected ? 'text-white' : ''}`}>{player.full_name}</p>
                    <p className="text-[10px] sm:text-xs uppercase tracking-widest opacity-60 font-medium">{getPositionShort(player.position)}</p>
                  </div>
                </div>

                {isSelected && (
                  <div className="flex items-center gap-2 sm:shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
                    <div className="relative w-12">
                      <input
                        type="text"
                        placeholder="#"
                        value={entry.jersey_number}
                        onChange={(e) => onUpdateDetail(player.id, { jersey_number: e.target.value })}
                        className="w-full h-9 bg-black border border-zinc-700 rounded-lg text-center text-xs text-white font-black italic focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-600"
                      />
                    </div>
                    <select
                      value={entry.lineup_role}
                      onChange={(e) => onUpdateDetail(player.id, { lineup_role: e.target.value as 'starter' | 'sub' })}
                      className={`h-9 bg-black border rounded-lg text-[10px] font-black uppercase px-2 outline-none transition-all cursor-pointer ${
                        entry.lineup_role === 'starter' ? 'border-emerald-500/50 text-emerald-500' : 'border-zinc-700 text-zinc-500'
                      }`}
                    >
                      <option value="starter">Startelf</option>
                      <option value="sub">Bank</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

const ChecklistItem: React.FC<{ label: string; checked: boolean }> = ({ label, checked }) => (
  <div className="flex items-center justify-between">
    <span className={`text-xs font-bold ${checked ? 'text-zinc-400' : 'text-zinc-600'}`}>{label}</span>
    <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
      checked ? 'bg-emerald-500 border-transparent text-black' : 'bg-zinc-800 border-zinc-700 text-transparent'
    }`}>
      <Check className="w-3 h-3" />
    </div>
  </div>
);

const PlayerEventRow: React.FC<{
  player: any;
  events: any[];
  onAdd: (playerId: string, type: string, relatedId?: string) => void;
  onRemove: (playerId: string, type: string) => void;
  currentlyOnPitch?: boolean;
  isSubbingMode?: boolean;
  subbingOutPlayerId?: string | null;
  readOnly?: boolean;
}> = ({ player, events, onAdd, onRemove, currentlyOnPitch = true, isSubbingMode = false, subbingOutPlayerId, readOnly = false }) => {
  const goalCount = events.filter(e => e.event_type === 'goal' && e.player_id === player.id).length;
  const hasYellow = events.some(e => e.event_type === 'yellow_card');
  const hasRed = events.some(e => e.event_type === 'red_card');

  if (isSubbingMode && currentlyOnPitch && subbingOutPlayerId !== player.id) return null;

  return (
    <div className={`flex items-center justify-between p-3 bg-zinc-900/40 border border-white/5 rounded-2xl group hover:bg-zinc-900/60 transition-all ${!currentlyOnPitch && !isSubbingMode ? 'opacity-40' : ''}`}>
      <div className="flex flex-col">
        <span className={`text-xs font-black italic uppercase tracking-tight ${currentlyOnPitch ? 'text-white' : 'text-zinc-600'} group-hover:text-emerald-400 transition-colors`}>{player.full_name}</span>
        <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{getPositionShort(player.position)} {!currentlyOnPitch && '(Bank)'}</span>
      </div>
      
      <div className="flex items-center gap-3">
        {!readOnly && (
          isSubbingMode ? (
            !currentlyOnPitch && (
              <button 
                onClick={() => onAdd(subbingOutPlayerId!, 'sub_out', player.id)}
                className="px-4 h-9 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase tracking-tighter animate-pulse shadow-lg shadow-emerald-500/20"
              >
                Einwechseln
              </button>
            )
          ) : currentlyOnPitch && (
            <>
            {/* Goal Controls */}
            <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => onRemove(player.id, 'goal')}
                disabled={goalCount === 0}
                className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-lg disabled:opacity-20 active:scale-90 transition-transform"
              >
                <Minus className="w-3 h-3 text-zinc-400" />
              </button>
              <div className="flex items-center gap-1.5 px-2 min-w-[45px] justify-center">
                <span className="text-xs">⚽</span>
                <span className="text-xs font-black italic tabular-nums text-white">{goalCount}</span>
              </div>
              <button 
                onClick={() => onAdd(player.id, 'goal')}
                className="w-8 h-8 flex items-center justify-center bg-emerald-500 text-black rounded-lg active:scale-90 transition-transform shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Yellow Card */}
            <button 
              onClick={() => hasYellow ? onRemove(player.id, 'yellow_card') : onAdd(player.id, 'yellow_card')}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-90 ${
                hasYellow 
                  ? 'bg-amber-500 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                  : 'bg-zinc-800 border-white/5'
              }`}
            >
              <span className={`text-xs ${hasYellow ? 'text-black' : 'text-zinc-500 opacity-40'}`}>🟨</span>
            </button>

            {/* Red Card */}
            <button 
              onClick={() => hasRed ? onRemove(player.id, 'red_card') : onAdd(player.id, 'red_card')}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-90 ${
                hasRed 
                  ? 'bg-red-500 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                  : 'bg-zinc-800 border-white/5'
              }`}
            >
              <span className={`text-xs ${hasRed ? 'text-black' : 'text-zinc-500 opacity-40'}`}>🟥</span>
            </button>

            {/* Substitution Button */}
            <button 
              onClick={() => onAdd(player.id, 'sub_out')}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-white/5 bg-zinc-800 hover:bg-emerald-500/20 active:scale-90 transition-all"
            >
              <span className="text-xs">🔄</span>
            </button>
          </>
        ))}
      </div>
    </div>
  );
};

const OpponentGoalSection: React.FC<{
  teamType: 'home' | 'away';
  isAdding: boolean;
  jerseyNumber: string;
  minute: string;
  events: any[];
  onStartAdd: () => void;
  onCancel: () => void;
  onJerseyChange: (val: string) => void;
  onMinuteChange: (val: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}> = ({ 
  isAdding, 
  jerseyNumber, 
  minute, 
  events, 
  onStartAdd, 
  onCancel, 
  onJerseyChange, 
  onMinuteChange, 
  onAdd, 
  onRemove 
}) => {
  return (
    <div className="pt-2 border-t border-white/5 space-y-3">
      <div className="flex items-center justify-between px-1">
        <h5 className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Tore Gegner</h5>
        {!isAdding && (
          <button 
            onClick={onStartAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
          >
            <Plus className="w-3 h-3 text-emerald-500" />
            Tor hinzufügen
          </button>
        )}
      </div>

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-zinc-900 border border-emerald-500/20 rounded-2xl flex flex-col gap-3"
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Rückennummer</label>
              <input 
                type="text" 
                placeholder="9"
                value={jerseyNumber}
                onChange={(e) => onJerseyChange(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-black italic focus:border-emerald-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Minute</label>
              <input 
                type="text" 
                placeholder="45"
                value={minute}
                onChange={(e) => onMinuteChange(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-black italic focus:border-emerald-500 outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={onCancel}
              className="flex-1 py-2 bg-zinc-800 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-zinc-700"
            >
              Abbrechen
            </button>
            <button 
              onClick={onAdd}
              disabled={!minute}
              className="flex-1 py-2 bg-emerald-500 text-black text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 disabled:opacity-50"
            >
              Bestätigen
            </button>
          </div>
        </motion.div>
      )}

      {events.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {events.map(event => (
            <div key={event.id} className="flex items-center justify-between p-2 bg-zinc-950 rounded-xl border border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-[10px]">⚽</span>
                <span className="text-[9px] font-black italic text-zinc-400">{event.minute}'</span>
                <span className="text-[10px] font-black italic uppercase text-zinc-200">Tor Gegner #{event.opponent_jersey_number || '?'}</span>
              </div>
              <button 
                onClick={() => onRemove(event.id)}
                className="p-1.5 hover:bg-red-500/10 rounded-lg group transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-zinc-700 group-hover:text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminMatchControl;
