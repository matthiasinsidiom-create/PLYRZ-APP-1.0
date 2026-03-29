import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, 
  Plus, 
  Edit2, 
  Trash2, 
  ArrowLeft,
  Search,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import DeleteConfirmationModal from '../../components/admin/DeleteConfirmationModal';

const AdminLeagues: React.FC = () => {
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeague, setEditingLeague] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    region: '',
    level: 1,
    is_active: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadLeagues();
  }, []);

  const loadLeagues = async () => {
    try {
      const data = await supabaseService.getLeagues();
      setLeagues(data);
    } catch (err) {
      console.error('Error loading leagues:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (league: any = null) => {
    if (league) {
      setEditingLeague(league);
      setFormData({
        name: league.name || '',
        region: league.region || '',
        level: league.level || 1,
        is_active: league.is_active ?? true
      });
    } else {
      setEditingLeague(null);
      setFormData({
        name: '',
        region: '',
        level: 1,
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingLeague) {
        await supabaseService.updateLeague(editingLeague.id, formData);
      } else {
        await supabaseService.createLeague(formData);
      }
      setIsModalOpen(false);
      loadLeagues();
    } catch (err) {
      alert('Error saving league: ' + (err as any).message);
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
    console.log(`DEBUG: [FRONTEND] Initiating delete for league ID: ${deleteModal.id}`);
    
    try {
      await supabaseService.deleteLeague(deleteModal.id);
      console.log(`DEBUG: [FRONTEND] Delete successful for league ID: ${deleteModal.id}, refreshing list...`);
      setDeleteModal({ isOpen: false, id: null });
      await loadLeagues();
    } catch (err) {
      console.error(`DEBUG: [FRONTEND] Failed to delete league ID: ${deleteModal.id}`, err);
      alert(`Error deleting league: ${(err as any).message || 'Unknown error'}\n\nCheck console for details.`);
    } finally {
      setDeleting(false);
    }
  };

  const filteredLeagues = leagues.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.region && l.region.toLowerCase().includes(searchTerm.toLowerCase()))
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
              <h1 className="text-3xl font-black italic tracking-tighter uppercase">LEAGUES</h1>
              <p className="text-zinc-500 font-medium text-sm">Manage competitive tiers</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-3 px-6 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
            NEW LEAGUE
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text"
            placeholder="Search leagues..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLeagues.map((league) => (
              <motion.div
                key={league.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-emerald-500/10 rounded-xl">
                    <Trophy className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenModal(league)}
                      className="p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(league.id)}
                      className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{league.name}</h3>
                  <p className="text-zinc-500 text-sm">{league.region || 'No region'} • Level {league.level}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${league.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {league.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase">
                    {editingLeague ? 'EDIT LEAGUE' : 'NEW LEAGUE'}
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
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">League Name</label>
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      placeholder="e.g. Premier League"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Region</label>
                    <input 
                      type="text"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      placeholder="e.g. London"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Level</label>
                      <input 
                        type="number"
                        min="1"
                        value={formData.level}
                        onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                        className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all ${formData.is_active ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'}`}
                      >
                        {formData.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </button>
                    </div>
                  </div>

                  <button
                    disabled={submitting}
                    type="submit"
                    className="w-full bg-emerald-500 text-black font-black py-4 rounded-xl hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    {editingLeague ? 'UPDATE LEAGUE' : 'CREATE LEAGUE'}
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
          title="Delete League?"
          message="Are you sure you want to delete this league? This will also delete all clubs, teams, and players associated with it. This action cannot be undone."
          loading={deleting}
        />
      </div>
    </div>
  );
};

export default AdminLeagues;
