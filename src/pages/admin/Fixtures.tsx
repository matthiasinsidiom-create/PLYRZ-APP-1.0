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
  Shield,
  Star
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
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

      // Fetch processed counts
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
      // Validate IDs are present
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

      const payload = {
        league_id: formData.league_id,
        home_team_id: formData.home_team_id,
        away_team_id: formData.away_team_id,
        kickoff_at: formData.kickoff_at ? new Date(formData.kickoff_at).toISOString() : null,
        status: formData.status,
        venue_name: formData.venue_name || null,
        home_score: formData.home_score !== '' ? parseInt(formData.home_score) : null,
        away_score: formData.away_score !== '' ? parseInt(formData.away_score) : null,
        checkin_code: formData.checkin_code || null,
        checkin_opens_at: formData.checkin_opens_at ? new Date(formData.checkin_opens_at).toISOString() : null,
        checkin_closes_at: formData.checkin_closes_at ? new Date(formData.checkin_closes_at).toISOString() : null
      };

      console.log('DEBUG: Submitting fixture payload:', JSON.stringify(payload, null, 2));
      console.log('DEBUG: typeof home_team_id:', typeof payload.home_team_id);
      console.log('DEBUG: typeof away_team_id:', typeof payload.away_team_id);

      if (editingFixture) {
        const result = await supabaseService.updateFixture(editingFixture.id, payload);
        console.log('DEBUG: Update fixture success:', result);
      } else {
        const result = await supabaseService.createFixture(payload);
        console.log('DEBUG: Create fixture success:', result);
      }
      setIsModalOpen(false);
      await loadData();
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
    
    try {
      const results = await supabaseService.processFixtureRatings(targetId);
      console.log('DEBUG: [FRONTEND] Rating processing successful. Results:', results);
      
      setStatusModal({
        isOpen: true,
        title: 'Processing Complete',
        message: `Successfully processed ratings for ${results.length} players. Player stats have been updated.`,
        type: 'success'
      });
      
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('DEBUG: [FRONTEND] Rating processing failed:', err);
      setStatusModal({
        isOpen: true,
        title: 'Processing Failed',
        message: err.message || 'An unexpected error occurred while processing ratings.',
        type: 'error'
      });
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
              <h1 className="text-3xl font-black italic tracking-tighter uppercase">FIXTURES</h1>
              <p className="text-zinc-500 font-medium text-sm">Schedule & results</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
            NEW FIXTURE
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text"
            placeholder="Search fixtures..."
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
                className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    <Trophy className="w-3 h-3 text-emerald-500" />
                    {fixture.leagues?.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenModal(fixture)}
                      className="p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(fixture.id)}
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
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest line-clamp-1">
                        {fixture.home_team?.name}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-1">
                    {fixture.status === 'finished' ? (
                      <div className="text-3xl font-black italic tracking-tighter flex items-center gap-3">
                        <span>{fixture.home_score}</span>
                        <span className="text-zinc-700">-</span>
                        <span>{fixture.away_score}</span>
                      </div>
                    ) : (
                      <div className="px-3 py-1 bg-zinc-800 rounded-lg text-xs font-bold text-zinc-400">
                        VS
                      </div>
                    )}
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${fixture.status === 'finished' ? 'text-zinc-500' : 'text-emerald-500'}`}>
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
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest line-clamp-1">
                        {fixture.away_team?.name}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-zinc-500 text-xs font-medium">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {new Date(fixture.kickoff_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3" />
                      {fixture.venue_name || 'TBD'}
                    </div>
                    {processedCounts[fixture.id] > 0 && (
                      <div className="flex items-center gap-2 text-blue-500 font-bold">
                        <Star className="w-3 h-3" />
                        Ratings Processed ({processedCounts[fixture.id]})
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(fixture.status === 'finished' || fixture.status === 'live' || fixture.status === 'upcoming') && (
                      <button
                        onClick={() => navigate('/admin/lineups')}
                        className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Appearances
                      </button>
                    )}
                    {fixture.status === 'finished' && (
                      <button
                        onClick={() => handleProcessRatings(fixture.id)}
                        disabled={processingRatings}
                        className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                      >
                        {processingRatings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                        Ratings
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase">
                    {editingFixture ? 'EDIT FIXTURE' : 'NEW FIXTURE'}
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
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">League</label>
                    <select
                      required
                      value={formData.league_id}
                      onChange={(e) => setFormData({ ...formData, league_id: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                    >
                      <option value="">Select a league</option>
                      {leagues.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Home Team</label>
                      <select
                        required
                        value={formData.home_team_id}
                        onChange={(e) => setFormData({ ...formData, home_team_id: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                      >
                        <option value="">Select home team</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.clubs?.name} – {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Away Team</label>
                      <select
                        required
                        value={formData.away_team_id}
                        onChange={(e) => setFormData({ ...formData, away_team_id: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                      >
                        <option value="">Select away team</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.clubs?.name} – {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Home Score</label>
                      <input 
                        type="number"
                        value={formData.home_score}
                        onChange={(e) => setFormData({ ...formData, home_score: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Away Score</label>
                      <input 
                        type="number"
                        value={formData.away_score}
                        onChange={(e) => setFormData({ ...formData, away_score: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Kickoff At</label>
                      <input 
                        required
                        type="datetime-local"
                        value={formData.kickoff_at}
                        onChange={(e) => setFormData({ ...formData, kickoff_at: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                      >
                        <option value="upcoming">Scheduled</option>
                        <option value="live">Live</option>
                        <option value="finished">Finished</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Venue Name</label>
                    <input 
                      type="text"
                      value={formData.venue_name}
                      onChange={(e) => setFormData({ ...formData, venue_name: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                      placeholder="e.g. Wembley Stadium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Check-in Code</label>
                    <input 
                      type="text"
                      value={formData.checkin_code}
                      onChange={(e) => setFormData({ ...formData, checkin_code: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors font-mono uppercase"
                      placeholder="ABCDEF"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Check-in Opens</label>
                      <input 
                        type="datetime-local"
                        value={formData.checkin_opens_at}
                        onChange={(e) => setFormData({ ...formData, checkin_opens_at: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Check-in Closes</label>
                      <input 
                        type="datetime-local"
                        value={formData.checkin_closes_at}
                        onChange={(e) => setFormData({ ...formData, checkin_closes_at: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  {editingFixture && (formData.status === 'finished' || formData.status === 'live' || formData.status === 'upcoming') && (
                    <div className="space-y-3 mb-6">
                      <button
                        type="button"
                        onClick={() => navigate('/admin/lineups')}
                        className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        MANAGE MATCH APPEARANCES
                      </button>

                      {formData.status === 'finished' && (
                        <button
                          type="button"
                          disabled={processingRatings}
                          onClick={handleProcessRatings}
                          className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest disabled:opacity-50"
                        >
                          {processingRatings ? <Loader2 className="w-5 h-5 animate-spin" /> : <Star className="w-5 h-5" />}
                          PROCESS RATINGS
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    disabled={submitting}
                    type="submit"
                    className="w-full bg-red-500 text-white font-black py-4 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    {editingFixture ? 'UPDATE FIXTURE' : 'CREATE FIXTURE'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <DeleteConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, id: null })}
          onConfirm={handleConfirmDelete}
          title="Delete Fixture?"
          message="Are you sure you want to delete this fixture? This will also delete any match appearances associated with it. This action cannot be undone."
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
                      Process Ratings?
                    </h2>
                    <p className="text-zinc-400 font-medium leading-relaxed">
                      Are you sure you want to process ratings for this match? This will update player stats based on community votes and cannot be undone.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      onClick={confirmProcessRatings}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                    >
                      CONFIRM PROCESSING
                    </button>
                    <button
                      onClick={() => setRatingConfirmModal({ isOpen: false, fixtureId: null })}
                      className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-2xl transition-all"
                    >
                      CANCEL
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
                    <p className="text-zinc-400 font-medium leading-relaxed">
                      {statusModal.message}
                    </p>
                  </div>

                  <button
                    onClick={() => setStatusModal({ ...statusModal, isOpen: false })}
                    className={`w-full ${statusModal.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'} text-white font-black py-4 rounded-2xl transition-all`}
                  >
                    CLOSE
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
