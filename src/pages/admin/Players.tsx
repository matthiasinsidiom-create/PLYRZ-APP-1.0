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
  Shield,
  Move,
  Maximize2,
  RotateCcw,
  Save,
  Globe,
  Copy,
  Palette,
  Crown
} from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { supabaseService } from '../../services/supabaseService';
import DeleteConfirmationModal from '../../components/admin/DeleteConfirmationModal';
import { PlayerCard } from '../../components/PlayerCard';
import { POSITIONS, getPositionShort } from '../../lib/positions';

const NATIONALITIES = [
  { code: 'al', name: 'Albania' },
  { code: 'ar', name: 'Argentina' },
  { code: 'at', name: 'Austria' },
  { code: 'be', name: 'Belgium' },
  { code: 'ba', name: 'Bosnia and Herzegovina' },
  { code: 'br', name: 'Brazil' },
  { code: 'bg', name: 'Bulgaria' },
  { code: 'hr', name: 'Croatia' },
  { code: 'cz', name: 'Czech Republic' },
  { code: 'eg', name: 'Egypt' },
  { code: 'fr', name: 'France' },
  { code: 'de', name: 'Germany' },
  { code: 'hu', name: 'Hungary' },
  { code: 'it', name: 'Italy' },
  { code: 'jp', name: 'Japan' },
  { code: 'xk', name: 'Kosovo' },
  { code: 'ma', name: 'Morocco' },
  { code: 'me', name: 'Montenegro' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'mk', name: 'North Macedonia' },
  { code: 'pl', name: 'Poland' },
  { code: 'pt', name: 'Portugal' },
  { code: 'ro', name: 'Romania' },
  { code: 'sn', name: 'Senegal' },
  { code: 'rs', name: 'Serbia' },
  { code: 'sk', name: 'Slovakia' },
  { code: 'si', name: 'Slovenia' },
  { code: 'kr', name: 'South Korea' },
  { code: 'es', name: 'Spain' },
  { code: 'ch', name: 'Switzerland' },
  { code: 'tr', name: 'Turkey' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'us', name: 'USA' },
];

const DEFAULT_COLOR_CONFIG = {
  mode: 'solid',
  color: '#ffffff',
  gradientStart: '#ffffff',
  gradientEnd: '#cccccc',
  gradientDirection: 'vertical'
};

const DEFAULT_TIER_LAYOUT = {
  overall: { x: 18, y: 8, fontSize: 52, ...DEFAULT_COLOR_CONFIG },
  position: { x: 18, y: 18, fontSize: 24, ...DEFAULT_COLOR_CONFIG },
  flag: { x: 18, y: 28, width: 52, height: 32 },
  club: { x: 18, y: 38, width: 56, height: 56 },
  player: { x: 30, y: 18, width: 55, height: 34, scale: 1.15, focusX: 50, focusY: 20 },
  name: { x: 50, y: 53, fontSize: 28, ...DEFAULT_COLOR_CONFIG },
  statsLeft: { x: 24, y: 74, fontSize: 18, ...DEFAULT_COLOR_CONFIG },
  statsRight: { x: 58, y: 74, fontSize: 18, ...DEFAULT_COLOR_CONFIG },
  card: { scale: 1, x: 0, y: 0 },
  frame: { scale: 1, x: 0, y: 0 }
};

const DEFAULT_LAYOUT = {
  bronze: { ...DEFAULT_TIER_LAYOUT },
  silver: { ...DEFAULT_TIER_LAYOUT },
  gold: { ...DEFAULT_TIER_LAYOUT }
};

const resolveSafeTierLayout = (layout: any, tier: 'bronze' | 'silver' | 'gold') => {
  const base = JSON.parse(JSON.stringify(DEFAULT_TIER_LAYOUT));
  if (!layout) return base;
  
  const isMultiTier = !!(layout.bronze || layout.silver || layout.gold);
  const tierSource = isMultiTier ? (layout[tier] || {}) : layout;
  
  Object.keys(base).forEach(key => {
    const elementDefaults = (DEFAULT_TIER_LAYOUT as any)[key] || {};
    const elementSource = tierSource[key] || {};
    base[key] = { ...elementDefaults, ...elementSource };
  });
  
  return base;
};

const resolveSafeLayout = (source: any) => {
  const merged = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
  if (!source) return merged;
  
  const isMultiTier = !!(source.bronze || source.silver || source.gold);
  
  (['bronze', 'silver', 'gold'] as const).forEach(tier => {
    merged[tier] = resolveSafeTierLayout(source, tier);
  });
  
  return merged;
};

