import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Clock, 
  Shield, 
  Loader2, 
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  X,
  Trophy,
  Users,
  QrCode,
  Navigation,
  Plus,
  Trash2,
  Zap,
  PlusCircle,
  Search,
  Settings
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../lib/supabase';
import { appConfig } from '../../lib/config';
import { useAuth } from '../../context/AuthContext';
import { Fixture, Player, PlayerStats, Team, MatchEvent } from '../../types';
import { PlayerCard } from '../../components/PlayerCard';
import { SponsorBox } from '../../components/SponsorBox';
import { PlayerVoteCard } from '../../components/PlayerVoteCard';
import { SwipeVotingOverlay } from '../../components/SwipeVotingOverlay';
import SafeAreaWrapper from '../../components/SafeAreaWrapper';
import { VotingCountdown } from '../../components/VotingCountdown';
import { calculateMatchScore, getLiveMatchMinute } from '../../lib/score';

interface LineupEntry {
  id: string;
  fixture_id: string;
  player_id: string;
  team_id: string;
  position: string;
  jersey_number: number;
  lineup_role: string;
  players: Player & { player_stats: PlayerStats[] };
  teams: {
    name: string;
    clubs: {
      name: string;
    };
  };
}

export const MatchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isAdmin, hasAdminAccess } = useAuth();
  const [isFixtureAdmin, setIsFixtureAdmin] = useState(false);
  const isMatchAdmin = isAdmin || isFixtureAdmin;
  const [loading, setLoading] = useState(true);
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [lineup, setLineup] = useState<LineupEntry[]>([]);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinError, setCheckinError] = useState('');
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down' | 'neutral'>>({});
  const [votingMode, setVotingMode] = useState(false);
  const [votingLoading, setVotingLoading] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessed, setIsProcessed] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [showSwipeOverlay, setShowSwipeOverlay] = useState(false);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [showConfirmProcess, setShowConfirmProcess] = useState(false);
  const [isCheckingCompletion, setIsCheckingCompletion] = useState(true);
  const [hasCompletedBefore, setHasCompletedBefore] = useState(false);
  const [matchEvents, setMatchEvents] = useState<any[]>([]);
  const [activeAdminTab, setActiveAdminTab] = useState<'home' | 'away'>('home');
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isAddingOpponentGoal, setIsAddingOpponentGoal] = useState<'home' | 'away' | null>(null);
  const [opponentJerseyNumber, setOpponentJerseyNumber] = useState('');
  const [opponentMinute, setOpponentMinute] = useState('');
  const [saving, setSaving] = useState(false);
  const [isPollingResults, setIsPollingResults] = useState(false);
  const [pollTimeout, setPollTimeout] = useState(false);

  const isVotingOpen = !!fixture && fixture.status === 'finished' && !fixture.results_processed_at && !!fixture.voting_close_at && new Date() < new Date(fixture.voting_close_at);

  useEffect(() => {
    if (!isVotingOpen || !fixture?.voting_close_at) return;

    const updateTimer = () => {
      const now = new Date();
      const closeAt = new Date(fixture.voting_close_at);
      const diff = closeAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Voting beendet');
        return;
      }

      const minutes = Math.floor(diff / 1000 / 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft(`⏱ Voting endet in ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isVotingOpen, fixture?.voting_close_at]);
  const [matchMinute, setMatchMinute] = useState<string>('');
  const [subbingOutPlayerId, setSubbingOutPlayerId] = useState<string | null>(null);
  const [assistSelectionPlayerId, setAssistSelectionPlayerId] = useState<string | null>(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  const isPlayerOnPitch = (playerId: string) => {
    const entry = lineup.find(l => l.player_id === playerId);
    if (!entry) return false;
    
    let onPitch = entry.lineup_role === 'starter';
    const subs = matchEvents.filter(e => e.event_type === 'sub_out' && e.related_player_id);
    
    // Sort subs by time if possible, but match_events might not have reliable time order other than minute
    // We'll just process them in order of creation
    subs.forEach(sub => {
      if (sub.player_id === playerId) onPitch = false;
      if (sub.related_player_id === playerId) onPitch = true;
    });
    
    return onPitch;
  };

  const hasPlayerPlayed = (playerId: string) => {
    const entry = lineup.find(l => l.player_id === playerId);
    if (!entry) return false;
    if (entry.lineup_role === 'starter') return true;
    
    const subsIn = matchEvents.filter(e => e.event_type === 'sub_out' && e.related_player_id === playerId);
    return subsIn.length > 0;
  };

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const kickoffDate = fixture ? (
    (fixture as any).kickoff_date && (fixture as any).kickoff_time 
      ? new Date(`${(fixture as any).kickoff_date}T${(fixture as any).kickoff_time}`)
      : new Date(fixture.kickoff_at)
  ) : null;

  const isActuallyLive = !!fixture && !fixture.results_processed_at && fixture.status !== 'finished' && fixture.match_phase !== 'full_time' && (
    fixture.status === 'live' || 
    (fixture.status === 'upcoming' && kickoffDate && now >= kickoffDate)
  );

  useEffect(() => {
    if (!fixture || fixture.results_processed_at || fixture.status === 'finished') {
      setMatchMinute('');
      return;
    }

    setMatchMinute(getLiveMatchMinute(fixture as Fixture, now));
  }, [fixture, now, kickoffDate, isActuallyLive]);

  useEffect(() => {
    if (id && profile) {
      loadData();
      loadMatchEvents();
    }
  }, [id, profile]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`match_events:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_events',
          filter: `fixture_id=eq.${id}`
        },
        () => {
          loadMatchEvents();
        }
      )
      .subscribe();

    const fixtureChannel = supabase
      .channel(`fixture_changes:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'fixtures',
          filter: `id=eq.${id}`
        },
        (payload) => {
          setFixture(prev => ({ ...prev, ...payload.new } as Fixture));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(fixtureChannel);
    };
  }, [id]);

  const loadMatchEvents = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('match_events')
      .select('*')
      .eq('fixture_id', id);
    if (data) setMatchEvents(data);
  };

  const handleFullTime = async () => {
    console.log("DEBUG: [LIFECYCLE] --- MATCH END TRIGGERED ---", { fixtureId: id });
    
    if (!id) {
      console.error("DEBUG: [LIFECYCLE] Error: Missing fixture ID");
      return;
    }
    if (!isMatchAdmin) {
      console.warn("DEBUG: [LIFECYCLE] Warning: Non-admin attempted to end match. isAdmin:", isAdmin, "isFixtureAdmin:", isFixtureAdmin);
      return;
    }
    if (!fixture) {
      console.error("DEBUG: [LIFECYCLE] Error: Fixture object missing");
      return;
    }
    if (fixture.status === 'finished') {
      console.log("DEBUG: [LIFECYCLE] Match already finished, skipping redundant trigger");
      return;
    }

    const homeLineupCount = lineup.filter(l => l.team_id === fixture.home_team_id).length;
    const awayLineupCount = lineup.filter(l => l.team_id === fixture.away_team_id).length;
    const hasBothLineups = homeLineupCount > 0 && awayLineupCount > 0;

    if (!hasBothLineups) {
      console.log(`DEBUG: [LIFECYCLE] Incomplete lineups (Home: ${homeLineupCount}, Away: ${awayLineupCount}). Finishing match directly without voting.`);
      const nowIso = new Date().toISOString();
      setFixture(prev => prev ? { 
        ...prev, 
        status: 'finished',
        match_phase: 'full_time',
        voting_open_at: undefined,
        voting_close_at: undefined,
        results_processed_at: nowIso
      } : null);

      try {
        const { error: directError } = await supabase
          .from('fixtures')
          .update({
            status: 'finished',
            match_phase: 'full_time',
            voting_open_at: null,
            voting_close_at: null,
            results_processed_at: nowIso,
            updated_at: nowIso
          })
          .eq('id', id);

        if (directError) {
          console.error("DEBUG: [LIFECYCLE] Error directly ending match:", directError);
          alert(`Fehler beim Beenden des Spiels: ${directError.message || 'Unbekannter Fehler'}`);
        } else {
          alert('Spiel erfolgreich beendet. Da keine vollständigen Aufstellungen hinterlegt sind, entfällt das Voting.');
        }
      } catch (directErr) {
        console.error("DEBUG: [LIFECYCLE] Direct finish failed:", directErr);
      }
      await loadData();
      return;
    }

    console.log("DEBUG: [LIFECYCLE] Opening voting window (duration defined by backend)");
    
    const payload = {
      p_fixture_id: id
    };
    
    // Optimistic update
    setFixture(prev => prev ? { 
      ...prev, 
      status: 'finished',
      match_phase: 'full_time',
      results_processed_at: null
    } : null);
    
    try {
      console.log("DEBUG: [LIFECYCLE] Calling finish_fixture_and_open_voting RPC...");
      const { data, error } = await supabase.rpc('finish_fixture_and_open_voting', payload);
        
      if (error) {
        console.error("DEBUG: [LIFECYCLE] RPC Failed:", error);
        
        // Match type based voting duration (fallback logic)
        const votingMinutes = fixture.match_type === 'reserve' ? 180 : 60;
        const now = new Date();
        const closeAt = new Date(now.getTime() + votingMinutes * 60000).toISOString();
        
        console.log("DEBUG: [LIFECYCLE] Attempting fallback manual DB update...");
        const { error: updateError } = await supabase
          .from('fixtures')
          .update({
            status: 'finished',
            match_phase: 'full_time',
            voting_open_at: now.toISOString(),
            voting_close_at: closeAt,
            results_processed_at: null
          })
          .eq('id', id);
          
        if (updateError) {
          console.error("DEBUG: [LIFECYCLE] Fallback update failed:", updateError);
          alert(`Fehler beim Beenden des Spiels: ${updateError.message || 'Unbekannter Fehler'}`);
          // Rollback local state
          loadData();
        } else {
          console.log("DEBUG: [LIFECYCLE] Fallback update successful");
          alert('Spiel erfolgreich beendet (Fallback-Modus).');
          
          try {
            const { data: updatedDoc } = await supabase.from('fixtures').select('voting_open_at').eq('id', id).single();
            console.log(`[PUSH] Checked fallback DB status for fixtureId: ${id}, voting_open_at is: ${updatedDoc?.voting_open_at ? 'SET (' + updatedDoc.voting_open_at + ')' : 'NOT SET'}`);
            
            console.log('[PUSH] calling send-fixture-push (voting_open) after fallback...');
            const { data: pushData, error: pushError } = await supabase.functions.invoke('send-fixture-push', {
              body: { type: 'voting_open', fixtureId: id }
            });
            console.log('[PUSH] voting_open result', pushData, pushError);
          } catch (err) {
            console.warn('[PUSH] voting_open failed but flow continues', err);
          }
        }
      } else {
        console.log("DEBUG: [LIFECYCLE] RPC Success:", data);
        
        try {
          const { data: updatedDoc } = await supabase.from('fixtures').select('voting_open_at').eq('id', id).single();
          console.log(`[PUSH] Checked RPC DB status for fixtureId: ${id}, voting_open_at is: ${updatedDoc?.voting_open_at ? 'SET (' + updatedDoc.voting_open_at + ')' : 'NOT SET'}`);
          
          console.log(`[PUSH] calling send-fixture-push (voting_open) for fixture ${id}...`);
          const { data: pushData, error: pushError } = await supabase.functions.invoke('send-fixture-push', {
            body: { type: 'voting_open', fixtureId: id }
          });
          console.log('[PUSH] voting_open result', pushData, pushError);
        } catch (err) {
          console.warn('[PUSH] voting_open failed but flow continues', err);
        }
      }
      
      await loadData();
      console.log("DEBUG: [LIFECYCLE] Match end sequence complete. Voting is now OPEN.");
    } catch (err) {
      console.error("DEBUG: [LIFECYCLE] Unexpected error in handleFullTime:", err);
      await loadData();
    }
  };

  const handleStartHalftime = async () => {
    if (!id || !isMatchAdmin || !fixture) return;
    const nowIso = new Date().toISOString();
    setFixture(prev => prev ? { ...prev, match_phase: 'halftime', halftime_started_at: nowIso } : null);
    
    // Call RPC if available, otherwise direct update
    const { error } = await supabase.rpc('start_halftime', { p_fixture_id: id });
    if (error) {
      await supabase.from('fixtures').update({ 
        status: 'live',
        match_phase: 'halftime', 
        halftime_started_at: nowIso 
      }).eq('id', id);
    }
  };

  const handleStartFirstHalf = async () => {
    if (!id || !isMatchAdmin || !fixture) return;
    const nowIso = new Date().toISOString();
    setFixture(prev => prev ? { ...prev, status: 'live', match_phase: 'first_half', first_half_started_at: nowIso } : null);
    
    // We update directly since we don't have an RPC for first half specifically
    await supabase.from('fixtures').update({ 
      status: 'live',
      match_phase: 'first_half', 
      first_half_started_at: nowIso 
    }).eq('id', id);
  };

  const handleStartSecondHalf = async () => {
    if (!id || !isMatchAdmin || !fixture) return;
    const nowIso = new Date().toISOString();
    setFixture(prev => prev ? { ...prev, match_phase: 'second_half', second_half_started_at: nowIso } : null);
    
    // Call RPC if available, otherwise direct update
    const { error } = await supabase.rpc('start_second_half', { p_fixture_id: id });
    if (error) {
      await supabase.from('fixtures').update({ 
        status: 'live',
        match_phase: 'second_half', 
        second_half_started_at: nowIso 
      }).eq('id', id);
    }
  };

  const handleAddEvent = async (playerId: string, type: 'goal' | 'yellow_card' | 'red_card' | 'sub_in' | 'sub_out', relatedPlayerId?: string | null, assistPlayerId?: string | null) => {
    if (!id || !isMatchAdmin || !fixture) return;

    if (type === 'goal' && assistPlayerId === undefined) {
      setAssistSelectionPlayerId(playerId);
      return;
    }
    
    // Handle Substitution Flow
    if (type === 'sub_out' && !relatedPlayerId) {
      console.log(`DEBUG: Substitution gestartet (player_out_id: ${playerId})`);
      setSubbingOutPlayerId(playerId);
      return;
    }

    let eventType: any = type;
    if (type === 'sub_out' && relatedPlayerId) {
      console.log(`DEBUG: Auswahl player_in_id: ${relatedPlayerId}`);
    }

    // Get team ID for the player
    const entry = lineup.find(l => l.player_id === playerId);
    const teamId = entry?.team_id;

    // Optimistic update
    const tempId = Math.random().toString();
    const newEvent = { 
      id: tempId, 
      fixture_id: id, 
      player_id: playerId, 
      team_id: teamId,
      event_type: eventType,
      related_player_id: relatedPlayerId || null,
      assist_player_id: assistPlayerId || null,
      minute: parseInt(matchMinute) || null
    };

    // Use updated events list to avoid stale state in score calculation
    const updatedEvents = [...matchEvents, newEvent];
    setMatchEvents(updatedEvents);

    // Update score if goal
    if (eventType === 'goal') {
      setFixture(prev => {
        if (!prev) return prev;
        const { homeScore, awayScore } = calculateMatchScore(prev, updatedEvents);
        
        // DB update
        supabase.from('fixtures').update({ 
          home_score: homeScore, 
          away_score: awayScore 
        }).eq('id', id).then(({ error }) => {
          if (error) console.error(`Error updating score in DB:`, error);
        });
        
        return { ...prev, home_score: homeScore, away_score: awayScore };
      });
    }

    const { error: insertError } = await supabase
      .from('match_events')
      .insert({ 
        fixture_id: id, 
        player_id: playerId, 
        team_id: teamId,
        event_type: eventType,
        related_player_id: relatedPlayerId || null,
        assist_player_id: assistPlayerId || null,
        minute: parseInt(matchMinute) || null
      });
      
    if (insertError) {
      console.error('DEBUG: [LIFECYCLE] Error adding match event:', insertError);
      console.error('DEBUG: [LIFECYCLE] Failed payload:', {
        fixture_id: id, 
        player_id: playerId, 
        team_id: teamId,
        event_type: eventType,
      });
      loadMatchEvents(); // Rollback
    } else if (eventType === 'sub_out' && relatedPlayerId) {
      console.log(`DEBUG: Substitution gespeichert (out: ${playerId}, in: ${relatedPlayerId})`);
      // We need to wait a bit or use the local data for the next log
      const updatedOnPitch = lineup.filter(l => {
        let onPitch = l.lineup_role === 'starter';
        const allEvents = [...matchEvents, newEvent];
        const playerSubs = allEvents.filter(e => e.event_type === 'sub_out' && e.related_player_id);
        playerSubs.forEach(sub => {
          if (sub.player_id === l.player_id) onPitch = false;
          if (sub.related_player_id === l.player_id) onPitch = true;
        });
        return onPitch;
      }).map(l => l.players.full_name);
      console.log(`DEBUG: Aktive Spieler nach Update: ${updatedOnPitch.join(', ')}`);
    }

    if (type === 'sub_out') {
      setSubbingOutPlayerId(null);
    }
  };

  const handleAddOpponentGoal = async (teamType: 'home' | 'away') => {
    if (!id || !isMatchAdmin || !fixture) return;
    
    console.log(`DEBUG: [UI] handleAddOpponentGoal called for ${teamType}`);
    const teamId = teamType === 'home' ? fixture.home_team_id : fixture.away_team_id;
    const jersey = opponentJerseyNumber;
    const minute = parseInt(opponentMinute) || parseInt(matchMinute) || null;
    
    setSaving(true);
    // Optimistic update
    const tempId = Math.random().toString();
    const newEvent = { 
      id: tempId, 
      fixture_id: id, 
      team_id: teamId, 
      player_id: null, 
      event_type: 'opponent_goal',
      opponent_jersey_number: jersey || null,
      minute: minute
    };
    
    const updatedEvents = [...matchEvents, newEvent];
    setMatchEvents(updatedEvents);
    
    setFixture(prev => {
      if (!prev) return prev;
      const { homeScore, awayScore } = calculateMatchScore(prev, updatedEvents);
      
      // DB update
      supabase.from('fixtures').update({ 
        home_score: homeScore, 
        away_score: awayScore 
      }).eq('id', id).then(({ error }) => {
        if (error) console.error(`Error updating opponent score in DB:`, error);
      });
      
      return { ...prev, home_score: homeScore, away_score: awayScore };
    });

    try {
      const { error: insertError } = await supabase
        .from('match_events')
        .insert({ 
          fixture_id: id, 
          team_id: teamId,
          player_id: null,
          event_type: 'opponent_goal',
          opponent_jersey_number: jersey || null,
          minute: minute
        });
        
      if (insertError) {
        console.error('DEBUG: [LIFECYCLE] Error adding opponent goal:', insertError);
        throw insertError;
      }
      
      setIsAddingOpponentGoal(null);
      setOpponentJerseyNumber('');
      setOpponentMinute('');
      console.log('DEBUG: [UI] Opponent goal saved successfully');
    } catch (err) {
      console.error('Error adding opponent goal:', err);
      // No need to rollback matchEvents manually here as it is optimistic and will be overridden by next load
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!id || !isMatchAdmin || !fixture) return;
    
    const event = matchEvents.find(e => e.id === eventId);
    if (!event) return;

    console.log(`DEBUG: Event gelöscht (ID: ${eventId}, Type: ${event.event_type})`);
    console.log(`DEBUG: Recalculation gestartet`);

    const updatedEvents = matchEvents.filter(e => e.id !== eventId);
    setMatchEvents(updatedEvents);

    if (event.event_type === 'goal' || event.event_type === 'opponent_goal') {
      setFixture(prev => {
        if (!prev) return prev;
        const { homeScore, awayScore } = calculateMatchScore(prev, updatedEvents);
        
        supabase.from('fixtures').update({ 
          home_score: homeScore, 
          away_score: awayScore 
        }).eq('id', id).then(({ error }) => {
          if (error) console.error(`Error reverting score in DB:`, error);
        });
        
        return { ...prev, home_score: homeScore, away_score: awayScore };
      });
    }

    const { error: deleteError } = await supabase
      .from('match_events')
      .delete()
      .eq('id', eventId);

    if (deleteError) {
      console.error('DEBUG: [LIFECYCLE] Error deleting event:', deleteError);
      loadMatchEvents();
    }
  };
  
  const handleRemoveEvent = async (playerId: string, type: string) => {
    if (!id || !isMatchAdmin || !fixture) return;
    
    const eventToRemove = [...matchEvents].reverse().find(e => e.player_id === playerId && e.event_type === type);
    if (!eventToRemove) return;

    const updatedEvents = matchEvents.filter(e => e.id !== eventToRemove.id);
    setMatchEvents(updatedEvents);

    // Update score if goal
    if (type === 'goal') {
      setFixture(prev => {
        if (!prev) return prev;
        const { homeScore, awayScore } = calculateMatchScore(prev, updatedEvents);
        
        // DB update
        supabase.from('fixtures').update({ 
          home_score: homeScore, 
          away_score: awayScore 
        }).eq('id', id).then(({ error }) => {
          if (error) console.error(`Error reverting score in DB:`, error);
        });
        
        return { ...prev, home_score: homeScore, away_score: awayScore };
      });
    }

    const { error: removeError } = await supabase
      .from('match_events')
      .delete()
      .eq('id', eventToRemove.id);

    if (removeError) {
      console.error('DEBUG: [LIFECYCLE] Error removing event:', removeError);
      loadMatchEvents(); // Rollback
    }
  };

  useEffect(() => {
    if (!loading && fixture && !isCheckedIn && !gpsLoading && !gpsError && profile && appConfig.GPS_VOTING_REQUIRED) {
      handleGPSCheckin();
    }
  }, [loading, fixture, isCheckedIn, profile]);

  const handleGPSCheckin = async () => {
    if (!id || !profile) return;
    
    console.log('DEBUG: [GPS] --- STARTING ROBUST LOCATION FLOW ---');
    setGpsLoading(true);
    setGpsError('');

    if (!navigator.geolocation) {
      console.error('DEBUG: [GPS] Geolocation not supported');
      setGpsError('Dein Browser unterstützt keine Standortermittlung.');
      setGpsLoading(false);
      return;
    }

    const getPosition = (options: PositionOptions): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });
    };

    try {
      let position: GeolocationPosition | null = null;

      // STAGE 1: Try Last Known Position (Fast)
      console.log('DEBUG: [GPS] Stage 1: Attempting to get last known position (cached)...');
      try {
        position = await getPosition({ 
          enableHighAccuracy: false, 
          timeout: 3000, 
          maximumAge: Infinity // Accept any cached position initially
        });
        
        if (position) {
          console.log('DEBUG: [GPS] Stage 1 Success: Cached position found:', {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: `${position.coords.accuracy}m`,
            age: `${Math.round((Date.now() - position.timestamp) / 1000)}s`
          });
          
          // If cached position is fresh (last 5 mins) and accurate enough (< 200m), use it immediately
          if (Date.now() - position.timestamp < 300000 && position.coords.accuracy < 200) {
            console.log('DEBUG: [GPS] Cached position is fresh and accurate. Using it.');
          } else {
            console.log('DEBUG: [GPS] Cached position is old or inaccurate. Proceeding to Stage 2 for a fresh fix.');
            position = null; 
          }
        }
      } catch (err) {
        console.log('DEBUG: [GPS] Stage 1: No cached position available.');
      }

      // STAGE 2: Try Fresh High Accuracy Position
      if (!position) {
        console.log('DEBUG: [GPS] Stage 2: Requesting fresh high-accuracy position (15s timeout)...');
        try {
          position = await getPosition({ 
            enableHighAccuracy: true, 
            timeout: 15000, 
            maximumAge: 0 
          });
          console.log('DEBUG: [GPS] Stage 2 Success: High accuracy position received:', {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: `${position.coords.accuracy}m`
          });
        } catch (err: any) {
          console.warn('DEBUG: [GPS] Stage 2 Failed (High Accuracy):', { code: err.code, message: err.message });
          
          // STAGE 3: Fallback to Balanced Accuracy with longer timeout and some tolerance
          if (err.code === 2 || err.code === 3) {
            console.log('DEBUG: [GPS] Stage 3: Falling back to balanced accuracy (25s timeout, 1min age)...');
            try {
              position = await getPosition({ 
                enableHighAccuracy: false, 
                timeout: 25000, 
                maximumAge: 60000 // Allow 1 minute old position if it helps get a fix
              });
              console.log('DEBUG: [GPS] Stage 3 Success: Balanced accuracy position received:', {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                accuracy: `${position.coords.accuracy}m`
              });
            } catch (fallbackErr: any) {
              console.error('DEBUG: [GPS] Stage 3 Failed (Balanced Accuracy):', fallbackErr);
              throw fallbackErr;
            }
          } else {
            throw err;
          }
        }
      }

      if (position) {
        console.log('DEBUG: [GPS] Final position determined. Calling check_in_to_match RPC...');
        const result = await supabaseService.createMatchCheckinWithGPS(
          id,
          position.coords.latitude,
          position.coords.longitude
        );
        
        if (result.success) {
          console.log('DEBUG: [GPS] RPC Success:', result);
          setIsCheckedIn(true);
        } else {
          console.warn('DEBUG: [GPS] RPC returned success=false:', result.error);
          setGpsError(mapGpsError(result.error || 'Check-in fehlgeschlagen'));
        }
      }
    } catch (error: any) {
      console.error('DEBUG: [GPS] Location flow failed:', { code: error.code, message: error.message });
      
      let msg = 'Ein Standortfehler ist aufgetreten.';
      
      if (error.code === 1) {
        msg = 'Standortberechtigung wurde verweigert. Bitte erlaube den Zugriff in deinen Browsereinstellungen.';
      } else if (error.code === 2) {
        msg = 'Standort konnte gerade nicht ermittelt werden. Bitte stelle sicher, dass GPS aktiviert ist, gehe ggf. kurz ins Freie und versuche es erneut.';
      } else if (error.code === 3) {
        msg = 'Die Standortermittlung hat zu lange gedauert. Bitte versuche es an einem Ort mit besserem Empfang erneut.';
      }

      if (window.self !== window.top) {
        msg += ' Tipp: Öffne die App in einem neuen Tab, falls der Standortzugriff im Vorschau-Fenster blockiert wird.';
      }
      
      setGpsError(msg);
    } finally {
      setGpsLoading(false);
    }
  };

  const mapGpsError = (error: string): string => {
    if (error.includes('Venue location not set')) return 'Für dieses Spiel ist kein Standort hinterlegt.';
    if (error.includes('Check-in not yet open')) return 'Check-in ist noch nicht geöffnet.';
    if (error.includes('Check-in has expired')) return 'Check-in ist bereits abgelaufen.';
    if (error.includes('Outside radius')) return 'Du bist außerhalb des erlaubten Radius.';
    if (error.includes('Authentication required')) return 'Bitte melde dich an.';
    if (error.includes('Invalid coordinate')) return 'Standort konnte nicht korrekt ermittelt werden.';
    if (error.includes('Fixture not found')) return 'Spiel nicht gefunden.';
    return error;
  };

  useEffect(() => {
    if (location.state?.openCheckin && !loading && !isCheckedIn) {
      // We don't auto-checkin anymore, we need the code
      // But we can scroll to the check-in section if needed
    }
  }, [location.state, loading, isCheckedIn]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      console.log(`DEBUG: [UI] Loading data for fixture ${id}...`);
      
      // Workaround for iOS Capacitor GoTrue lock stealing bug during concurrent requests:
      // Wait for a fresh session before launching 8 parallel queries.
      try {
        await supabase.auth.getSession();
      } catch (lockError) {
        console.warn('DEBUG: Ignored pre-warm session error:', lockError);
        // Wait 500ms and try once more if it's a lock steal issue
        await new Promise(r => setTimeout(r, 500));
        await supabase.auth.getSession().catch(() => {});
      }
      
      const f = await supabaseService.getFixtureById(id);
      
      // League check
      if (f && profile?.selected_league_id && f.league_id !== profile.selected_league_id && !isAdmin) {
        console.warn('DEBUG: Unallowed league access, redirecting');
        navigate('/matches');
        return;
      }

      const [l, v, checkin, history, events, isCompleted, teamId, fixtureAdmin] = await Promise.all([
        supabaseService.getFixtureLineupWithPlayers(id),
        profile ? supabaseService.getUserVotesForFixture(profile.id, id) : Promise.resolve([]),
        profile ? supabaseService.getMatchCheckin(id) : Promise.resolve(null),
        supabaseService.getFixtureRatingHistory(id),
        supabase.from('match_events').select('*').eq('fixture_id', id),
        profile ? supabaseService.checkVoteCompletion(id, profile.id) : Promise.resolve(false),
        profile ? supabaseService.getUserTeamIdForFixture(id) : Promise.resolve(null),
        profile ? supabaseService.canManageFixture(id) : Promise.resolve(false)
      ]);

      const matchEventsData = events.data || [];
      setMatchEvents(matchEventsData);
      setHasCompletedBefore(isCompleted);
      setUserTeamId(teamId);
      setIsFixtureAdmin(fixtureAdmin);

      console.log('DEBUG: [VOTE_COMPLETION] MatchDetail loadData results:', {
        fixtureId: id,
        userId: profile?.id,
        isCompleted,
        teamId,
        lineupCount: l.length,
        votesCount: v.length
      });

      // DEBUG LOGS FOR V1 TEAM RESTRICTION
      console.log('DEBUG: [V1-VOTING-FIX] --- TEAM DETECTION ---');
      console.log('DEBUG: [V1-VOTING-FIX] User ID:', profile?.id);
      console.log('DEBUG: [V1-VOTING-FIX] User Role:', profile?.role);
      console.log('DEBUG: [V1-VOTING-FIX] Detected User Team ID:', teamId);
      console.log('DEBUG: [V1-VOTING-FIX] Fixture Home Team ID:', f?.home_team_id);
      console.log('DEBUG: [V1-VOTING-FIX] Fixture Away Team ID:', f?.away_team_id);
      
      const homeCount = l.filter(e => e.team_id === f?.home_team_id).length;
      const awayCount = l.filter(e => e.team_id === f?.away_team_id).length;
      console.log('DEBUG: [V1-VOTING-FIX] Lineup Counts - Home:', homeCount, 'Away:', awayCount);
      
      if (profile?.role === 'player') {
        const { data: player } = await supabase.from('players').select('id, team_id').eq('claimed_by_user_id', profile.id).maybeSingle();
        console.log('DEBUG: [V1-VOTING-FIX] Claimed Player ID:', player?.id);
        console.log('DEBUG: [V1-VOTING-FIX] Player Team ID from DB:', player?.team_id);
      } else if (profile?.role === 'fan') {
        console.log('DEBUG: [V1-VOTING-FIX] Fan Favorite Club ID:', profile?.favorite_club_id);
      }
      
      if (isCompleted) {
        setVotingMode(true);
        setShowSwipeOverlay(true);
      }

    // Auto-Live Status Update
    if (f && !f.results_processed_at) {
      const kickoff = new Date(f.kickoff_at);
      const isLiveTime = kickoff <= new Date();
      
      if (f.status === 'upcoming' && isLiveTime) {
        // We only update the local object for UI consistency
        f.status = 'live';
        if (!f.match_phase) {
          f.match_phase = 'first_half';
          f.first_half_started_at = f.kickoff_at;
        }
      }

      // Robust score calculation
      const { homeScore, awayScore } = calculateMatchScore(f, matchEventsData);
      f.home_score = homeScore;
      f.away_score = awayScore;
    }

      setFixture(f);
      setLineup(l);
      setIsProcessed(!!f?.results_processed_at);
      setProcessedCount(history.length);
      
      console.log(`DEBUG: [UI] MatchDetail loaded ${l.length} lineup entries. Processed: ${history.length > 0}`);
      
      const voteMap: Record<string, 'up' | 'down' | 'neutral'> = {};
      v.forEach((vote: any) => {
        voteMap[vote.player_id] = vote.vote_type || vote.vote;
      });
      setUserVotes(voteMap);

      // Check if user is checked in
      setIsCheckedIn(!!checkin || !appConfig.GPS_VOTING_REQUIRED);
    } catch (err) {
      console.error('Error loading match detail:', err);
    } finally {
      setLoading(false);
      setIsCheckingCompletion(false);
    }
  };

  const handleVote = async (playerId: string, vote: 'up' | 'down' | 'neutral') => {
    if (!id || !profile || !fixture) return;
    
    // If already voted this way, do nothing
    if (userVotes[playerId] === vote) return;

    // Check voting window
    const now = new Date();
    const isVotingOpen = fixture.voting_close_at ? now < new Date(fixture.voting_close_at) : true;

    if (!isVotingOpen) {
      console.log('DEBUG: [VOTE] Voting is closed for this match. Deadline was:', fixture.voting_close_at);
      return;
    }

    setVotingLoading(playerId);
    try {
      console.log(`DEBUG: [VOTE] Submitting vote for player ${playerId}: ${vote} (Fixture: ${id}, User: ${profile.id})`);
      
      const { data, error } = await supabase.rpc('submit_player_vote', {
        p_fixture_id: id,
        p_player_id: playerId,
        p_vote: vote,
        p_bypass_checkin: !appConfig.GPS_VOTING_REQUIRED
      });

      if (error) {
        console.error('DEBUG: [VOTE] RPC Error:', error);
        throw error;
      }
      
      if (data && data.success === false) {
        console.warn('DEBUG: [VOTE] RPC returned failure:', data.error);
        throw new Error(data.error || 'Voting failed');
      }

      console.log('DEBUG: [VOTE] Vote successfully RECORDED in database:', data);
      setUserVotes(prev => ({ ...prev, [playerId]: vote }));
    } catch (err) {
      console.error('DEBUG: [VOTE] Final Catch Error:', err);
    } finally {
      setVotingLoading(null);
    }
  };

  const handleProcessResults = async () => {
    if (!id) return;
    console.log(`DEBUG: [LIFECYCLE] --- RESULT PROCESSING TRIGGERED ---`);
    console.log(`DEBUG: [LIFECYCLE] Admin: ${profile?.display_name}`);
    setIsProcessing(true);
    let originalError: any = null;
    
    try {
      await supabaseService.processFixtureRatings(id);
    } catch (err) {
      console.warn('DEBUG: [LIFECYCLE] Processing threw an error, verifying if results exist anyway:', err);
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
        console.log(`DEBUG: [LIFECYCLE] Processing SUCCESS verified. Results are available.`);
        setIsProcessed(true);
        setProcessedCount(updatedFixture.fixture_lineups?.length || 11);
        
        setTimeout(() => {
          navigate(`/matches/${id}/result`);
        }, 1500);
      } else {
        console.error('DEBUG: [LIFECYCLE] Processing FAILED to create results:', originalError);
        alert(originalError instanceof Error ? originalError.message : 'Failed to process results');
      }
    } catch (refreshErr) {
      console.error('DEBUG: [LIFECYCLE] Error checking processing status:', refreshErr);
      if (originalError) {
        alert(originalError instanceof Error ? originalError.message : 'Failed to process results');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-trigger processing when voting window closes (for admins)
  useEffect(() => {
    if (!isMatchAdmin || !fixture || fixture.results_processed_at || fixture.status !== 'finished' || !fixture.voting_close_at) return;

    const checkWindow = () => {
      const now = new Date();
      const closeAt = new Date(fixture.voting_close_at!);
      
      if (now >= closeAt && !isProcessing) {
        console.log("DEBUG: [LIFECYCLE] Voting window closed. Auto-triggering result processing...");
        handleProcessResults();
      }
    };

    const interval = setInterval(checkWindow, 5000);
    return () => clearInterval(interval);
  }, [isMatchAdmin, fixture, isProcessing]);

  // Polling for normal users
  useEffect(() => {
    let interval: any;
    
    const checkResults = async () => {
      if (!id) return;
      
      try {
        const { data: updatedFixture } = await supabase.from('fixtures').select('results_processed_at').eq('id', id).single();
        
        if (updatedFixture?.results_processed_at) {
          const { data: history } = await supabase.from('player_rating_history').select('id').eq('fixture_id', id).limit(1);
          
          if (history && history.length > 0) {
            setIsPollingResults(false);
            if (interval) clearInterval(interval);
            loadData(); // Update full state
            navigate(`/matches/${id}/result`); // Navigate to results
          }
        }
      } catch (err) {
        console.error("DEBUG: Polling error", err);
      }
    };

    if (fixture?.status === 'finished' && fixture.voting_close_at && !fixture.results_processed_at && !isMatchAdmin) {
      const closeAt = new Date(fixture.voting_close_at);
      if (new Date() >= closeAt && !pollTimeout) {
        setIsPollingResults(true);
        interval = setInterval(checkResults, 5000);
        
        // Timeout after 60 seconds
        const timeout = setTimeout(() => {
          setIsPollingResults(false);
          setPollTimeout(true);
          if (interval) clearInterval(interval);
        }, 60000);

        return () => {
          if (interval) clearInterval(interval);
          clearTimeout(timeout);
        };
      }
    }
  }, [fixture?.status, fixture?.voting_close_at, fixture?.results_processed_at, pollTimeout, isMatchAdmin, id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!fixture) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-zinc-800 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Spiel nicht gefunden</h2>
        <button 
          onClick={() => navigate('/matches')}
          className="text-emerald-500 font-bold uppercase tracking-widest text-xs"
        >
          Zurück zu den Spielen
        </button>
      </div>
    );
  }

  const homePlayers = lineup.filter(entry => entry.team_id === fixture.home_team_id);
  const awayPlayers = lineup.filter(entry => entry.team_id === fixture.away_team_id);

  const getPlayerName = (playerId: string) => {
    const entry = lineup.find(l => l.player_id === playerId);
    return entry?.players?.full_name || 'Unbekannter Spieler';
  };

  const getPlayerTeam = (playerId: string) => {
    const entry = lineup.find(l => l.player_id === playerId);
    return entry?.team_id === fixture.home_team_id ? 'home' : 'away';
  };

  if (fixture.results_processed_at) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <Trophy className="w-16 h-16 text-emerald-500 mb-6" />
        <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-2">Spiel beendet</h2>
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mb-8">Ergebnisse wurden berechnet</p>
        <button 
          onClick={() => navigate(`/matches/${id}/result`)}
          className="w-full max-w-xs bg-emerald-500 text-black font-black italic uppercase tracking-tighter py-4 rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
        >
          Zum Ergebnis
        </button>
      </div>
    );
  }

  const isLive = isActuallyLive;

  const homeGoals = matchEvents.filter(e => 
    (e.event_type === 'goal' || e.event_type === 'opponent_goal') && 
    (e.player_id ? getPlayerTeam(e.player_id) === 'home' : e.team_id === fixture.home_team_id)
  );
  const awayGoals = matchEvents.filter(e => 
    (e.event_type === 'goal' || e.event_type === 'opponent_goal') && 
    (e.player_id ? getPlayerTeam(e.player_id) === 'away' : e.team_id === fixture.away_team_id)
  );

  return (
    <SafeAreaWrapper>
    <div className="min-h-full bg-zinc-950 text-white font-sans pb-[calc(10rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="p-3 pt-3 flex items-center justify-between sticky top-0 bg-zinc-950/95 backdrop-blur-xl z-50 border-b border-white/5">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/matches')} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[10px] font-black italic tracking-tighter uppercase text-zinc-500">
              Runde {fixture.round_number || 1} • {(fixture as any).home_team?.name}
            </h1>
            {isLive && (
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">{matchMinute}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isMatchAdmin && (
            <button 
              onClick={() => navigate(isAdmin ? '/admin' : '/team-admin')}
              className="w-8 h-8 bg-zinc-900 rounded-lg border border-white/10 flex items-center justify-center hover:border-emerald-500 hover:text-emerald-500 transition-all shadow-lg active:scale-95"
              title="Admin Panel"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <img src="https://upvzomofjjwaxkfogpuc.supabase.co/storage/v1/object/public/assets/logo/Logo1024.png" alt="PLYRZ Logo" className="h-8 w-auto object-contain opacity-50" referrerPolicy="no-referrer" />
        </div>
      </div>

      {/* Live Compact Header */}
      <div className="px-3 pt-3">
        {isVotingOpen && (
          <div className="mb-6">
            <button 
              onClick={() => { setVotingMode(true); setShowSwipeOverlay(true); }}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black italic uppercase tracking-tighter py-6 rounded-[2.5rem] transition-all shadow-2xl shadow-emerald-500/40 active:scale-[0.98] flex flex-col items-center justify-center gap-2 border-4 border-emerald-400/50 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              <div className="flex items-center gap-3 relative z-10">
                <Trophy className="w-8 h-8" />
                <span className="text-2xl">Jetzt abstimmen</span>
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.3em] opacity-80 relative z-10">Deine Stimme zählt!</span>
              {timeLeft && (
                <span className="text-[12px] font-bold text-white mt-1 relative z-10 flex items-center gap-1.5">
                  ⏱ {timeLeft} verbleibend
                </span>
              )}
            </button>
          </div>
        )}

        <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-5 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
          
          <div className="flex items-center justify-between gap-2">
            {/* Home Team */}
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center border border-white/5 shadow-lg">
                {(fixture as any).home_team?.clubs?.logo_url ? (
                  <img src={(fixture as any).home_team.clubs.logo_url} alt="" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                ) : <Shield className="w-6 h-6 text-zinc-600" />}
              </div>
              <span className="text-[10px] font-black italic uppercase tracking-tight text-center line-clamp-1 text-zinc-300">
                {(fixture as any).home_team?.clubs?.name}
              </span>
            </div>

            {/* Center: Score & Minute */}
            <div className="flex flex-col items-center gap-0.5 px-2">
              <div className="text-4xl font-black italic tracking-tighter flex items-center gap-2 text-white">
                {(() => {
                  const { homeScore, awayScore } = calculateMatchScore(fixture, matchEvents);
                  return (
                    <>
                      <span>{homeScore}</span>
                      <span className="text-zinc-800">:</span>
                      <span>{awayScore}</span>
                    </>
                  );
                })()}
              </div>
              {isLive ? (
                <div className="flex flex-col items-center">
                  <span className="text-[14px] font-black italic text-emerald-500 tracking-tighter">{matchMinute}</span>
                  <div className="bg-red-500 px-2 py-0.5 rounded-full mt-1">
                    <span className="text-[8px] font-black text-white uppercase tracking-widest animate-pulse">Live</span>
                  </div>
                </div>
              ) : (
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                  {fixture.status === 'upcoming' ? 'Bevorstehend' : fixture.status === 'live' ? 'Live' : 'Beendet'}
                </span>
              )}
            </div>

            {/* Away Team */}
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center border border-white/5 shadow-lg">
                {(fixture as any).away_team?.clubs?.logo_url ? (
                  <img src={(fixture as any).away_team.clubs.logo_url} alt="" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                ) : <Shield className="w-6 h-6 text-zinc-600" />}
              </div>
              <span className="text-[10px] font-black italic uppercase tracking-tight text-center line-clamp-1 text-zinc-300">
                {(fixture as any).away_team?.clubs?.name}
              </span>
            </div>
          </div>

          {/* Kickoff Info */}
          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center gap-4 text-[8px] font-bold text-zinc-600 uppercase tracking-[0.2em]">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              {new Date(fixture.kickoff_at).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {new Date(fixture.kickoff_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </div>
          </div>

          {/* Admin Quick Live Action - Tor Gegner */}
          {isMatchAdmin && isLive && !fixture.results_processed_at && (
            <div className="mt-6 pt-4 border-t border-white/5">
              {console.log('DEBUG: [UI] Rendering "Tor Gegner" button on MatchDetail')}
              <button 
                onClick={() => {
                  console.log('DEBUG: [UI] "Tor Gegner" button clicked - Opening Modal');
                  setIsAddingOpponentGoal('away');
                  setOpponentMinute(matchMinute.replace("'", ""));
                }}
                className="w-full bg-zinc-950 hover:bg-zinc-800 border border-emerald-500/30 text-emerald-500 font-black italic uppercase tracking-tighter py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 group active:scale-[0.98]"
              >
                <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                <span className="text-sm">Tor Gegner Eintragen</span>
              </button>
            </div>
          )}

          {/* Goal Scorers Summary */}
          {(homeGoals.length > 0 || awayGoals.length > 0) && (
            <div className="mt-4 pt-3 border-t border-white/5 flex justify-between gap-4 text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
              <div className="flex-1 text-left space-y-0.5">
                {homeGoals.map((g, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span>⚽</span>
                    <span className="truncate">
                      {g.event_type === 'opponent_goal' 
                        ? `Gegner #${g.opponent_jersey_number || '?'}` 
                        : (
                          <span className="flex items-center gap-1">
                            {getPlayerName(g.player_id)}
                            {g.assist_player_id && <span className="text-zinc-500 font-bold ml-1 text-[8px]">(Assist: {getPlayerName(g.assist_player_id)})</span>}
                          </span>
                        )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex-1 text-right space-y-0.5">
                {awayGoals.map((g, i) => (
                  <div key={i} className="flex items-center gap-1 justify-end">
                    <span className="truncate">
                      {g.event_type === 'opponent_goal' 
                        ? `Gegner #${g.opponent_jersey_number || '?'}` 
                        : (
                          <span className="flex items-center gap-1 justify-end">
                            {g.assist_player_id && <span className="text-zinc-500 font-bold mr-1 text-[8px]">(Assist: {getPlayerName(g.assist_player_id)})</span>}
                            {getPlayerName(g.player_id)}
                          </span>
                        )}
                    </span>
                    <span>⚽</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Match Sponsor */}
        {(fixture as any).match_sponsor_name && (
          <div className="mt-8 flex justify-center w-full max-w-[360px] mx-auto">
            <SponsorBox 
              type="MATCH" 
              sponsorName={(fixture as any).match_sponsor_name} 
              sponsorLogoUrl={(fixture as any).match_sponsor_logo_url} 
            />
          </div>
        )}
      </div>

      {/* Timeline Section */}
      {matchEvents.length > 0 && (
        <div className="px-4 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Timeline</h3>
          </div>
          <div className="space-y-1.5">
            {[...matchEvents].reverse().slice(0, 5).map((event, idx) => {
              const isEventAway = event.player_id 
                ? getPlayerTeam(event.player_id) === 'away' 
                : event.team_id === fixture.away_team_id;

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={event.id} 
                  className={`flex items-center gap-3 p-2 rounded-xl bg-zinc-900/30 border border-zinc-800/30 ${isEventAway ? 'flex-row-reverse text-right' : ''}`}
                >
                  <div className="text-[9px] font-black italic text-zinc-600 w-6">
                    {event.minute || '?'}'
                  </div>
                  <div className="text-sm">
                    {(event.event_type === 'goal' || event.event_type === 'opponent_goal') ? '⚽' : event.event_type === 'yellow_card' ? '🟨' : event.event_type === 'red_card' ? '🟥' : '🔁'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-black italic uppercase tracking-tight truncate">
                      {event.event_type === 'opponent_goal' ? (
                        <span>Tor Gegner #{event.opponent_jersey_number || '?'}</span>
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
                    </div>
                  </div>
                  {isMatchAdmin && (
                    <button 
                      onClick={() => handleDeleteEvent(event.id)}
                      className="p-1 hover:bg-red-500/10 rounded group transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-zinc-700 group-hover:text-red-500" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin Quick Controls */}
      {isMatchAdmin && !fixture.results_processed_at && fixture.status !== 'finished' && (
        <div className="px-3 mt-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
            {/* Match Phase Controls */}
            <div className="flex gap-2 p-3 border-b border-white/5 bg-zinc-950/30">
              {(!fixture.match_phase || fixture.match_phase === 'upcoming' || fixture.status === 'upcoming') && (
                <button 
                  onClick={handleStartFirstHalf}
                  className="flex-1 py-2.5 bg-emerald-500 text-black font-black rounded-xl text-[9px] uppercase tracking-widest transition-all"
                >
                  Anpfiff (1. HZ)
                </button>
              )}
              {isLive && fixture.match_phase === 'first_half' && (
                <button 
                  onClick={handleStartHalftime}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/5"
                >
                  Halbzeit
                </button>
              )}
              {isLive && fixture.match_phase === 'halftime' && (
                <button 
                  onClick={handleStartSecondHalf}
                  className="flex-1 py-2.5 bg-emerald-500 text-black font-black rounded-xl text-[9px] uppercase tracking-widest transition-all"
                >
                  2. Halbzeit
                </button>
              )}
              {isLive && fixture.match_phase === 'second_half' && fixture.status !== 'finished' && (
              <div className="flex gap-2 w-full">
                <button 
                  onClick={() => {
                    console.log("DEBUG: [UI] Abpfiff button clicked");
                    handleFullTime();
                  }}
                  className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black rounded-xl text-[9px] uppercase tracking-widest transition-all border border-red-500/20"
                >
                  Abpfiff
                </button>
                <button 
                  onClick={() => {
                    console.log("DEBUG: [UI] Test Abpfiff clicked");
                    handleFullTime();
                  }}
                  className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-black rounded-xl text-[8px] uppercase tracking-widest transition-all border border-white/5"
                >
                  Test Abpfiff
                </button>
              </div>
              )}
            </div>

            {/* Admin Quick Goal Row */}
            <div className="p-3 border-b border-white/5 bg-zinc-950/10 flex items-center justify-between">
              <span className="text-[10px] font-black italic uppercase tracking-tighter text-zinc-500">Quick Score</span>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    setIsAddingOpponentGoal('home');
                    setOpponentMinute(matchMinute.replace("'", ""));
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-emerald-500/10 rounded-lg border border-white/5 transition-all group"
                >
                  <Plus className="w-3 h-3 text-emerald-500" />
                  <span className="text-[8px] font-black uppercase">Tor Heim</span>
                </button>
                <button 
                  onClick={() => {
                    setIsAddingOpponentGoal('away');
                    setOpponentMinute(matchMinute.replace("'", ""));
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-emerald-500/10 rounded-lg border border-white/5 transition-all group"
                >
                  <Plus className="w-3 h-3 text-emerald-500" />
                  <span className="text-[8px] font-black uppercase">Tor Gegner</span>
                </button>
              </div>
            </div>

            <div className="flex bg-zinc-950/50">
              <button 
                onClick={() => setActiveAdminTab('home')}
                className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all ${activeAdminTab === 'home' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-zinc-600'}`}
              >
                {(fixture as any).home_team?.clubs?.name}
              </button>
              <button 
                onClick={() => setActiveAdminTab('away')}
                className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all ${activeAdminTab === 'away' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-zinc-600'}`}
              >
                {(fixture as any).away_team?.clubs?.name}
              </button>
            </div>
            
            <div className="p-1 max-h-[320px] overflow-y-auto custom-scrollbar">
              {(activeAdminTab === 'home' ? homePlayers : awayPlayers).map((entry) => {
                const playerEvents = matchEvents.filter(e => e.player_id === entry.player_id || e.related_player_id === entry.player_id);
                const goals = playerEvents.filter(e => e.event_type === 'goal' && e.player_id === entry.player_id).length;
                const yellow = playerEvents.some(e => e.event_type === 'yellow_card');
                const red = playerEvents.some(e => e.event_type === 'red_card');
                const sub = playerEvents.some(e => e.event_type === 'sub_out' && (e.player_id === entry.player_id || e.related_player_id === entry.player_id));
                const currentlyOnPitch = isPlayerOnPitch(entry.player_id);

                // If subbing out, only show players who are NOT on pitch as candidates to sub in
                if (subbingOutPlayerId && currentlyOnPitch && subbingOutPlayerId !== entry.player_id) return null;

                return (
                  <div key={entry.player_id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-xl transition-colors border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-7 h-7 rounded-lg ${currentlyOnPitch ? 'bg-zinc-800' : 'bg-zinc-900 opacity-40'} flex items-center justify-center text-[9px] font-black italic border border-white/5 text-zinc-400`}>
                        {entry.jersey_number}
                      </div>
                      <div className="min-w-0">
                        <div className={`text-[10px] font-black italic uppercase tracking-tight truncate ${currentlyOnPitch ? 'text-zinc-200' : 'text-zinc-600'}`}>
                          {entry.players.full_name}
                          {!currentlyOnPitch && <span className="ml-2 text-[8px] opacity-60">(Bank)</span>}
                        </div>
                        <div className="flex gap-1 mt-0.5">
                          {goals > 0 && <span className="text-[7px]">⚽{goals}</span>}
                          {yellow && <span className="text-[7px]">🟨</span>}
                          {red && <span className="text-[7px]">🟥</span>}
                          {sub && <span className="text-[7px]">🔁</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {subbingOutPlayerId && !currentlyOnPitch && (
                        <div className="flex flex-col gap-3 pt-2">
                          <button 
                            onClick={() => handleAddEvent(subbingOutPlayerId, 'sub_out', entry.player_id)}
                            className="px-2 h-7 rounded-lg bg-emerald-500 text-black text-[8px] font-black uppercase tracking-tighter animate-pulse"
                          >
                            Einwechseln
                          </button>
                        </div>
                      )}
                      
                      {!subbingOutPlayerId && currentlyOnPitch && (
                        <>
                          <button 
                            onClick={() => handleAddEvent(entry.player_id, 'goal')}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-emerald-500/20 flex items-center justify-center text-[10px] transition-colors"
                          >
                            ⚽
                          </button>
                          <button 
                            onClick={() => yellow ? handleDeleteEvent(playerEvents.find(e => e.event_type === 'yellow_card').id) : handleAddEvent(entry.player_id, 'yellow_card')}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] transition-colors ${yellow ? 'bg-yellow-500 text-black' : 'bg-zinc-800 hover:bg-yellow-500/20'}`}
                          >
                            🟨
                          </button>
                          <button 
                            onClick={() => red ? handleDeleteEvent(playerEvents.find(e => e.event_type === 'red_card').id) : handleAddEvent(entry.player_id, 'red_card')}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] transition-colors ${red ? 'bg-red-500 text-white' : 'bg-zinc-800 hover:bg-red-500/20'}`}
                          >
                            🟥
                          </button>
                          <button 
                            onClick={() => handleAddEvent(entry.player_id, 'sub_out')}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] transition-colors ${subbingOutPlayerId === entry.player_id ? 'bg-blue-500 text-white' : 'bg-zinc-800 hover:bg-blue-500/20'}`}
                          >
                            🔁
                          </button>
                        </>
                      )}
                      
                      {subbingOutPlayerId === entry.player_id && (
                        <button 
                          onClick={() => setSubbingOutPlayerId(null)}
                          className="w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center text-[10px]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Voting Section (Only if finished and not processed) */}
      {!isLive && !fixture.results_processed_at && (
        <div className="px-6 mt-6">
          {/* Action Buttons */}
          <div className="space-y-4">
            {/* Admin Processing Button */}
            {isMatchAdmin && fixture.status === 'finished' && (
              <div className="space-y-3">
                <button 
                  onClick={() => setShowConfirmProcess(true)}
                  disabled={isProcessing || !fixture.voting_close_at || new Date(fixture.voting_close_at) > new Date()}
                  className={`w-full font-black italic uppercase tracking-tighter py-4 rounded-2xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 ${
                    !fixture.voting_close_at || new Date(fixture.voting_close_at) > new Date()
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5' 
                      : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20 shadow-lg'
                  }`}
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trophy className="w-5 h-5" />}
                  {isProcessing ? 'Verarbeite...' : 'Resultate berechnen'}
                </button>

                {isAdmin && fixture.voting_close_at && new Date(fixture.voting_close_at) > new Date() && (
                  <button 
                    onClick={async () => {
                      if (!id) return;
                      try {
                        const nowIso = new Date().toISOString();
                        const { error } = await supabase
                          .from('fixtures')
                          .update({ voting_close_at: nowIso })
                          .eq('id', id);
                        
                        if (error) throw error;
                        
                        setFixture(prev => prev ? { ...prev, voting_close_at: nowIso } : null);
                        console.log("DEBUG: [LIFECYCLE] Voting closed manually by admin");
                        
                        // Explicitly trigger processing
                        handleProcessResults();
                      } catch (err) {
                        console.error("DEBUG: [LIFECYCLE] Error closing voting:", err);
                        alert(`Fehler beim Schließen des Votings: ${err instanceof Error ? err.message : String(err)}`);
                      }
                    }}
                    className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/5 transition-all flex items-center justify-center gap-2"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Voting jetzt schließen
                  </button>
                )}
              </div>
            )}

            {/* Voting Button */}
            <div className="w-full">
              {(() => {
                const now = new Date();
                const votingCloseAt = fixture.voting_close_at ? new Date(fixture.voting_close_at) : null;
                const isVotingOpenNow = (fixture.status === 'finished' && !fixture.results_processed_at && votingCloseAt && now < votingCloseAt);

                if (isVotingOpenNow) {
                  if (!userTeamId && !isMatchAdmin) {
                    return (
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-zinc-500" />
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                          Du musst einem Team angehören, um abzustimmen.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <button 
                      onClick={() => { setVotingMode(true); setShowSwipeOverlay(true); }}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black italic uppercase tracking-tighter py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <Trophy className="w-5 h-5" />
                      Jetzt abstimmen
                    </button>
                  );
                }

                // If voting is closed but results not processed
                const isVotingClosedNow = (fixture.status === 'finished' && !fixture.results_processed_at && votingCloseAt && now >= votingCloseAt);
                if (isVotingClosedNow) {
                  return (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center gap-2 text-center">
                      <div className="flex items-center gap-2 text-amber-500">
                        <Clock className="w-4 h-4" />
                        <p className="text-xs font-black uppercase tracking-widest">Voting beendet</p>
                      </div>
                      <p className="text-zinc-500 text-[10px] font-medium">
                        {pollTimeout && !isMatchAdmin
                          ? "Ergebnisse werden noch verarbeitet."
                          : "Das Voting-Fenster ist geschlossen. Die Ergebnisse werden in Kürze berechnet."}
                      </p>
                      {isPollingResults && !pollTimeout && !isMatchAdmin && (
                        <div className="mt-2 flex items-center gap-2 text-emerald-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Suche nach Ergebnissen...</span>
                        </div>
                      )}
                      {pollTimeout && !isMatchAdmin && (
                        <button 
                          onClick={() => { setPollTimeout(false); setIsPollingResults(true); }}
                          className="mt-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors"
                        >
                          Ergebnisse erneut prüfen
                        </button>
                      )}
                    </div>
                  );
                }

                return null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Lineup Sections (Standard View) */}
      <div className="p-6 space-y-10">
        {!isMatchAdmin && fixture?.status === 'upcoming' ? (
          <div className="flex flex-col items-center justify-center p-12 bg-zinc-900/30 rounded-[2.5rem] border border-dashed border-zinc-800 w-full text-center space-y-4">
            <Users className="w-12 h-12 text-zinc-800" />
            <div className="space-y-1">
              <p className="text-zinc-400 font-bold">Aufstellung verborgen</p>
              <p className="text-zinc-600 text-xs">
                Die Aufstellung ist ab Spielbeginn sichtbar.
              </p>
            </div>
          </div>
        ) : (
          <>
        {/* Home Team */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-emerald-500 rounded-full" />
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">
              {(fixture as any).home_team?.clubs?.name}
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-12 gap-x-8 justify-items-center">
            {homePlayers.length > 0 ? homePlayers.map((entry) => (
              <PlayerVoteCard
                key={`vote-${entry.player_id}`}
                player={entry.players}
                vote={userVotes[entry.player_id] || null}
                onVote={(vote) => handleVote(entry.player_id, vote)}
                loading={votingLoading === entry.player_id}
                disabled={!isVotingOpen || (userTeamId !== null && userTeamId !== entry.team_id)}
                jerseyNumber={entry.jersey_number}
                lineupRole={entry.lineup_role as 'starter' | 'sub'}
                onClick={() => navigate(`/players/${entry.player_id}`)}
                events={matchEvents.filter(e => e.player_id === entry.player_id)}
                isAdmin={isMatchAdmin && fixture.status !== 'finished' && !fixture.results_processed_at}
                onAddEvent={handleAddEvent}
                onRemoveEvent={handleRemoveEvent}
                hasPlayed={hasPlayerPlayed(entry.player_id)}
              />
            )) : (
              <div className="col-span-full flex flex-col items-center justify-center p-12 bg-zinc-900/30 rounded-[2.5rem] border border-dashed border-zinc-800 w-full text-center space-y-4">
                <Users className="w-12 h-12 text-zinc-800" />
                <div className="space-y-1">
                  <p className="text-zinc-400 font-bold">Keine spielberechtigten Spieler gefunden.</p>
                  <p className="text-zinc-600 text-xs">
                    {!userTeamId 
                      ? "Du hast noch kein Team zugewiesen. Bitte wähle in deinem Profil einen Verein." 
                      : userTeamId !== fixture.home_team_id 
                        ? "Dieses Team ist nicht dein zugewiesenes Team."
                        : "Für dieses Team wurde noch keine Aufstellung hinterlegt."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Away Team */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-zinc-500 rounded-full" />
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">
              {(fixture as any).away_team?.clubs?.name}
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-12 gap-x-8 justify-items-center">
            {awayPlayers.length > 0 ? awayPlayers.map((entry) => (
              <PlayerVoteCard
                key={`vote-${entry.player_id}`}
                player={entry.players}
                vote={userVotes[entry.player_id] || null}
                onVote={(vote) => handleVote(entry.player_id, vote)}
                loading={votingLoading === entry.player_id}
                disabled={!isVotingOpen || (userTeamId !== null && userTeamId !== entry.team_id)}
                jerseyNumber={entry.jersey_number}
                lineupRole={entry.lineup_role as 'starter' | 'sub'}
                onClick={() => navigate(`/players/${entry.player_id}`)}
                events={matchEvents.filter(e => e.player_id === entry.player_id)}
                isAdmin={isMatchAdmin && fixture.status !== 'finished' && !fixture.results_processed_at}
                onAddEvent={handleAddEvent}
                onRemoveEvent={handleRemoveEvent}
                hasPlayed={hasPlayerPlayed(entry.player_id)}
              />
            )) : (
              <div className="col-span-full flex flex-col items-center justify-center p-12 bg-zinc-900/30 rounded-[2.5rem] border border-dashed border-zinc-800 w-full text-center space-y-4">
                <Users className="w-12 h-12 text-zinc-800" />
                <div className="space-y-1">
                  <p className="text-zinc-400 font-bold">Keine spielberechtigten Spieler gefunden.</p>
                  <p className="text-zinc-600 text-xs">
                    {!userTeamId 
                      ? "Du hast noch kein Team zugewiesen. Bitte wähle in deinem Profil einen Verein." 
                      : userTeamId !== fixture.away_team_id 
                        ? "Dieses Team ist nicht dein zugewiesenes Team."
                        : "Für dieses Team wurde noch keine Aufstellung hinterlegt."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </div>

      {/* Swipe Voting Overlay */}
      <AnimatePresence>
        {showSwipeOverlay && id && (
          <SwipeVotingOverlay
            fixtureId={id}
            userId={profile?.id || ''}
            lineup={lineup.filter(entry => {
              if (userTeamId && entry.team_id !== userTeamId) return false;
              return hasPlayerPlayed(entry.player_id);
            })}
            userVotes={userVotes}
            onVote={handleVote}
            onClose={() => setShowSwipeOverlay(false)}
            onViewResults={() => {
              setShowSwipeOverlay(false);
              navigate(`/matches/${id}/result`);
            }}
            votingCloseAt={fixture.voting_close_at}
            resultsProcessedAt={fixture.results_processed_at}
          />
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmProcess && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full space-y-6 relative overflow-hidden"
            >
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-[100px]" />
              
              <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl">
                    <Trophy className="w-6 h-6 text-emerald-500" />
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
                    Resultate berechnen?
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
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
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

      {/* Opponent Goal Modal */}
      <AnimatePresence>
        {isAddingOpponentGoal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-white/10 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative max-h-[85vh] flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-950/30">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500 rounded-xl text-black">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black italic uppercase tracking-tighter">Tor Gegner</h3>
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none mt-0.5">
                      {isAddingOpponentGoal === 'home' ? (fixture as any).home_team?.clubs?.name : (fixture as any).away_team?.clubs?.name}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddingOpponentGoal(null)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
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
                      onClick={() => handleAddOpponentGoal(isAddingOpponentGoal)}
                      disabled={!opponentMinute || saving}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black italic uppercase tracking-tighter py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 text-lg"
                    >
                      {saving ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'TOR SPEICHERN'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Assist Selection Modal */}
      <AnimatePresence>
        {assistSelectionPlayerId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-white/10 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-950/30">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500 rounded-xl text-black">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black italic uppercase tracking-tighter">Assistgeber</h3>
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none mt-0.5">
                      Wähle den Assist für {getPlayerName(assistSelectionPlayerId)}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setAssistSelectionPlayerId(null)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-hidden flex flex-col pl-4 pr-1">
                <div className="space-y-4 flex-1 flex flex-col pr-5">
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

                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    <button
                      onClick={() => {
                        handleAddEvent(assistSelectionPlayerId, 'goal', null, null);
                        setAssistSelectionPlayerId(null);
                      }}
                      className="w-full mb-4 flex items-center justify-center p-4 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-2xl transition-all group active:scale-[0.98]"
                    >
                      <span className="text-[12px] font-black uppercase italic text-zinc-300 group-hover:text-white transition-colors">Kein Assist</span>
                    </button>

                    {lineup
                      .filter(entry => {
                        // Needs to be same team
                        const scorerEntry = lineup.find(l => l.player_id === assistSelectionPlayerId);
                        return scorerEntry && entry.team_id === scorerEntry.team_id && entry.player_id !== assistSelectionPlayerId;
                      })
                      .filter(entry => !playerSearchQuery || entry.players.full_name.toLowerCase().includes(playerSearchQuery.toLowerCase()))
                      .map(entry => {
                        return (
                          <button
                            key={entry.player_id}
                            onClick={() => {
                              handleAddEvent(assistSelectionPlayerId, 'goal', null, entry.player_id);
                              setAssistSelectionPlayerId(null);
                              setPlayerSearchQuery('');
                            }}
                            className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 rounded-2xl transition-all group active:scale-[0.98]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-400 group-hover:text-emerald-500 transition-colors">
                                #{entry.jersey_number || '?'}
                              </div>
                              <div className="text-left">
                                <p className="text-[11px] font-black uppercase italic text-white group-hover:text-emerald-400 transition-colors">{entry.players.full_name}</p>
                              </div>
                            </div>
                            <Plus className="w-4 h-4 text-zinc-700 group-hover:text-emerald-500 transition-colors" />
                          </button>
                        );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <div className="h-28" /> {/* Spacer */}
    </div>
    </SafeAreaWrapper>
  );
};

export default MatchDetail;
