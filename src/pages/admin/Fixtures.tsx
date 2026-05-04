import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Plus, 
  Edit2, 
  Trash2, 
  ArrowLeft,
  Search,
  Check,
  X,
  Loader2,
  Trophy,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Shield,
  Star
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../lib/supabase';
import { getPositionShort } from '../../lib/positions';
import { calculateMatchScore } from '../../lib/score';
import DeleteConfirmationModal from '../../components/admin/DeleteConfirmationModal';

const AdminFixtures: React.FC = () => {
  const navigate = useNavigate();
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFixture, setEditingFixture] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    league_id: '',
    home_team_id: '',
    away_team_id: '',
    kickoff_at: '',
    venue_name: '',
    status: 'upcoming',
    round_number: '1',
    home_score: '',
    away_score: '',
    checkin_code: '',
    checkin_opens_at: '',
    checkin_closes_at: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null
  });
  const [deleting, setDeleting] = useState(false);
  const [processingRatings, setProcessingRatings] = useState(false);
  const [processedCounts, setProcessedCounts] = useState<Record<string, number>>({});
  const [ratingConfirmModal, setRatingConfirmModal] = useState<{ isOpen: boolean; fixtureId: string | null }>({
    isOpen: false,
    fixtureId: null
  });
  const [eventsModal, setEventsModal] = useState<{ isOpen: boolean; fixtureId: string | null }>({
    isOpen: false,
    fixtureId: null
  });
  const [fixtureEvents, setFixtureEvents] = useState<any[]>([]);
  const [lineupForEvents, setLineupForEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [savingEvents, setSavingEvents] = useState(false);

  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [fixturesData, teamsData, leaguesData] = await Promise.all([
        supabaseService.getFixtures(),
        supabaseService.getTeams(),
        supabaseService.getLeagues()
      ]);
      setFixtures(fixturesData);
      setTeams(teamsData);
      setLeagues(leaguesData);
      
      // Fetch processed counts as fallback
      const fixtureIds = fixturesData.map(f => f.id);
      if (fixtureIds.length > 0) {
        const counts = await supabaseService.getProcessedCounts(fixtureIds);
        setProcessedCounts(counts);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEvents = async (fixtureId: string) => {
    console.log(`DEBUG: [handleOpenEvents] START - fixtureId: "${fixtureId}"`);
    setLoadingEvents(true);
    
    try {
      // 1. Fetch Lineup first (confirmed to work)
      console.log(`DEBUG: [handleOpenEvents] Fetching lineup for fixtureId: "${fixtureId}"`);
      const lineup = await supabaseService.getFixtureLineup(fixtureId);
      const safeLineup = Array.isArray(lineup) ? lineup : [];
      
      console.log(`DEBUG: [handleOpenEvents] Lineup received: ${safeLineup.length} entries`);
      
      // Immediately store lineup in state
      setLineupForEvents(safeLineup);

      // 2. Try to fetch events
      let events = [];
      try {
        console.log(`DEBUG: [handleOpenEvents] Fetching events for fixtureId: "${fixtureId}"`);
        events = await supabaseService.getMatchEvents(fixtureId);
        console.log(`DEBUG: [handleOpenEvents] Events received: ${events.length}`);
      } catch (eventErr) {
        console.error('DEBUG: [handleOpenEvents] Event fetch failed:', eventErr);
      }

      // 3. Set events state
      setFixtureEvents(events.length > 0 ? events : [{ player_id: '', event_type: 'starting_xi', minute: null, extra_minute: 0 }]);
      
      // 4. Open modal
      setEventsModal({ isOpen: true, fixtureId });
    } catch (err) {
      console.error('DEBUG: [handleOpenEvents] FATAL ERROR:', err);
      setFixtureEvents([{ player_id: '', event_type: 'starting_xi', minute: null, extra_minute: 0 }]);
      setLineupForEvents([]);
      setEventsModal({ isOpen: true, fixtureId });
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleAddEventRow = () => {
    setFixtureEvents([...fixtureEvents, { player_id: '', event_type: 'starting_xi', minute: null, extra_minute: 0 }]);
  };

  const handleRemoveEventRow = (index: number) => {
    const newEvents = [...fixtureEvents];
    newEvents.splice(index, 1);
    setFixtureEvents(newEvents.length > 0 ? newEvents : [{ player_id: '', event_type: 'goal', minute: '' }]);
  };

  const handleUpdateEventRow = (index: number, field: string, value: any) => {
    const newEvents = [...fixtureEvents];
    newEvents[index] = { ...newEvents[index], [field]: value };
    setFixtureEvents(newEvents);
  };

  const handleSaveEvents = async () => {
    if (!eventsModal.fixtureId) return;
    setSavingEvents(true);
    try {
      // Filter out incomplete rows and attach team_id
      const validEvents = fixtureEvents
        .filter(e => e.player_id && e.event_type)
        .map(e => {
          const lineupEntry = lineupForEvents.find(l => l.player_id === e.player_id);
          return {
            ...e,
            team_id: lineupEntry?.team_id || null
          };
        });
      
      await supabaseService.syncMatchEvents(eventsModal.fixtureId, validEvents);
      setEventsModal({ isOpen: false, fixtureId: null });
      setStatusModal({
        isOpen: true,
        title: 'Success',
        message: 'Match events saved successfully.',
        type: 'success'
      });
    } catch (err) {
      console.error('Error saving events:', err);
      setStatusModal({
        isOpen: true,
        title: 'Error',
        message: 'Failed to save match events. Please try again.',
        type: 'error'
      });
    } finally {
      setSavingEvents(false);
    }
  };

  const handleOpenModal = (fixture: any = null) => {
    if (fixture) {
      setEditingFixture(fixture);
      setFormData({
        league_id: fixture.league_id || '',
        home_team_id: fixture.home_team_id || '',
        away_team_id: fixture.away_team_id || '',
        kickoff_at: fixture.kickoff_at ? new Date(fixture.kickoff_at).toISOString().slice(0, 16) : '',
        venue_name: fixture.venue_name || '',
        status: fixture.status || 'upcoming',
        round_number: fixture.round_number?.toString() || '1',
        home_score: fixture.home_score?.toString() || '',
        away_score: fixture.away_score?.toString() || '',
        checkin_code: fixture.checkin_code || '',
        checkin_opens_at: fixture.checkin_opens_at ? new Date(fixture.checkin_opens_at).toISOString().slice(0, 16) : '',
        checkin_closes_at: fixture.checkin_closes_at ? new Date(fixture.checkin_closes_at).toISOString().slice(0, 16) : ''
      });
    } else {
      setEditingFixture(null);
      setFormData({
        league_id: leagues[0]?.id || '',
        home_team_id: '',
        away_team_id: '',
        kickoff_at: '',
        venue_name: '',
        status: 'upcoming',
        round_number: '1',
        home_score: '',
        away_score: '',
        checkin_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        checkin_opens_at: '',
        checkin_closes_at: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.home_team_id === formData.away_team_id) {
      setStatusModal({
        isOpen: true,
        title: 'Invalid Selection',
        message: 'Home and Away teams cannot be the same!',
        type: 'error'
      });
      return;
    }
    setSubmitting(true);
    try {
      if (!formData.league_id || !formData.home_team_id || !formData.away_team_id) {
        setStatusModal({
          isOpen: true,
          title: 'Missing Information',
          message: 'Please select a league and both teams.',
          type: 'error'
        });
        setSubmitting(false);
        return;
      }

      const selectedHomeTeam = teams.find(t => t.id === formData.home_team_id);
      const homeName = (selectedHomeTeam?.name || '').toLowerCase();
      const isReserve = homeName.includes('reserve') || 
                       homeName.includes(' 1b') || 
                       homeName.includes(' 1.b') || 
                       homeName.includes(' ii') || 
                       homeName.includes(' res') ||
                       homeName.includes(' 2. mannschaft');

      const payload: any = {
        league_id: formData.league_id,
        home_team_id: formData.home_team_id,
        away_team_id: formData.away_team_id,
        kickoff_at: formData.kickoff_at ? new Date(formData.kickoff_at).toISOString() : null,
        status: formData.status,
        match_type: isReserve ? 'reserve' : 'kampfmannschaft',
        round_number: formData.round_number ? parseInt(formData.round_number) : 1,
        venue_name: formData.venue_name || null,
        home_score: formData.home_score !== '' ? parseInt(formData.home_score) : null,
        away_score: formData.away_score !== '' ? parseInt(formData.away_score) : null,
        checkin_code: formData.checkin_code || null,
        checkin_opens_at: formData.checkin_opens_at ? new Date(formData.checkin_opens_at).toISOString() : null,
        checkin_closes_at: formData.checkin_closes_at ? new Date(formData.checkin_closes_at).toISOString() : null
      };

      if (editingFixture) {
        await supabaseService.updateFixture(editingFixture.id, payload);
        setIsModalOpen(false);
        await loadData();
      } else {
        const result = await supabaseService.createFixture(payload);
        if (result && result.id) {
          navigate(`/admin/fixtures/${result.id}`);
        }
      }
    } catch (err) {
      console.error('DEBUG: Error saving fixture:', err);
      setStatusModal({
        isOpen: true,
        title: 'Save Failed',
        message: 'Error saving fixture: ' + (err as any).message,
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteModal({ isOpen: true, id });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.id) return;
    
    setDeleting(true);
    console.log(`DEBUG: [FRONTEND] Initiating delete for fixture ID: ${deleteModal.id}`);
    
    try {
      await supabaseService.deleteFixture(deleteModal.id);
      console.log(`DEBUG: [FRONTEND] Delete successful for fixture ID: ${deleteModal.id}, refreshing list...`);
      setDeleteModal({ isOpen: false, id: null });
      await loadData();
    } catch (err) {
      console.error(`DEBUG: [FRONTEND] Failed to delete fixture ID: ${deleteModal.id}`, err);
      setStatusModal({
        isOpen: true,
        title: 'Delete Failed',
        message: `Error deleting fixture: ${(err as any).message || 'Unknown error'}`,
        type: 'error'
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleProcessRatings = (fixtureId?: string) => {
    const targetId = fixtureId || editingFixture?.id;
    if (!targetId) return;
    
    console.log('DEBUG: [FRONTEND] Process Ratings button clicked for fixture:', targetId);
    setRatingConfirmModal({ isOpen: true, fixtureId: targetId });
  };

  const confirmProcessRatings = async () => {
    if (!ratingConfirmModal.fixtureId) return;
    
    const targetId = ratingConfirmModal.fixtureId;
    setRatingConfirmModal({ isOpen: false, fixtureId: null });
    setProcessingRatings(true);
    
    console.log('DEBUG: [FRONTEND] Starting rating processing flow for fixture:', targetId);
    
    let originalError: any = null;
    
    try {
      await supabaseService.processFixtureRatings(targetId);
    } catch (err: any) {
      console.warn('DEBUG: [FRONTEND] Rating processing threw an error, verifying if results exist anyway:', err);
      originalError = err;
    }
    
    try {
      // Add a small delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const updatedFixture = await supabaseService.getFixtureById(targetId);
      let resultsExist = !!updatedFixture.results_processed_at;
      
      if (!resultsExist) {
        const { data, error } = await supabase
          .from('player_rating_history')
          .select('id')
          .eq('fixture_id', targetId)
          .limit(1);
        if (!error && data && data.length > 0) {
          resultsExist = true;
        }
      }

      if (resultsExist) {
        console.log('DEBUG: [FRONTEND] Rating processing successful verified in DB.');
        setStatusModal({
          isOpen: true,
          title: 'Processing Complete',
          message: 'Successfully processed ratings for players. Player stats have been updated.',
          type: 'success'
        });
        
        setIsModalOpen(false);
        await loadData();
      } else {
        console.error('DEBUG: [FRONTEND] Rating processing failed:', originalError);
        setStatusModal({
          isOpen: true,
          title: 'Processing Failed',
          message: originalError?.message || 'An unexpected error occurred while processing ratings.',
          type: 'error'
        });
      }
    } catch (refreshErr) {
      console.error('DEBUG: [FRONTEND] Error checking processing status:', refreshErr);
      if (originalError) {
        setStatusModal({
          isOpen: true,
          title: 'Processing Failed',
          message: originalError?.message || 'An unexpected error occurred while processing ratings.',
          type: 'error'
        });
      }
    } finally {
      setProcessingRatings(false);
    }
  };

  const filteredFixtures = fixtures.filter(f => 
    (f.home_team?.clubs?.name && f.home_team.clubs.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (f.home_team?.name && f.home_team.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (f.away_team?.clubs?.name && f.away_team.clubs.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (f.away_team?.name && f.away_team.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (f.leagues?.name && f.leagues.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-transparent p-6 text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/admin')}
              className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <h1 className="text-3xl font-black italic tracking-tighter uppercase">SPIELE</h1>
              <p className="text-zinc-500 font-medium text-sm">Spielplan & Ergebnisse</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
            NEUES SPIEL
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text"
            placeholder="Spiele suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredFixtures.map((fixture) => (
              <motion.div
                key={fixture.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/admin/fixtures/${fixture.id}`)}
                className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-6 cursor-pointer hover:border-white/20 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    <Trophy className="w-3 h-3 text-emerald-500" />
                    {fixture.leagues?.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(fixture);
                      }}
                      className="p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(fixture.id);
                      }}
                      className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 text-center space-y-2">
                    <div className="w-12 h-12 bg-zinc-800 rounded-full mx-auto flex items-center justify-center">
                      <Shield className="w-6 h-6 text-zinc-500" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-bold text-sm line-clamp-1 italic uppercase tracking-tight text-white">
                        {fixture.home_team?.clubs?.name}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-1">
                    {fixture.status === 'finished' || fixture.status === 'live' ? (() => {
                      const { homeScore, awayScore } = calculateMatchScore(fixture, (fixture as any).match_events || []);
                      return (
                        <div className="text-3xl font-black italic tracking-tighter flex items-center gap-3">
                          <span>{homeScore}</span>
                          <span className="text-zinc-700">-</span>
                          <span>{awayScore}</span>
                        </div>
                      );
                    })() : (
                      <div className="px-3 py-1 bg-zinc-800 rounded-lg text-xs font-bold text-zinc-400">
                        VS
                      </div>
                    )}
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                      fixture.status === 'live' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                      fixture.status === 'finished' ? 'bg-zinc-800 text-zinc-500 border-zinc-700' :
                      'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    }`}>
                      {fixture.status}
                    </span>
                  </div>

                  <div className="flex-1 text-center space-y-2">
                    <div className="w-12 h-12 bg-zinc-800 rounded-full mx-auto flex items-center justify-center">
                      <Shield className="w-6 h-6 text-zinc-500" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-bold text-sm line-clamp-1 italic uppercase tracking-tight text-white">
                        {fixture.away_team?.clubs?.name}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800 flex flex-wrap gap-2">
                  <StatusBadge 
                    label="Aufstellung" 
                    active={fixture.lineup_count > 0} 
                    color="emerald" 
                  />
                  <StatusBadge 
                    label="Ergebnis" 
                    active={fixture.home_score !== null && fixture.away_score !== null} 
                    color="blue" 
                  />
                  <StatusBadge 
                    label="Verarbeitet" 
                    active={!!fixture.results_processed_at} 
                    color="purple" 
                  />
                  <div className="ml-auto flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                    <Clock className="w-3 h-3" />
                    {new Date(fixture.kickoff_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl my-auto"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase">
                    {editingFixture ? 'SPIEL BEARBEITEN' : 'NEUES SPIEL'}
                  </h2>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 text-zinc-500 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Liga</label>
                    <select
                      required
                      value={formData.league_id}
                      onChange={(e) => setFormData({ ...formData, league_id: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                    >
                      <option value="">Liga auswählen</option>
                      {leagues.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Heimteam</label>
                      <select
                        required
                        value={formData.home_team_id}
                        onChange={(e) => setFormData({ ...formData, home_team_id: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                      >
                        <option value="">Heimteam auswählen</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.clubs?.name} – {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Auswärtsteam</label>
                      <select
                        required
                        value={formData.away_team_id}
                        onChange={(e) => setFormData({ ...formData, away_team_id: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                      >
                        <option value="">Auswärtsteam auswählen</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.clubs?.name} – {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Spieltag</label>
                    <input 
                      type="number"
                      min="1"
                      max="38"
                      value={formData.round_number}
                      onChange={(e) => setFormData({ ...formData, round_number: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                      placeholder="e.g. 7"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Anstoß</label>
                    <input 
                      required
                      type="datetime-local"
                      value={formData.kickoff_at}
                      onChange={(e) => setFormData({ ...formData, kickoff_at: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                    />
                  </div>

                  <div className="pt-6">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                      {editingFixture ? 'SPIEL AKTUALISIEREN' : 'SPIEL ERSTELLEN'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Fixture Events Modal */}
        <AnimatePresence>
          {eventsModal.isOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 blur-[100px]" />
                
                <div className="relative z-10 flex flex-col h-full">
                  {console.log('DEBUG: FixtureEventsModal render count =', new Date().getTime())}
                  {console.log('DEBUG: FixtureEventsModal received lineupForEvents prop =', lineupForEvents.length)}
                  
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-amber-500/10 rounded-2xl">
                        <Trophy className="w-6 h-6 text-amber-500" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">
                          Spielereignisse
                        </h2>
                        <p className="text-zinc-500 text-sm font-medium">Tore und Vorlagen erfassen</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setEventsModal({ isOpen: false, fixtureId: null })}
                      className="p-2 text-zinc-500 hover:text-white transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {console.log('DEBUG: [MODAL RENDER] State Check:', {
                    isOpen: eventsModal.isOpen,
                    modalFixtureId: eventsModal.fixtureId,
                    loadingEvents,
                    lineupCount: lineupForEvents.length,
                    lineupData: lineupForEvents
                  })}
                  {console.log('DEBUG: lineupForEvents raw =', JSON.stringify(lineupForEvents, null, 2))}
                  {loadingEvents ? (
                    <div className="flex-1 flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                    </div>
                  ) : lineupForEvents.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4">
                      <div className="p-4 bg-zinc-800/50 rounded-full">
                        <AlertCircle className="w-12 h-12 text-zinc-600" />
                      </div>
                      <div className="max-w-xs">
                        <p className="text-white font-bold text-lg">Keine Aufstellung verfügbar</p>
                        <p className="text-zinc-500 text-sm mt-1">Du musst erst die Aufstellung verwalten, bevor du Tore und Vorlagen erfassen kannst.</p>
                      </div>
                      <button
                        onClick={() => navigate('/admin/lineups')}
                        className="px-8 py-3 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all italic"
                      >
                        Zu den Aufstellungen
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                      <div className="space-y-4">
                        {fixtureEvents.map((event, index) => (
                          <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-zinc-800/50 rounded-2xl border border-white/5 relative group">
                            <div className="flex-1 w-full space-y-2">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Spieler auswählen</label>
                              
                              <div className="space-y-1 bg-zinc-900/50 p-2 rounded-xl border border-white/5 max-h-40 overflow-y-auto">
                                {lineupForEvents.map((entry, idx) => {
                                  const playerId = entry.player_id;
                                  const player = entry.players;
                                  const isSelected = event.player_id === playerId;
                                  
                                  return (
                                    <button
                                      key={playerId || idx}
                                      type="button"
                                      onClick={() => handleUpdateEventRow(index, 'player_id', playerId)}
                                      className={`w-full p-3 rounded-lg text-xs font-bold border transition-all text-left flex items-center justify-between ${
                                        isSelected 
                                          ? 'bg-amber-500 text-black border-amber-500' 
                                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                                      }`}
                                    >
                                      <span className="truncate uppercase tracking-tight">
                                        {player?.full_name || 'Unknown'}
                                      </span>
                                      <span className={`text-[10px] uppercase tracking-widest font-black italic ${isSelected ? 'text-black/50' : 'text-zinc-600'}`}>
                                        {getPositionShort(player?.position)}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="w-full sm:w-40 space-y-2">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Ereignis</label>
                              <select
                                value={event.event_type}
                                onChange={(e) => handleUpdateEventRow(index, 'event_type', e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                              >
                                <option value="goal">Tor</option>
                                <option value="assist">Vorlage</option>
                                <option value="yellow_card">Gelbe Karte</option>
                                <option value="red_card">Rote Karte</option>
                                <option value="clean_sheet">Ohne Gegentor</option>
                                <option value="penalty_saved">Elfmeter gehalten</option>
                                <option value="penalty_missed">Elfmeter verschossen</option>
                              </select>
                            </div>

                            <div className="flex gap-2 w-full sm:w-auto">
                              <div className="w-full sm:w-20 space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Min</label>
                                <input
                                  type="number"
                                  value={event.minute || ''}
                                  onChange={(e) => handleUpdateEventRow(index, 'minute', e.target.value ? parseInt(e.target.value) : null)}
                                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                                  placeholder="Min"
                                />
                              </div>
                              <div className="w-full sm:w-20 space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Extra</label>
                                <input
                                  type="number"
                                  value={event.extra_minute || 0}
                                  onChange={(e) => handleUpdateEventRow(index, 'extra_minute', e.target.value ? parseInt(e.target.value) : 0)}
                                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                                  placeholder="+Min"
                                />
                              </div>
                            </div>

                            <button
                              onClick={() => handleRemoveEventRow(index)}
                              className="absolute -top-2 -right-2 sm:static sm:mt-6 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}

                        <button
                          onClick={handleAddEventRow}
                          className="w-full py-4 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-500 hover:text-amber-500 hover:border-amber-500/50 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
                        >
                          <Plus className="w-4 h-4" />
                          Weiteres Ereignis hinzufügen
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-8 mt-auto flex gap-3">
                    <button
                      onClick={() => setEventsModal({ isOpen: false, fixtureId: null })}
                      className="flex-1 bg-zinc-800 text-white font-bold py-4 rounded-2xl hover:bg-zinc-700 transition-all uppercase text-sm tracking-widest"
                    >
                      Abbrechen
                    </button>
                    <button
                      disabled={savingEvents || loadingEvents}
                      onClick={handleSaveEvents}
                      className="flex-[2] bg-amber-500 text-black font-black py-4 rounded-2xl hover:bg-amber-600 transition-all uppercase italic tracking-tighter flex items-center justify-center gap-2"
                    >
                      {savingEvents ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                      EREIGNISSE SPEICHERN
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <DeleteConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, id: null })}
          onConfirm={handleConfirmDelete}
          title="Spiel löschen?"
          message="Bist du sicher, dass du dieses Spiel löschen möchtest? Dies löscht auch alle damit verbundenen Aufstellungen. Diese Aktion kann nicht rückgängig gemacht werden."
          loading={deleting}
        />

        {/* Rating Confirmation Modal */}
        <AnimatePresence>
          {ratingConfirmModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative overflow-hidden"
              >
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 blur-[100px]" />
                
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-blue-500/10 rounded-2xl">
                      <Star className="w-6 h-6 text-blue-500" />
                    </div>
                    <button 
                      onClick={() => setRatingConfirmModal({ isOpen: false, fixtureId: null })}
                      className="p-2 text-zinc-500 hover:text-white transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">
                      Bewertungen verarbeiten?
                    </h2>
                    <p className="text-zinc-400 font-medium leading-relaxed">
                      Bist du sicher, dass du die Bewertungen für dieses Spiel verarbeiten möchtest? Dies aktualisiert die Spielerwerte basierend auf den Community-Abstimmungen und kann nicht rückgängig gemacht werden.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      onClick={confirmProcessRatings}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                    >
                      VERARBEITUNG BESTÄTIGEN
                    </button>
                    <button
                      onClick={() => setRatingConfirmModal({ isOpen: false, fixtureId: null })}
                      className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-2xl transition-all"
                    >
                      ABBRECHEN
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Status Modal */}
        <AnimatePresence>
          {statusModal.isOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative overflow-hidden"
              >
                <div className={`absolute -top-24 -right-24 w-48 h-48 ${statusModal.type === 'success' ? 'bg-emerald-500/10' : 'bg-red-500/10'} blur-[100px]`} />
                
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 ${statusModal.type === 'success' ? 'bg-emerald-500/10' : 'bg-red-500/10'} rounded-2xl`}>
                      {statusModal.type === 'success' ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                    <button 
                      onClick={() => setStatusModal({ ...statusModal, isOpen: false })}
                      className="p-2 text-zinc-500 hover:text-white transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">
                      {statusModal.title}
                    </h2>
                    <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      <p className="text-zinc-400 font-medium leading-relaxed break-words whitespace-pre-wrap text-sm">
                        {statusModal.message}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setStatusModal({ ...statusModal, isOpen: false })}
                    className={`w-full ${statusModal.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'} text-white font-black py-4 rounded-2xl transition-all`}
                  >
                    SCHLIESSEN
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminFixtures;

const StatusBadge: React.FC<{ label: string; active: boolean; color: 'emerald' | 'blue' | 'purple' }> = ({ label, active, color }) => {
  const colors = {
    emerald: active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-zinc-900 text-zinc-700 border-zinc-800',
    blue: active ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-zinc-900 text-zinc-700 border-zinc-800',
    purple: active ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : 'bg-zinc-900 text-zinc-700 border-zinc-800'
  };

  return (
    <div className={`px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-widest transition-all ${colors[color]}`}>
      {label}
    </div>
  );
};
