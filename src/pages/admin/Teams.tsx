import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutGrid, 
  Plus, 
  Edit2, 
  Trash2, 
  ArrowLeft,
  Search,
  Check,
  X,
  Loader2,
  Shield
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import DeleteConfirmationModal from '../../components/admin/DeleteConfirmationModal';

const AdminTeams: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    club_id: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [teamsData, clubsData] = await Promise.all([
        supabaseService.getTeams(),
        supabaseService.getClubs()
      ]);
      setTeams(teamsData);
      setClubs(clubsData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (team: any = null) => {
    if (team) {
      setEditingTeam(team);
      setFormData({
        name: team.name || '',
        club_id: team.club_id || ''
      });
    } else {
      setEditingTeam(null);
      setFormData({
        name: '',
        club_id: clubs[0]?.id || ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingTeam) {
        await supabaseService.updateTeam(editingTeam.id, formData);
      } else {
        await supabaseService.createTeam(formData);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      alert('Error saving team: ' + (err as any).message);
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
    console.log(`DEBUG: [FRONTEND] Initiating delete for team ID: ${deleteModal.id}`);
    
    try {
      await supabaseService.deleteTeam(deleteModal.id);
      console.log(`DEBUG: [FRONTEND] Delete successful for team ID: ${deleteModal.id}, refreshing list...`);
      setDeleteModal({ isOpen: false, id: null });
      await loadData();
    } catch (err) {
      console.error(`DEBUG: [FRONTEND] Failed to delete team ID: ${deleteModal.id}`, err);
      alert(`Error deleting team: ${(err as any).message || 'Unknown error'}\n\nCheck console for details.`);
    } finally {
      setDeleting(false);
    }
  };

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.clubs?.name && t.clubs.name.toLowerCase().includes(searchTerm.toLowerCase()))
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
              <h1 className="text-3xl font-black italic tracking-tighter uppercase">TEAMS</h1>
              <p className="text-zinc-500 font-medium text-sm">Manage squads</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
            NEW TEAM
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text"
            placeholder="Search teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.map((team) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-purple-500/10 rounded-xl">
                    <LayoutGrid className="w-6 h-6 text-purple-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenModal(team)}
                      className="p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(team.id)}
                      className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{team.name}</h3>
                  <p className="text-zinc-500 text-sm flex items-center gap-2">
                    <Shield className="w-3 h-3" />
                    {team.clubs?.name || 'No club'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                    {team.clubs?.name ? 'Active' : 'Draft'}
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
                    {editingTeam ? 'EDIT TEAM' : 'NEW TEAM'}
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
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Team Name</label>
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                      placeholder="e.g. First Team"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Club</label>
                    <select
                      required
                      value={formData.club_id}
                      onChange={(e) => setFormData({ ...formData, club_id: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                    >
                      <option value="">Select a club</option>
                      {clubs.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    disabled={submitting}
                    type="submit"
                    className="w-full bg-purple-500 text-white font-black py-4 rounded-xl hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    {editingTeam ? 'UPDATE TEAM' : 'CREATE TEAM'}
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
          title="Delete Team?"
          message="Are you sure you want to delete this team? This will also delete all players associated with it. This action cannot be undone."
          loading={deleting}
        />
      </div>
    </div>
  );
};

export default AdminTeams;