const AdminPlayers: React.FC = () => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    team_id: '',
    position: 'Sturm',
    jersey_number: '',
    photo_url: '',
    birth_year: '',
    is_active: true,
    is_premium: false,
    premium_until: '',
    nationality: 'de',
    club_id: '',
    overall: '50',
    stats: {
      tem: '50',
      sch: '50',
      pas: '50',
      dri: '50',
      def: '50',
      phy: '50'
    },
    card_layout: { ...DEFAULT_LAYOUT }
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null
  });
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'layout'>('info');
  const [activeTier, setActiveTier] = useState<'bronze' | 'silver' | 'gold'>('bronze');
  const [globalDefaultLayout, setGlobalDefaultLayout] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [playersData, teamsData, clubsData, globalLayout] = await Promise.all([
        supabaseService.getPlayers(),
        supabaseService.getTeams(),
        supabaseService.getClubs(),
        supabaseService.getGlobalSettings('default_player_card_layout')
      ]);
      setPlayers(playersData);
      setTeams(teamsData);
      setClubs(clubsData);
      
      if (globalLayout) {
        console.log('DEBUG: [ADMIN] Loaded global default layout:', globalLayout);
        setGlobalDefaultLayout(globalLayout);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (player: any = null) => {
    setActiveTab('info');
    setPreviewUrl(null);
    
    if (player) {
      console.log('DEBUG: [ADMIN] Player loaded for edit:', player.full_name, player.id);
      console.log('DEBUG: [ADMIN] Player teams data:', player.teams);
      console.log('DEBUG: [ADMIN] Player club_id to preload:', player.teams?.club_id);
      setEditingPlayer(player);
      
      const stats = player.current_stats || {};
      console.log('DEBUG: [ADMIN] Stats read from Supabase (count: ' + (player.player_stats?.length || 0) + '):', stats);
      
      // Determine active tier based on overall
      const ovr = parseInt(stats.overall || '50');
      const playerTier = ovr >= 75 ? 'gold' : ovr >= 65 ? 'silver' : 'bronze';
      setActiveTier(playerTier);

      // Robustly merge existing layout with DEFAULT_LAYOUT
      const mergedLayout = resolveSafeLayout(player.card_layout);

      const statsToLoad = {
        tem: (stats.tem ?? 50).toString(),
        sch: (stats.sch ?? 50).toString(),
        pas: (stats.pas ?? 50).toString(),
        dri: (stats.dri ?? 50).toString(),
        def: (stats.def ?? 50).toString(),
        phy: (stats.phy ?? 50).toString()
      };
      console.log('DEBUG: [ADMIN] Stats loaded into editor state:', statsToLoad);

      setFormData({
        full_name: player.full_name || '',
        team_id: player.team_id || '',
        club_id: player.teams?.club_id || '',
        position: player.position || 'Sturm',
        jersey_number: player.jersey_number?.toString() || '',
        photo_url: player.photo_url || '',
        birth_year: player.birth_year?.toString() || '',
        is_active: player.is_active ?? true,
        is_premium: player.is_premium ?? false,
        premium_until: player.premium_until ? new Date(player.premium_until).toISOString().split('T')[0] : '',
        nationality: player.nationality || 'de',
        overall: (stats.overall ?? 50).toString(),
        stats: statsToLoad,
        card_layout: mergedLayout
      });
    } else {
      setEditingPlayer(null);
      setActiveTier('bronze');
      
      // Merge globalDefaultLayout with DEFAULT_LAYOUT if it exists
      const initialLayout = resolveSafeLayout(globalDefaultLayout);

      setFormData({
        full_name: '',
        team_id: teams[0]?.id || '',
        club_id: teams[0]?.club_id || '',
        position: 'Sturm',
        jersey_number: '',
        photo_url: '',
        birth_year: '',
        is_active: true,
        is_premium: false,
        premium_until: '',
        nationality: 'de',
        overall: '50',
        stats: {
          tem: '50',
          sch: '50',
          pas: '50',
          dri: '50',
          def: '50',
          phy: '50'
        },
        card_layout: initialLayout
      });
    }
    setIsModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('DEBUG: [FRONTEND] Photo selected:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    setUploading(true);
    try {
      console.log('DEBUG: [FRONTEND] Starting photo upload to Supabase...');
      const publicUrl = await supabaseService.uploadPlayerPhoto(file);
      console.log('DEBUG: [FRONTEND] Photo upload success, publicUrl:', publicUrl);
      setFormData(prev => ({ ...prev, photo_url: publicUrl }));
    } catch (err: any) {
      console.error('DEBUG: [FRONTEND] Upload failed:', err);
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.full_name.trim()) {
      alert('Player name is required');
      return;
    }
    if (!formData.position) {
      alert('Position is required');
      return;
    }
    if (!formData.nationality) {
      alert('Nationality is required');
      return;
    }
    if (!formData.team_id) {
      alert('Selected club/team is required');
      return;
    }

    setSubmitting(true);
    
    console.log('DEBUG: [FRONTEND] Starting player save flow');
    console.log('DEBUG: [FRONTEND] Selected Club ID:', formData.club_id);
    console.log('DEBUG: [FRONTEND] Selected Team ID:', formData.team_id);
    console.log('DEBUG: [FRONTEND] Nationality:', formData.nationality);
    console.log('DEBUG: [FRONTEND] Photo URL:', formData.photo_url);
    
    try {
      const playerPayload = {
        full_name: formData.full_name,
        team_id: formData.team_id,
        position: formData.position,
        jersey_number: formData.jersey_number ? parseInt(formData.jersey_number) : null,
        photo_url: formData.photo_url,
        birth_year: formData.birth_year ? parseInt(formData.birth_year) : null,
        is_active: formData.is_active,
        is_premium: formData.is_premium,
        premium_until: formData.premium_until ? new Date(formData.premium_until).toISOString() : null,
        nationality: formData.nationality,
        card_layout: formData.card_layout
      };

      const statsPayload = {
        overall: parseInt(formData.overall) || 50,
        tem: parseInt(formData.stats.tem) || 50,
        sch: parseInt(formData.stats.sch) || 50,
        pas: parseInt(formData.stats.pas) || 50,
        dri: parseInt(formData.stats.dri) || 50,
        def: parseInt(formData.stats.def) || 50,
        phy: parseInt(formData.stats.phy) || 50
      };

      console.log('DEBUG: [FRONTEND] Player Payload:', playerPayload);
      console.log('DEBUG: [FRONTEND] Stats Payload:', statsPayload);

      let result;
      if (editingPlayer) {
        console.log('DEBUG: [FRONTEND] Updating existing player ID:', editingPlayer.id);
        result = await supabaseService.updatePlayer(editingPlayer.id, playerPayload, statsPayload);
        console.log('DEBUG: [FRONTEND] Update success:', result);
      } else {
        console.log('DEBUG: [FRONTEND] Creating new player');
        result = await supabaseService.createPlayer(playerPayload, statsPayload);
        console.log('DEBUG: [FRONTEND] Create success:', result);
      }

      // Verification Step: Read back the player from Supabase to confirm persistence
      if (result && result.id) {
        console.log('DEBUG: [FRONTEND] Verifying persistence for player ID:', result.id);
        const verifiedPlayer = await supabaseService.getPlayerById(result.id);
        console.log('DEBUG: [FRONTEND] Verification result:', verifiedPlayer);
        
        if (!verifiedPlayer) {
          throw new Error('Verification failed: Player was not found in database after save.');
        }
      }
      
      setIsModalOpen(false);
      await loadData();
      alert(editingPlayer ? 'Player updated successfully!' : 'Player created successfully!');
    } catch (err: any) {
      console.error('DEBUG: [FRONTEND] Submission failed:', err);
      const detailedErrorMessage = `${err.message || 'Unknown error'}${err.details ? ` (Details: ${err.details})` : ''}${err.hint ? ` (Hint: ${err.hint})` : ''}${err.code ? ` [Code: ${err.code}]` : ''}`;
      alert('Error saving player: ' + detailedErrorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveGlobalDefault = async () => {
    try {
      setSubmitting(true);
      const layoutToSave = formData.card_layout;
      const key = 'default_player_card_layout';

      console.log('DEBUG: [ADMIN] Save as Global Default Layout button clicked');
      console.log('DEBUG: [ADMIN] Layout payload being saved:', layoutToSave);

      // 1. Perform a real Supabase upsert
      console.log('DEBUG: [ADMIN] Supabase upsert request started for key:', key);
      const upsertResult = await supabaseService.updateGlobalSettings(key, layoutToSave);
      console.log('DEBUG: [ADMIN] Supabase upsert response:', upsertResult);

      // 2. Immediately read back the same row from Supabase
      console.log('DEBUG: [ADMIN] Supabase read-back request started for key:', key);
      const verifiedLayout = await supabaseService.getGlobalSettings(key);
      console.log('DEBUG: [ADMIN] Supabase read-back response:', verifiedLayout);

      // 3. Confirm that the returned row contains the saved value
      if (!verifiedLayout) {
        throw new Error('Verification failed: Read-back returned no data.');
      }

      // 4. Update local globalDefaultLayout state from the read-back result
      setGlobalDefaultLayout(verifiedLayout);
      
      // 5. Apply to all existing players by clearing their individual custom layouts
      console.log('DEBUG: [ADMIN] Clearing individual player layouts to apply global default...');
      await supabaseService.clearAllPlayerLayouts();
      
      // 6. Reload players
      loadData();
      
      console.log('DEBUG: [ADMIN] Final success: Global default layout persisted and applied to all players.');
      alert('Global default layout saved and applied to all players successfully!');
    } catch (err: any) {
      console.error('DEBUG: [ADMIN] Global default save failed:', err);
      const errorMessage = err.message || 'Unknown error';
      alert('Error saving global default: ' + errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const updateLayout = (key: string, updates: any) => {
    setFormData(prev => {
      const layout = prev.card_layout || {};
      const tierData = layout[activeTier] || {};
      const elementData = tierData[key] || {};

      return {
        ...prev,
        card_layout: {
          ...layout,
          [activeTier]: {
            ...tierData,
            [key]: {
              ...elementData,
              ...updates
            }
          }
        }
      };
    });
  };

  const resetLayout = () => {
    setFormData(prev => ({
      ...prev,
      card_layout: { 
        ...(prev.card_layout || {}),
        [activeTier]: JSON.parse(JSON.stringify(DEFAULT_TIER_LAYOUT))
      }
    }));
  };

  const copyLayoutToOtherTiers = () => {
    const currentTierLayout = JSON.parse(JSON.stringify(resolveSafeTierLayout(formData.card_layout, activeTier)));
    
    setFormData(prev => ({
      ...prev,
      card_layout: {
        bronze: currentTierLayout,
        silver: currentTierLayout,
        gold: currentTierLayout
      }
    }));
    
    alert(`Layout from ${activeTier.toUpperCase()} applied to all tiers!`);
  };

  const previewPlayer = {
    ...formData,
    full_name: formData.full_name || 'Player Name',
    photo_url: previewUrl || formData.photo_url,
    claimed_by_user_id: editingPlayer?.claimed_by_user_id,
    player_stats: [{
      overall: parseInt(formData.overall),
      ...Object.fromEntries(Object.entries(formData.stats).map(([k, v]) => [k, parseInt(v as string)]))
    }],
    teams: teams.find(t => t.id === formData.team_id) || (formData.club_id ? { club_id: formData.club_id, clubs: clubs.find(c => c.id === formData.club_id) } : undefined)
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

  const currentLayout = resolveSafeTierLayout(formData.card_layout, activeTier);

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
              <h1 className="text-3xl font-black italic tracking-tighter uppercase">SPIELER</h1>
              <p className="text-zinc-500 font-medium text-sm">Athleten verwalten</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
            NEUER SPIELER
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text"
            placeholder="Spieler suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
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
                className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-orange-500/10 rounded-xl">
                    <Users className="w-6 h-6 text-orange-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    {player.claimed_by_user_id && (
                      <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                        Beansprucht
                      </span>
                    )}
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
                    {player.teams?.name || 'Kein Team'}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                      {getPositionShort(player.position)}
                    </span>
                    <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                      {player.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                    {player.jersey_number && (
                      <span className="px-2 py-1 rounded-md bg-orange-500/10 text-orange-500 text-[10px] font-bold uppercase tracking-wider">
                        #{player.jersey_number}
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
            <div className="fixed inset-0 z-50 flex justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 w-full max-w-4xl shadow-2xl my-auto"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase">
                    {editingPlayer ? 'SPIELER BEARBEITEN' : 'NEUER SPIELER'}
                  </h2>
                  <div className="flex items-center gap-4">
                    <div className="flex bg-zinc-800 p-1 rounded-xl">
                      <button 
                        onClick={() => setActiveTab('info')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'info' ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-white'}`}
                      >
                        INFO
                      </button>
                      <button 
                        onClick={() => setActiveTab('layout')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'layout' ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-white'}`}
                      >
                        LAYOUT
                      </button>
                    </div>
                    <button 
                      onClick={() => setIsModalOpen(false)}
                      className="p-2 text-zinc-500 hover:text-white transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  {/* Left Column: Form */}
                  <div className={activeTab === 'info' ? 'block' : 'hidden lg:block'}>
                    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Vollständiger Name</label>
                        <input 
                          required
                          type="text"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                          placeholder="z.B. Cristiano Ronaldo"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Verein</label>
                          <select
                            required
                            value={formData.club_id}
                            onChange={(e) => {
                              const clubId = e.target.value;
                              const clubTeams = teams.filter(t => t.club_id === clubId);
                              setFormData({ 
                                ...formData, 
                                club_id: clubId,
                                team_id: clubTeams[0]?.id || ''
                              });
                            }}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                          >
                            <option value="">Verein auswählen</option>
                            {clubs.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Team</label>
                          <select
                            required
                            value={formData.team_id}
                            onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                          >
                            <option value="">Team auswählen</option>
                            {teams
                              .filter(t => !formData.club_id || t.club_id === formData.club_id)
                              .map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Nationalität</label>
                          <select
                            value={formData.nationality}
                            onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                          >
                            {NATIONALITIES.map(n => (
                              <option key={n.code} value={n.code}>{n.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Position</label>
                          <select
                            value={formData.position}
                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                          >
                            {POSITIONS.map(pos => (
                              <option key={pos} value={pos}>{pos}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Foto</label>
                        <div className="flex gap-4 items-center">
                          {formData.photo_url || previewUrl ? (
                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 flex-shrink-0">
                              <img 
                                src={previewUrl || formData.photo_url} 
                                alt="Preview" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                              <Users className="w-6 h-6 text-zinc-600" />
                            </div>
                          )}
                          <div className="flex-1 space-y-2">
                            <input 
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              className="hidden"
                              id="photo-upload"
                            />
                            <label 
                              htmlFor="photo-upload"
                              className="flex items-center justify-center gap-2 w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white cursor-pointer hover:bg-zinc-700 transition-colors"
                            >
                              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                              {formData.photo_url ? 'FOTO ÄNDERN' : 'FOTO HOCHLADEN'}
                            </label>
                            <input 
                              type="url"
                              value={formData.photo_url}
                              onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl py-2 px-4 text-[10px] text-zinc-400 focus:outline-none focus:border-orange-500/50 transition-colors"
                              placeholder="Oder URL direkt eingeben..."
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Trikotnummer</label>
                          <input 
                            type="number"
                            value={formData.jersey_number}
                            onChange={(e) => setFormData({ ...formData, jersey_number: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                            placeholder="10"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Geburtsjahr</label>
                          <input 
                            type="number"
                            value={formData.birth_year}
                            onChange={(e) => setFormData({ ...formData, birth_year: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                            placeholder="1990"
                          />
                        </div>
                      </div>

                      <div className="bg-zinc-800/50 p-6 rounded-2xl space-y-4 border border-zinc-800">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Werte & Bewertung</label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-orange-500">OVR</span>
                            <input 
                              type="number"
                              value={formData.overall}
                              onChange={(e) => setFormData({ ...formData, overall: e.target.value })}
                              className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg py-1 px-2 text-center text-white focus:outline-none focus:border-orange-500"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {Object.entries(formData.stats).map(([stat, value]) => (
                            <div key={stat} className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase">{stat}</label>
                              <input 
                                type="number"
                                value={value}
                                onChange={(e) => setFormData({ 
                                  ...formData, 
                                  stats: { ...formData.stats, [stat]: e.target.value } 
                                })}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-2 px-2 text-center text-white focus:outline-none focus:border-orange-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</label>
                          <select
                            value={formData.is_active ? 'active' : 'inactive'}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                          >
                            <option value="active">Aktiv</option>
                            <option value="inactive">Inaktiv</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Crown className="w-3.5 h-3.5" /> Premium
                          </label>
                          <select
                            value={formData.is_premium ? 'yes' : 'no'}
                            onChange={(e) => setFormData({ ...formData, is_premium: e.target.value === 'yes' })}
                            className="w-full bg-zinc-800 border border-amber-500/20 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                          >
                            <option value="no">Nein</option>
                            <option value="yes">Ja (Aktiviert)</option>
                          </select>
                        </div>
                        {formData.is_premium && (
                          <div className="space-y-2 col-span-2">
                            <label className="text-xs font-bold text-amber-500 uppercase tracking-wider">Premium gültig bis</label>
                            <input 
                              type="date"
                              value={formData.premium_until}
                              onChange={(e) => setFormData({ ...formData, premium_until: e.target.value })}
                              className="w-full bg-zinc-800 border border-amber-500/20 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                            />
                            <p className="text-[10px] text-zinc-500">Standard: 2027-06-30</p>
                          </div>
                        )}
                      </div>

                      <button
                        disabled={submitting}
                        type="submit"
                        className="w-full bg-orange-500 text-white font-black py-4 rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {editingPlayer ? 'SPIELER AKTUALISIEREN' : 'SPIELER ERSTELLEN'}
                      </button>
                    </form>
                  </div>

                  {/* Right Column: Preview & Layout Editor */}
                  <div className={`space-y-8 ${activeTab === 'layout' ? 'block' : 'hidden lg:block'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Live-Vorschau</h3>
                        <div className="flex bg-zinc-800 p-1 rounded-xl">
                          {(['bronze', 'silver', 'gold'] as const).map((tier) => (
                            <button
                              key={tier}
                              type="button"
                              onClick={() => setActiveTier(tier)}
                              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                                activeTier === tier 
                                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                                  : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              {tier}
                            </button>
                          ))}
                        </div>
                      </div>
                      {activeTab === 'layout' && (
                        <div className="flex items-center gap-6">
                          <button 
                            type="button"
                            onClick={copyLayoutToOtherTiers}
                            className="flex items-center gap-2 text-xs font-bold text-orange-500 hover:text-orange-400 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            AUF ALLE TIERS ÜBERTRAGEN
                          </button>
                          <button 
                            type="button"
                            onClick={resetLayout}
                            className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            LAYOUT ZURÜCKSETZEN
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-center gap-8">
                      {/* CARD CONTAINER WITH DRAG HANDLERS */}
                      <div className="relative p-12 bg-zinc-800/30 rounded-[40px] border border-zinc-800/50 overflow-hidden flex items-center justify-center min-h-[750px] w-full">
                        <div 
                          className="relative origin-center"
                          style={{ 
                            width: '300px', 
                            height: '420px',
                            transform: `translate(${currentLayout.card.x}px, ${currentLayout.card.y}px) scale(${currentLayout.card.scale})`
                          }}
                        >
                          {/* THE ACTUAL PLAYER CARD */}
                          <PlayerCard 
                            player={previewPlayer as any} 
                            forceTier={activeTier}
                            className="pointer-events-none"
                          />

                          {/* DRAGGABLE OVERLAYS */}
                          {activeTab === 'layout' && (
                            <>
                              {/* Card Frame (Background) */}
                              <motion.div 
                                drag
                                dragMomentum={false}
                                onDrag={(e, info) => {
                                  const rect = (e.target as HTMLElement).parentElement?.getBoundingClientRect();
                                  if (rect) {
                                    // Calculate relative movement from center (50%)
                                    const x = (((info.point.x - rect.left) / rect.width) * 100) - 50;
                                    const y = (((info.point.y - rect.top) / rect.height) * 100) - 50;
                                    updateLayout('frame', { x: Math.round(x), y: Math.round(y) });
                                  }
                                }}
                                style={{ 
                                  position: 'absolute', 
                                  left: `${50 + currentLayout.frame.x}%`, 
                                  top: `${50 + currentLayout.frame.y}%`,
                                  width: `${100 * currentLayout.frame.scale}%`,
                                  height: `${100 * currentLayout.frame.scale}%`,
                                  border: '2px solid #f97316',
                                  borderRadius: '8px',
                                  cursor: 'move',
                                  zIndex: 1,
                                  transform: 'translate(-50%, -50%)',
                                  backgroundColor: 'rgba(249, 115, 22, 0.05)'
                                }}
                              />
                              {/* Overall Rating */}
                              <motion.div 
                                drag
                                dragMomentum={false}
                                onDrag={(e, info) => {
                                  const rect = (e.target as HTMLElement).parentElement?.getBoundingClientRect();
                                  if (rect) {
                                    const x = ((info.point.x - rect.left) / rect.width) * 100;
                                    const y = ((info.point.y - rect.top) / rect.height) * 100;
                                    updateLayout('overall', { x: Math.round(x), y: Math.round(y) });
                                  }
                                }}
                                style={{ 
                                  position: 'absolute', 
                                  left: `${currentLayout.overall.x}%`, 
                                  top: `${currentLayout.overall.y}%`,
                                  width: '50px', height: '50px',
                                  border: '2px dashed #f97316',
                                  borderRadius: '4px',
                                  cursor: 'move',
                                  zIndex: 100,
                                  transform: 'translate(-50%, -50%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: 'rgba(249, 115, 22, 0.1)'
                                }}
                              >
                                <span className="text-[8px] font-black text-orange-500">RATING</span>
                              </motion.div>
                              {/* Position */}
                              <motion.div 
                                drag
                                dragMomentum={false}
                                onDrag={(e, info) => {
                                  const rect = (e.target as HTMLElement).parentElement?.getBoundingClientRect();
                                  if (rect) {
                                    const x = ((info.point.x - rect.left) / rect.width) * 100;
                                    const y = ((info.point.y - rect.top) / rect.height) * 100;
                                    updateLayout('position', { x: Math.round(x), y: Math.round(y) });
                                  }
                                }}
                                style={{ 
                                  position: 'absolute', 
                                  left: `${currentLayout.position.x}%`, 
                                  top: `${currentLayout.position.y}%`,
                                  width: '40px', height: '20px',
                                  border: '1px dashed #f97316',
                                  borderRadius: '4px',
                                  cursor: 'move',
                                  zIndex: 100
                                }}
                              />
                              {/* Flag */}
                              <motion.div 
                                drag
                                dragMomentum={false}
                                onDrag={(e, info) => {
                                  const rect = (e.target as HTMLElement).parentElement?.getBoundingClientRect();
                                  if (rect) {
                                    const x = ((info.point.x - rect.left) / rect.width) * 100;
                                    const y = ((info.point.y - rect.top) / rect.height) * 100;
                                    updateLayout('flag', { x: Math.round(x), y: Math.round(y) });
                                  }
                                }}
                                style={{ 
                                  position: 'absolute', 
                                  left: `${currentLayout.flag.x}%`, 
                                  top: `${currentLayout.flag.y}%`,
                                  width: '40px', height: '25px',
                                  border: '1px dashed #f97316',
                                  borderRadius: '4px',
                                  cursor: 'move',
                                  zIndex: 100
                                }}
                              />
                              {/* Club */}
                              <motion.div 
                                drag
                                dragMomentum={false}
                                onDrag={(e, info) => {
                                  const rect = (e.target as HTMLElement).parentElement?.getBoundingClientRect();
                                  if (rect) {
                                    const x = ((info.point.x - rect.left) / rect.width) * 100;
                                    const y = ((info.point.y - rect.top) / rect.height) * 100;
                                    updateLayout('club', { x: Math.round(x), y: Math.round(y) });
                                  }
                                }}
                                style={{ 
                                  position: 'absolute', 
                                  left: `${currentLayout.club.x}%`, 
                                  top: `${currentLayout.club.y}%`,
                                  width: '40px', height: '40px',
                                  border: '1px dashed #f97316',
                                  borderRadius: '4px',
                                  cursor: 'move',
                                  zIndex: 100
                                }}
                              />
                              {/* Player Image */}
                              <motion.div 
                                drag
                                dragMomentum={false}
                                onDrag={(e, info) => {
                                  const rect = (e.target as HTMLElement).parentElement?.getBoundingClientRect();
                                  if (rect) {
                                    const x = ((info.point.x - rect.left) / rect.width) * 100;
                                    const y = ((info.point.y - rect.top) / rect.height) * 100;
                                    updateLayout('player', { x: Math.round(x), y: Math.round(y) });
                                  }
                                }}
                                style={{ 
                                  position: 'absolute', 
                                  left: `${currentLayout.player.x}%`, 
                                  top: `${currentLayout.player.y}%`,
                                  width: '100px', height: '150px',
                                  border: '1px dashed #f97316',
                                  borderRadius: '4px',
                                  cursor: 'move',
                                  zIndex: 90,
                                  transform: 'translateX(-50%)'
                                }}
                              />
                              {/* Name */}
                              <motion.div 
                                drag
                                dragMomentum={false}
                                onDrag={(e, info) => {
                                  const rect = (e.target as HTMLElement).parentElement?.getBoundingClientRect();
                                  if (rect) {
                                    const x = ((info.point.x - rect.left) / rect.width) * 100;
                                    const y = ((info.point.y - rect.top) / rect.height) * 100;
                                    updateLayout('name', { x: Math.round(x), y: Math.round(y) });
                                  }
                                }}
                                style={{ 
                                  position: 'absolute', 
                                  left: `${currentLayout.name.x}%`, 
                                  top: `${currentLayout.name.y}%`,
                                  width: '150px', height: '30px',
                                  border: '1px dashed #f97316',
                                  borderRadius: '4px',
                                  cursor: 'move',
                                  zIndex: 100,
                                  transform: 'translateX(-50%)'
                                }}
                              />
                              {/* Stats Left */}
                              <motion.div 
                                drag
                                dragMomentum={false}
                                onDrag={(e, info) => {
                                  const rect = (e.target as HTMLElement).parentElement?.getBoundingClientRect();
                                  if (rect) {
                                    const x = ((info.point.x - rect.left) / rect.width) * 100;
                                    const y = ((info.point.y - rect.top) / rect.height) * 100;
                                    updateLayout('statsLeft', { x: Math.round(x), y: Math.round(y) });
                                  }
                                }}
                                style={{ 
                                  position: 'absolute', 
                                  left: `${currentLayout.statsLeft.x}%`, 
                                  top: `${currentLayout.statsLeft.y}%`,
                                  width: '80px', height: '100px',
                                  border: '1px dashed #f97316',
                                  borderRadius: '4px',
                                  cursor: 'move',
                                  zIndex: 100,
                                  transform: 'translate(-50%, -50%)'
                                }}
                              />
                              {/* Stats Right */}
                              <motion.div 
                                drag
                                dragMomentum={false}
                                onDrag={(e, info) => {
                                  const rect = (e.target as HTMLElement).parentElement?.getBoundingClientRect();
                                  if (rect) {
                                    const x = ((info.point.x - rect.left) / rect.width) * 100;
                                    const y = ((info.point.y - rect.top) / rect.height) * 100;
                                    updateLayout('statsRight', { x: Math.round(x), y: Math.round(y) });
                                  }
                                }}
                                style={{ 
                                  position: 'absolute', 
                                  left: `${currentLayout.statsRight.x}%`, 
                                  top: `${currentLayout.statsRight.y}%`,
                                  width: '80px', height: '100px',
                                  border: '1px dashed #f97316',
                                  borderRadius: '4px',
                                  cursor: 'move',
                                  zIndex: 100,
                                  transform: 'translate(-50%, -50%)'
                                }}
                              />
                            </>
                          )}
                        </div>
                      </div>

                      {/* Layout Controls */}
                      {activeTab === 'layout' && (
                        <div className="w-full space-y-8">
                          {/* Element Groups */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            
                            {/* Card Container */}
                            <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-5">
                              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                <div className="flex items-center gap-3">
                                  <Maximize2 className="w-5 h-5 text-orange-500" />
                                  <label className="text-xs font-black text-white uppercase tracking-widest">Karten-Container</label>
                                </div>
                                <button type="button" onClick={() => updateLayout('card', DEFAULT_TIER_LAYOUT.card)} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors" title="Reset Card">
                                  <RotateCcw className="w-4 h-4 text-zinc-500" />
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">X (px)</label>
                                  <input type="number" value={currentLayout.card.x} onChange={(e) => updateLayout('card', { x: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Y (px)</label>
                                  <input type="number" value={currentLayout.card.y} onChange={(e) => updateLayout('card', { y: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Scale</label>
                                  <input type="number" step="0.01" value={currentLayout.card.scale} onChange={(e) => updateLayout('card', { scale: parseFloat(e.target.value) || 1 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-orange-500 font-mono transition-all" />
                                </div>
                              </div>
                            </div>

                            {/* Frame */}
                            <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-5">
                              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                <div className="flex items-center gap-3">
                                  <LayoutGrid className="w-5 h-5 text-orange-500" />
                                  <label className="text-xs font-black text-white uppercase tracking-widest">Kartenrahmen</label>
                                </div>
                                <button type="button" onClick={() => updateLayout('frame', DEFAULT_TIER_LAYOUT.frame)} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors" title="Reset Frame">
                                  <RotateCcw className="w-4 h-4 text-zinc-500" />
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">X (%)</label>
                                  <input type="number" value={currentLayout.frame.x} onChange={(e) => updateLayout('frame', { x: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Y (%)</label>
                                  <input type="number" value={currentLayout.frame.y} onChange={(e) => updateLayout('frame', { y: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Scale</label>
                                  <input type="number" step="0.01" value={currentLayout.frame.scale} onChange={(e) => updateLayout('frame', { scale: parseFloat(e.target.value) || 1 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-orange-500 font-mono transition-all" />
                                </div>
                              </div>
                            </div>

                            {/* Overall Rating */}
                            <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-5">
                              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                <div className="flex items-center gap-3">
                                  <Maximize2 className="w-5 h-5 text-orange-500" />
                                  <label className="text-xs font-black text-white uppercase tracking-widest">Gesamtbewertung</label>
                                </div>
                                <button type="button" onClick={() => updateLayout('overall', DEFAULT_TIER_LAYOUT.overall)} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors" title="Reset Overall">
                                  <RotateCcw className="w-4 h-4 text-zinc-500" />
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">X (%)</label>
                                  <input type="number" value={currentLayout.overall.x} onChange={(e) => updateLayout('overall', { x: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Y (%)</label>
                                  <input type="number" value={currentLayout.overall.y} onChange={(e) => updateLayout('overall', { y: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Size</label>
                                  <input type="number" value={currentLayout.overall.fontSize} onChange={(e) => updateLayout('overall', { fontSize: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-orange-500 font-mono transition-all" />
                                </div>
                              </div>
                              <ColorControls elementKey="overall" layout={currentLayout.overall} updateLayout={updateLayout} />
                            </div>

                            {/* Position */}
                            <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-5">
                              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                <div className="flex items-center gap-3">
                                  <Move className="w-5 h-5 text-orange-500" />
                                  <label className="text-xs font-black text-white uppercase tracking-widest">Positionstext</label>
                                </div>
                                <button type="button" onClick={() => updateLayout('position', DEFAULT_TIER_LAYOUT.position)} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors" title="Reset Position">
                                  <RotateCcw className="w-4 h-4 text-zinc-500" />
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">X (%)</label>
                                  <input type="number" value={currentLayout.position.x} onChange={(e) => updateLayout('position', { x: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Y (%)</label>
                                  <input type="number" value={currentLayout.position.y} onChange={(e) => updateLayout('position', { y: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Size</label>
                                  <input type="number" value={currentLayout.position.fontSize} onChange={(e) => updateLayout('position', { fontSize: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-orange-500 font-mono transition-all" />
                                </div>
                              </div>
                              <ColorControls elementKey="position" layout={currentLayout.position} updateLayout={updateLayout} />
                            </div>

                            {/* National Flag */}
                            <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-5">
                              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                <div className="flex items-center gap-3">
                                  <LayoutGrid className="w-5 h-5 text-orange-500" />
                                  <label className="text-xs font-black text-white uppercase tracking-widest">Nationalflagge</label>
                                </div>
                                <button type="button" onClick={() => updateLayout('flag', DEFAULT_TIER_LAYOUT.flag)} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors" title="Reset Flag">
                                  <RotateCcw className="w-4 h-4 text-zinc-500" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">X (%)</label>
                                  <input type="number" value={currentLayout.flag.x} onChange={(e) => updateLayout('flag', { x: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Y (%)</label>
                                  <input type="number" value={currentLayout.flag.y} onChange={(e) => updateLayout('flag', { y: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">W (px)</label>
                                  <input type="number" value={currentLayout.flag.width || 52} onChange={(e) => updateLayout('flag', { width: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">H (px)</label>
                                  <input type="number" value={currentLayout.flag.height || 32} onChange={(e) => updateLayout('flag', { height: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                              </div>
                            </div>

                            {/* Club Logo */}
                            <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-5">
                              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                <div className="flex items-center gap-3">
                                  <Shield className="w-5 h-5 text-orange-500" />
                                  <label className="text-xs font-black text-white uppercase tracking-widest">Vereinslogo</label>
                                </div>
                                <button type="button" onClick={() => updateLayout('club', DEFAULT_TIER_LAYOUT.club)} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors" title="Reset Club">
                                  <RotateCcw className="w-4 h-4 text-zinc-500" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">X (%)</label>
                                  <input type="number" value={currentLayout.club.x} onChange={(e) => updateLayout('club', { x: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Y (%)</label>
                                  <input type="number" value={currentLayout.club.y} onChange={(e) => updateLayout('club', { y: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">W (px)</label>
                                  <input type="number" value={currentLayout.club.width || 56} onChange={(e) => updateLayout('club', { width: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">H (px)</label>
                                  <input type="number" value={currentLayout.club.height || 56} onChange={(e) => updateLayout('club', { height: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                              </div>
                            </div>

                            {/* Player Image */}
                            <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-5">
                              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                <div className="flex items-center gap-3">
                                  <Users className="w-5 h-5 text-orange-500" />
                                  <label className="text-xs font-black text-white uppercase tracking-widest">Spielerbild</label>
                                </div>
                                <button type="button" onClick={() => updateLayout('player', DEFAULT_TIER_LAYOUT.player)} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white" title="Reset Player">
                                  <RotateCcw className="w-4 h-4" />
                                  <span>Foto-Layout zurücksetzen</span>
                                </button>
                              </div>
                              
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <label className="text-xs font-bold text-zinc-300">Foto nach links/rechts</label>
                                      <span className="text-xs text-orange-500 font-mono bg-orange-500/10 px-2 py-0.5 rounded">{currentLayout.player.x ?? 30}%</span>
                                    </div>
                                    <input type="range" min="0" max="100" value={currentLayout.player.x ?? 30} onChange={(e) => updateLayout('player', { x: parseInt(e.target.value) })} className="w-full accent-orange-500" />
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <label className="text-xs font-bold text-zinc-300">Foto nach oben/unten</label>
                                      <span className="text-xs text-orange-500 font-mono bg-orange-500/10 px-2 py-0.5 rounded">{currentLayout.player.y ?? 18}%</span>
                                    </div>
                                    <input type="range" min="0" max="100" value={currentLayout.player.y ?? 18} onChange={(e) => updateLayout('player', { y: parseInt(e.target.value) })} className="w-full accent-orange-500" />
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <label className="text-xs font-bold text-zinc-300">Foto-Bereich Breite</label>
                                      <span className="text-xs text-orange-500 font-mono bg-orange-500/10 px-2 py-0.5 rounded">{currentLayout.player.width ?? 55}%</span>
                                    </div>
                                    <input type="range" min="10" max="100" value={currentLayout.player.width ?? 55} onChange={(e) => updateLayout('player', { width: parseInt(e.target.value) })} className="w-full accent-orange-500" />
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <label className="text-xs font-bold text-zinc-300">Foto-Bereich Höhe</label>
                                      <span className="text-xs text-orange-500 font-mono bg-orange-500/10 px-2 py-0.5 rounded">{currentLayout.player.height ?? 34}%</span>
                                    </div>
                                    <input type="range" min="10" max="100" value={currentLayout.player.height ?? 34} onChange={(e) => updateLayout('player', { height: parseInt(e.target.value) })} className="w-full accent-orange-500" />
                                  </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-zinc-800/50">
                                  <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-amber-500">Foto-Zoom</label>
                                    <span className="text-xs text-amber-500 font-mono bg-amber-500/10 px-2 py-0.5 rounded">{currentLayout.player.scale ?? 1.15}x</span>
                                  </div>
                                  <input type="range" min="0.5" max="3" step="0.05" value={currentLayout.player.scale ?? 1.15} onChange={(e) => updateLayout('player', { scale: parseFloat(e.target.value) })} className="w-full accent-amber-500" />
                                </div>

                                <div className="grid grid-cols-2 gap-6 pt-2 border-t border-zinc-800/50">
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <label className="text-xs font-bold text-zinc-400">Bildfokus horizontal</label>
                                      <span className="text-xs text-zinc-400 font-mono bg-zinc-800 px-2 py-0.5 rounded">{currentLayout.player.focusX ?? 50}%</span>
                                    </div>
                                    <input type="range" min="0" max="100" value={currentLayout.player.focusX ?? 50} onChange={(e) => updateLayout('player', { focusX: parseInt(e.target.value) })} className="w-full accent-zinc-500" />
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <label className="text-xs font-bold text-zinc-400">Bildfokus vertikal</label>
                                      <span className="text-xs text-zinc-400 font-mono bg-zinc-800 px-2 py-0.5 rounded">{currentLayout.player.focusY ?? 20}%</span>
                                    </div>
                                    <input type="range" min="0" max="100" value={currentLayout.player.focusY ?? 20} onChange={(e) => updateLayout('player', { focusY: parseInt(e.target.value) })} className="w-full accent-zinc-500" />
                                  </div>
                                </div>
                              </div>
                            </div>

                             {/* Name */}
                            <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-5">
                              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                <div className="flex items-center gap-3">
                                  <Edit2 className="w-5 h-5 text-orange-500" />
                                  <label className="text-xs font-black text-white uppercase tracking-widest">Name</label>
                                </div>
                                <button type="button" onClick={() => updateLayout('name', DEFAULT_TIER_LAYOUT.name)} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors" title="Reset Name">
                                  <RotateCcw className="w-4 h-4 text-zinc-500" />
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">X (%)</label>
                                  <input type="number" value={currentLayout.name.x} onChange={(e) => updateLayout('name', { x: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Y (%)</label>
                                  <input type="number" value={currentLayout.name.y} onChange={(e) => updateLayout('name', { y: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Size</label>
                                  <input type="number" value={currentLayout.name.fontSize} onChange={(e) => updateLayout('name', { fontSize: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-orange-500 font-mono transition-all" />
                                </div>
                              </div>
                              <ColorControls elementKey="name" layout={currentLayout.name} updateLayout={updateLayout} />
                            </div>

                            {/* Stats Left */}
                            <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-5">
                              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                <div className="flex items-center gap-3">
                                  <LayoutGrid className="w-5 h-5 text-orange-500" />
                                  <label className="text-xs font-black text-white uppercase tracking-widest">Werte Links</label>
                                </div>
                                <button type="button" onClick={() => updateLayout('statsLeft', DEFAULT_TIER_LAYOUT.statsLeft)} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors" title="Reset Stats Left">
                                  <RotateCcw className="w-4 h-4 text-zinc-500" />
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">X (%)</label>
                                  <input type="number" value={currentLayout.statsLeft.x} onChange={(e) => updateLayout('statsLeft', { x: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Y (%)</label>
                                  <input type="number" value={currentLayout.statsLeft.y} onChange={(e) => updateLayout('statsLeft', { y: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Size</label>
                                  <input type="number" value={currentLayout.statsLeft.fontSize} onChange={(e) => updateLayout('statsLeft', { fontSize: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-orange-500 font-mono transition-all" />
                                </div>
                              </div>
                              <ColorControls elementKey="statsLeft" layout={currentLayout.statsLeft} updateLayout={updateLayout} />
                            </div>

                            {/* Stats Right */}
                            <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-5">
                              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                <div className="flex items-center gap-3">
                                  <LayoutGrid className="w-5 h-5 text-orange-500" />
                                  <label className="text-xs font-black text-white uppercase tracking-widest">Werte Rechts</label>
                                </div>
                                <button type="button" onClick={() => updateLayout('statsRight', DEFAULT_TIER_LAYOUT.statsRight)} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors" title="Reset Stats Right">
                                  <RotateCcw className="w-4 h-4 text-zinc-500" />
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">X (%)</label>
                                  <input type="number" value={currentLayout.statsRight.x} onChange={(e) => updateLayout('statsRight', { x: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Y (%)</label>
                                  <input type="number" value={currentLayout.statsRight.y} onChange={(e) => updateLayout('statsRight', { y: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-white font-mono transition-all" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-orange-500/80 uppercase tracking-tighter">Size</label>
                                  <input type="number" value={currentLayout.statsRight.fontSize} onChange={(e) => updateLayout('statsRight', { fontSize: parseInt(e.target.value) || 0 })} className="w-full h-10 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 text-sm text-orange-500 font-mono transition-all" />
                                </div>
                              </div>
                              <ColorControls elementKey="statsRight" layout={currentLayout.statsRight} updateLayout={updateLayout} />
                            </div>
                          </div>

                          <div className="flex flex-col md:flex-row gap-4 pt-6 border-t border-zinc-800">
                            <button
                              type="button"
                              onClick={handleSaveGlobalDefault}
                              disabled={submitting}
                              className="flex-1 px-6 bg-zinc-800 text-zinc-300 font-bold py-4 rounded-xl hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest disabled:opacity-50"
                            >
                              <LayoutGrid className="w-4 h-4" />
                              Save as Global Default Layout
                            </button>
                            <button
                              type="submit"
                              disabled={submitting}
                              className="flex-[2] px-12 bg-orange-500 text-white font-black py-4 rounded-xl hover:bg-orange-600 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 text-sm tracking-widest disabled:opacity-50"
                            >
                              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                              SPIELER-KONFIGURATION SPEICHERN
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
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
          title="Spieler löschen?"
          message="Bist du sicher, dass du diesen Spieler löschen möchtest? Dies löscht auch seine Statistiken und Spielhistorie. Diese Aktion kann nicht rückgängig gemacht werden."
          loading={deleting}
        />
      </div>
    </div>
  );
};

const ColorControls: React.FC<{
  elementKey: string;
  layout: any;
  updateLayout: (key: string, updates: any) => void;
}> = ({ elementKey, layout, updateLayout }) => {
  return (
    <div className="space-y-4 pt-4 border-t border-zinc-800/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="w-3 h-3 text-zinc-500" />
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Farbmodus</label>
        </div>
        <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          <button
            type="button"
            onClick={() => updateLayout(elementKey, { mode: 'solid' })}
            className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${
              layout.mode === 'solid' ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Einfarbig
          </button>
          <button
            type="button"
            onClick={() => updateLayout(elementKey, { mode: 'gradient' })}
            className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${
              layout.mode === 'gradient' ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Verlauf
          </button>
        </div>
      </div>

      {layout.mode === 'solid' ? (
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Textfarbe</label>
          <div className="flex flex-col gap-3">
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl flex justify-center">
              <HexColorPicker 
                color={layout.color || '#ffffff'} 
                onChange={(color) => updateLayout(elementKey, { color })}
                style={{ width: '100%', height: '160px' }}
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl">
              <div 
                className="w-4 h-4 rounded-full border border-zinc-700" 
                style={{ backgroundColor: layout.color || '#ffffff' }}
              />
              <span className="text-[10px] font-mono text-zinc-400 uppercase">{layout.color || '#ffffff'}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Startfarbe</label>
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl flex justify-center">
                <HexColorPicker 
                  color={layout.gradientStart || '#ffffff'} 
                  onChange={(color) => updateLayout(elementKey, { gradientStart: color })}
                  style={{ width: '100%', height: '140px' }}
                />
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl">
                <div 
                  className="w-4 h-4 rounded-full border border-zinc-700" 
                  style={{ backgroundColor: layout.gradientStart || '#ffffff' }}
                />
                <span className="text-[10px] font-mono text-zinc-400 uppercase">{layout.gradientStart || '#ffffff'}</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Endfarbe</label>
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl flex justify-center">
                <HexColorPicker 
                  color={layout.gradientEnd || '#cccccc'} 
                  onChange={(color) => updateLayout(elementKey, { gradientEnd: color })}
                  style={{ width: '100%', height: '140px' }}
                />
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl">
                <div 
                  className="w-4 h-4 rounded-full border border-zinc-700" 
                  style={{ backgroundColor: layout.gradientEnd || '#cccccc' }}
                />
                <span className="text-[10px] font-mono text-zinc-400 uppercase">{layout.gradientEnd || '#cccccc'}</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Richtung</label>
            <select
              value={layout.gradientDirection || 'vertical'}
              onChange={(e) => updateLayout(elementKey, { gradientDirection: e.target.value })}
              className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-xs text-white focus:border-orange-500 outline-none transition-all"
            >
              <option value="vertical">Vertikal</option>
              <option value="horizontal">Horizontal</option>
              <option value="diagonal">Diagonal</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPlayers;
