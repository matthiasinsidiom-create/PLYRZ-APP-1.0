import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  ArrowLeft,
  Search,
  Check,
  X,
  Loader2,
  LayoutGrid,
  Shield
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import DeleteConfirmationModal from '../../components/admin/DeleteConfirmationModal';

const AdminPlayers: React.FC = () => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    team_id: '',
    position: 'Forward',
    shirt_number: '',
    photo_url: '',
    birth_year: '',
    is_active: true
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
      const [playersData, teamsData] = await Promise.all([
        supabaseService.getPlayers(),
        supabaseService.getTeams()
      ]);
      setPlayers(playersData);
      setTeams(teamsData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (player: any = null) => {
    if (player) {
      setEditingPlayer(player);
      setFormData({
        full_name: player.full_name || '',
        team_id: player.team_id || '',
        position: player.position || 'Forward',
        shirt_number: player.shirt_number?.toString() || '',
        photo_url: player.photo_url || '',
        birth_year: player.birth_year?.toString() || '',
        is_active: player.is_active ?? true
      });
    } else {
      setEditingPlayer(null);
      setFormData({
        full_name: '',
        team_id: teams[0]?.id || '',
        position: 'Forward',
        shirt_number: '',
        photo_url: '',
        birth_year: '',
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Detailed logging for debugging
    console.log('DEBUG: Form submission started');
    console.log('DEBUG: Form data:', formData);
    
    try {
      // Mapping form fields to database fields correctly
      const payload = {
        full_name: formData.full_name,
        team_id: formData.team_id, // This should be a UUID string from the select
        position: formData.position,
        shirt_number: formData.shirt_number ? parseInt(formData.shirt_number) : null,
        photo_url: formData.photo_url,
        birth_year: formData.birth_year ? parseInt(formData.birth_year) : null,
        is_active: formData.is_active
      };

      console.log('DEBUG: Final payload being sent to service:', payload);
      console.log('DEBUG: team_id type:', typeof payload.team_id);

      if (editingPlayer) {
        await supabaseService.updatePlayer(editingPlayer.id, payload);
      } else {
        const result = await supabaseService.createPlayer(payload);
        if ((result as any).statsError) {
          alert(`Player created successfully, but initial stats could not be initialized: ${(result as any).statsError}. You can update them later.`);
        }
      }
      
      console.log('DEBUG: Submission successful');
      setIsModalOpen(false);
      // Refresh the list from Supabase immediately
      await loadData();
    } catch (err) {
      console.error('DEBUG: Submission failed:', err);
      alert('Error saving player: ' + (err as any).message);
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
    console.log(`DEBUG: [FRONTEND] Initiating delete for player ID: ${deleteModal.id}`);
    
    try {
      await supabaseService.deletePlayer(deleteModal.id);
      console.log(`DEBUG: [FRONTEND] Delete successful for player ID: ${deleteModal.id}, refreshing list...`);
      setDeleteModal({ isOpen: false, id: null });
      await loadData();
    } catch (err) {
      console.error(`DEBUG: [FRONTEND] Failed to delete player ID: ${deleteModal.id}`, err);
      alert(`Error deleting player: ${(err as any).message || 'Unknown error'}\n\nCheck console for details.`);
    } finally {
      setDeleting(false);
    }
  };

  const filteredPlayers = players.filter(p => 
    (p.full_name && p.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.teams?.name && p.teams.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/admin')}
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <h1 className="text-3xl font-black italic tracking-tighter uppercase">PLAYERS</h1>
              <p className="text-zinc-500 font-medium text-sm">Manage athletes</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
            NEW PLAYER
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlayers.map((player) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-orange-500/10 rounded-xl">
                    <Users className="w-6 h-6 text-orange-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenModal(player)}
                      className="p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(player.id)}
                      className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{player.full_name}</h3>
                  <p className="text-zinc-500 text-sm flex items-center gap-2">
                    <LayoutGrid className="w-3 h-3" />
                    {player.teams?.name || 'No team'}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                      {player.position}
                    </span>
                    <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                      {player.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {player.shirt_number && (
                      <span className="px-2 py-1 rounded-md bg-orange-500/10 text-orange-500 text-[10px] font-bold uppercase tracking-wider">
                        #{player.shirt_number}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500 italic">{player.birth_year}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase">
                    {editingPlayer ? 'EDIT PLAYER' : 'NEW PLAYER'}
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
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Full Name</label>
                    <input 
                      required
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                      placeholder="e.g. Cristiano Ronaldo"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Team</label>
                    <select
                      required
                      value={formData.team_id}
                      onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                    >
                      <option value="">Select a team</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.clubs?.name})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Position</label>
                      <select
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                      >
                        <option value="Goalkeeper">Goalkeeper</option>
                        <option value="Defender">Defender</option>
                        <option value="Midfielder">Midfielder</option>
                        <option value="Forward">Forward</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Shirt Number</label>
                      <input 
                        required
                        type="number"
                        value={formData.shirt_number}
                        onChange={(e) => setFormData({ ...formData, shirt_number: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                        placeholder="7"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Photo URL</label>
                    <input 
                      type="url"
                      value={formData.photo_url}
                      onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                      placeholder="https://example.com/photo.jpg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Birth Year</label>
                      <input 
                        type="number"
                        value={formData.birth_year}
                        onChange={(e) => setFormData({ ...formData, birth_year: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                        placeholder="1990"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Is Active</label>
                      <select
                        value={formData.is_active ? 'active' : 'inactive'}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <button
                    disabled={submitting}
                    type="submit"
                    className="w-full bg-white text-black font-black py-4 rounded-xl hover:bg-orange-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    {editingPlayer ? 'UPDATE PLAYER' : 'CREATE PLAYER'}
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
          title="Delete Player?"
          message="Are you sure you want to delete this player? This will also delete their stats and match history. This action cannot be undone."
          loading={deleting}
        />
      </div>
    </div>
  );
};

export default AdminPlayers;
