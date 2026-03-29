import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Plus, 
  Edit2, 
  Trash2, 
  ArrowLeft,
  Search,
  Check,
  X,
  Loader2,
  Trophy
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import DeleteConfirmationModal from '../../components/admin/DeleteConfirmationModal';

const AdminClubs: React.FC = () => {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<any[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    league_id: '',
    logo_url: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
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
      const [clubsData, leaguesData] = await Promise.all([
        supabaseService.getClubs(),
        supabaseService.getLeagues()
      ]);
      setClubs(clubsData);
      setLeagues(leaguesData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (club: any = null) => {
    setLogoPreview(null);
    if (club) {
      setEditingClub(club);
      setFormData({
        name: club.name || '',
        short_name: club.short_name || '',
        league_id: club.league_id || '',
        logo_url: club.logo_url || ''
      });
    } else {
      setEditingClub(null);
      setFormData({
        name: '',
        short_name: '',
        league_id: leagues[0]?.id || '',
        logo_url: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('DEBUG: [FRONTEND] Selected file detected:', file.name, file.size, file.type);

    const localUrl = URL.createObjectURL(file);
    setLogoPreview(localUrl);

    setUploading(true);
    console.log('DEBUG: [FRONTEND] Upload started...');
    try {
      const publicUrl = await supabaseService.uploadClubLogo(file);
      console.log('DEBUG: [FRONTEND] Upload success result:', publicUrl);
      setFormData(prev => {
        const next = { ...prev, logo_url: publicUrl };
        console.log('DEBUG: [FRONTEND] Updated formData with logo_url:', next);
        return next;
      });
    } catch (err: any) {
      console.error('DEBUG: [FRONTEND] Upload failed:', err);
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    console.log('DEBUG: [FRONTEND] handleSubmit called. Current formData:', formData);
    
    try {
      if (editingClub) {
        console.log('DEBUG: [FRONTEND] Updating club ID:', editingClub.id, 'Payload:', formData);
        const updatedClub = await supabaseService.updateClub(editingClub.id, formData);
        console.log('DEBUG: [FRONTEND] Final saved club response (update):', updatedClub);
      } else {
        console.log('DEBUG: [FRONTEND] Creating new club. Payload:', formData);
        const result = await supabaseService.createClub(formData);
        console.log('DEBUG: [FRONTEND] Final saved club response (create):', result);
        
        if (result.teamErrors && result.teamErrors.length > 0) {
          const failedTeams = result.teamErrors.map((te: any) => te.name).join(', ');
          alert(`Club "${result.club.name}" was created successfully, but there were errors creating the default teams: ${failedTeams}.\n\nYou may need to create them manually in the Teams section.`);
        }
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('DEBUG: [FRONTEND] handleSubmit failed:', err);
      alert('Error saving club: ' + (err as any).message);
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
    console.log(`DEBUG: [FRONTEND] Initiating delete for club ID: ${deleteModal.id}`);
    
    try {
      await supabaseService.deleteClub(deleteModal.id);
      console.log(`DEBUG: [FRONTEND] Delete successful for club ID: ${deleteModal.id}, refreshing list...`);
      setDeleteModal({ isOpen: false, id: null });
      await loadData();
    } catch (err) {
      console.error(`DEBUG: [FRONTEND] Failed to delete club ID: ${deleteModal.id}`, err);
      alert(`Error deleting club: ${(err as any).message || 'Unknown error'}\n\nCheck console for details.`);
    } finally {
      setDeleting(false);
    }
  };

  const filteredClubs = clubs.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.short_name && c.short_name.toLowerCase().includes(searchTerm.toLowerCase()))
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
              <h1 className="text-3xl font-black italic tracking-tighter uppercase">CLUBS</h1>
              <p className="text-zinc-500 font-medium text-sm">Manage organizations</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
            NEW CLUB
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text"
            placeholder="Search clubs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClubs.map((club) => (
              <motion.div
                key={club.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="w-16 h-16 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
                    {club.logo_url ? (
                      <img 
                        src={club.logo_url} 
                        alt={club.name} 
                        className="w-full h-full object-contain p-2" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Shield className="w-8 h-8 text-zinc-600" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenModal(club)}
                      className="p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(club.id)}
                      className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{club.name}</h3>
                  <p className="text-zinc-500 text-sm">{club.short_name || 'No short name'}</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
                  <Trophy className="w-3 h-3 text-emerald-500" />
                  {club.leagues?.name || 'No league'}
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
                    {editingClub ? 'EDIT CLUB' : 'NEW CLUB'}
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
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Club Name</label>
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                      placeholder="e.g. Manchester United"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Short Name</label>
                    <input 
                      type="text"
                      value={formData.short_name}
                      onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                      placeholder="e.g. MUN"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">League</label>
                    <select
                      required
                      value={formData.league_id}
                      onChange={(e) => setFormData({ ...formData, league_id: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                    >
                      <option value="">Select a league</option>
                      {leagues.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Logo</label>
                    <div className="flex gap-4 items-center">
                      {(formData.logo_url || logoPreview) ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 flex-shrink-0">
                          <img 
                            src={logoPreview || formData.logo_url} 
                            alt="Logo Preview" 
                            className="w-full h-full object-contain p-2"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                          <Shield className="w-6 h-6 text-zinc-600" />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <input 
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label 
                          htmlFor="logo-upload"
                          className="flex items-center justify-center gap-2 w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white cursor-pointer hover:bg-zinc-700 transition-colors"
                        >
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          {formData.logo_url ? 'CHANGE LOGO' : 'UPLOAD LOGO'}
                        </label>
                        <input 
                          type="url"
                          value={formData.logo_url}
                          onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                          className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl py-2 px-4 text-[10px] text-zinc-400 focus:outline-none focus:border-blue-500/50 transition-colors"
                          placeholder="Or enter URL directly..."
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={submitting}
                    type="submit"
                    className="w-full bg-blue-500 text-white font-black py-4 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    {editingClub ? 'UPDATE CLUB' : 'CREATE CLUB'}
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
          title="Delete Club?"
          message="Are you sure you want to delete this club? This will also delete all teams and players associated with it. This action cannot be undone."
          loading={deleting}
        />
      </div>
    </div>
  );
};

export default AdminClubs;
