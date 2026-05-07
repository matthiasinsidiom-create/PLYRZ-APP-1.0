import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Shield, 
  Search, 
  ChevronRight, 
  CheckCircle2, 
  Loader2, 
  ArrowLeft,
  Trophy,
  Star,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabaseService } from '../services/supabaseService';
import { Club, Player, League } from '../types';
import { getPositionShort } from '../lib/positions';
import { PlayerCard } from '../components/PlayerCard';
import { CardRevealWrapper } from '../components/CardRevealWrapper';

type OnboardingStep = 
  | 'role-selection' 
  | 'league-selection'
  | 'club-selection' 
  | 'player-search' 
  | 'card-preview' 
  | 'rating-logic'
  | 'complete';

export const Onboarding: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<OnboardingStep>(() => {
    const savedStep = localStorage.getItem('onboarding_step');
    return (savedStep as OnboardingStep) || 'role-selection';
  });

  const [role, setRole] = useState<'player' | 'fan' | null>(() => {
    const savedRole = localStorage.getItem('onboarding_role');
    return (savedRole as 'player' | 'fan') || null;
  });

  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  
  const [leagues, setLeagues] = useState<League[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasSeenReveal, setHasSeenReveal] = useState(false);

  useEffect(() => {
    if (step) {
      localStorage.setItem('onboarding_step', step);
    }
  }, [step]);

  useEffect(() => {
    if (role) {
      localStorage.setItem('onboarding_role', role);
    }
  }, [role]);

  useEffect(() => {
    if (step === 'league-selection') {
      loadLeagues();
      setSearchQuery('');
    }
  }, [step]);

  useEffect(() => {
    if (step === 'club-selection' && selectedLeague) {
      loadClubs(selectedLeague.id);
      setSearchQuery('');
    }
  }, [step, selectedLeague]);

  useEffect(() => {
    if (step === 'player-search' && selectedClub) {
      loadPlayers(selectedClub.id);
      setSearchQuery('');
    }
  }, [step, selectedClub]);

  const loadLeagues = async () => {
    setLoading(true);
    try {
      const data = await supabaseService.getLeagues();
      // Only show active leagues
      setLeagues(data.filter(l => l.is_active !== false));
    } catch (err) {
      console.error('Error loading leagues:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadClubs = async (leagueId: string) => {
    setLoading(true);
    try {
      const data = await supabaseService.getClubs(leagueId);
      setClubs(data);
    } catch (err) {
      console.error('Error loading clubs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async (clubId: string) => {
    setLoading(true);
    try {
      const teams = await supabaseService.getTeams(clubId);
      let clubPlayers: Player[] = [];
      for (const team of teams) {
        const data = await supabaseService.getPlayersByTeam(team.id);
        const unclaimed = data.filter(p => !p.claimed_by_user_id || p.claimed_by_user_id === user?.id);
        clubPlayers = [...clubPlayers, ...unclaimed];
      }
      setPlayers(clubPlayers);
    } catch (err) {
      console.error('Error loading players:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = async (selectedRole: 'player' | 'fan') => {
    setRole(selectedRole);
    setStep('league-selection');
    setSelectedLeague(null);
    setSelectedClub(null);
    setSelectedPlayer(null);
  };

  const handleLeagueSelect = (league: League) => {
    setSelectedLeague(league);
    setSelectedClub(null);
    setSelectedPlayer(null);
    setStep('club-selection');
  };

  const handleClubSelect = (club: Club) => {
    setSelectedClub(club);
    if (role === 'player') {
      setStep('player-search');
    } else {
      // For fans, go to rating logic after club selection
      setStep('rating-logic');
    }
  };

  const handlePlayerSelect = (player: Player) => {
    setSelectedPlayer(player);
    // We don't auto-claim here anymore to give the user a chance to confirm via the button
    console.log('Onboarding: Player selected:', player.id);
  };

  const handleClaimPlayer = async () => {
    if (!selectedPlayer) return;
    
    setSaving(true);
    try {
      console.log('Onboarding: Claiming player...', selectedPlayer.id);
      await supabaseService.claimPlayerCard(selectedPlayer.id);
      
      console.log('Onboarding: Fetching full player data...');
      // Fetch the full player data again to ensure we have stats for the preview
      const fullPlayer = await supabaseService.getPlayerById(selectedPlayer.id);
      setSelectedPlayer(fullPlayer);
      
      console.log('Onboarding: Moving to card-preview');
      setStep('card-preview');
    } catch (err: any) {
      console.error('Onboarding: Claim failed', err);
      alert(`Beanspruchung fehlgeschlagen: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!user) {
      console.error('Onboarding: No user found during completion');
      return;
    }
    
    if (!role) {
      console.error('Onboarding: No role selected during completion');
      return;
    }

    setSaving(true);
    try {
      console.log('Onboarding: Completing for role:', role);
      const updates: any = {
        role: role,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      };

      if (role === 'fan' && selectedClub) {
        updates.favorite_club_id = selectedClub.id;
      }
      
      console.log('Onboarding: Updating profile with:', updates);
      
      try {
        const updatedProfile = await supabaseService.updateProfile(user.id, updates);
        console.log('Onboarding: Profile updated successfully:', updatedProfile);
      } catch (dbErr: any) {
        // Check if error is specifically about the missing column
        if (dbErr.message?.includes('favorite_club_id') || dbErr.code === '42703') {
          console.warn('Onboarding: favorite_club_id column missing in DB. Retrying without it...');
          
          // Fallback: Try saving without the favorite_club_id
          const fallbackUpdates = { ...updates };
          delete fallbackUpdates.favorite_club_id;
          
          await supabaseService.updateProfile(user.id, fallbackUpdates);
          console.log('Onboarding: Profile updated successfully (fallback mode)');
          
          // Inform the user/admin about the missing column
          alert('Hinweis: Dein Verein konnte nicht dauerhaft gespeichert werden, da die Datenbank noch aktualisiert werden muss. Du kannst trotzdem fortfahren, aber bitte informiere den Administrator.');
        } else {
          throw dbErr;
        }
      }
      
      // Clear onboarding state
      localStorage.removeItem('onboarding_step');
      localStorage.removeItem('onboarding_role');
      
      await refreshProfile();
      console.log('Onboarding: Profile refreshed in context');
      
      if (role === 'fan') {
        console.log('Onboarding: Navigating to /matches');
        navigate('/matches');
      } else {
        console.log('Onboarding: Navigating to /');
        navigate('/');
      }
    } catch (err: any) {
      console.error('Onboarding: Error completing onboarding:', err);
      alert(`Fehler beim Abschluss: ${err.message || 'Unbekannter Fehler'}`);
    } finally {
      setSaving(false);
    }
  };

  const filteredLeagues = leagues.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredClubs = clubs.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPlayers = players.filter(p => 
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderStep = () => {
    switch (step) {
      case 'role-selection':
        return (
          <motion.div 
            key="role-selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Willkommen bei PLYRZ</h1>
              <p className="text-zinc-500 font-medium">Bist du Spieler oder Fan?</p>
            </div>

            <div className="grid gap-4">
              <button 
                onClick={() => handleRoleSelect('player')}
                className="group relative overflow-hidden bg-zinc-900 border border-white/5 p-8 rounded-3xl text-left transition-all hover:border-emerald-500/50 active:scale-[0.98]"
              >
                <div className="relative z-10 flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black italic uppercase text-white group-hover:text-emerald-400 transition-colors">Ich bin Spieler</h3>
                    <p className="text-zinc-500 text-sm">Verwalte deine Karte und steigere dein Rating.</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 transition-all">
                    <Trophy className="w-6 h-6 text-emerald-500 group-hover:text-black" />
                  </div>
                </div>
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all" />
              </button>

              <button 
                onClick={() => handleRoleSelect('fan')}
                className="group relative overflow-hidden bg-zinc-900 border border-white/5 p-8 rounded-3xl text-left transition-all hover:border-blue-500/50 active:scale-[0.98]"
              >
                <div className="relative z-10 flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black italic uppercase text-white group-hover:text-blue-400 transition-colors">Ich bin Fan</h3>
                    <p className="text-zinc-500 text-sm">Bewerte Spieler und beeinflusse das Leaderboard.</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center group-hover:bg-blue-500 transition-all">
                    <Users className="w-6 h-6 text-blue-500 group-hover:text-black" />
                  </div>
                </div>
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all" />
              </button>
            </div>
          </motion.div>
        );

      case 'league-selection':
        return (
          <motion.div 
            key="league-selection"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4">
              <button onClick={() => setStep('role-selection')} className="p-2 -ml-2 bg-transparent rounded-full text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span className="font-bold text-sm">Zurück</span>
              </button>
              <div>
                <h2 className="text-2xl font-black italic uppercase text-white">
                  Wähle zuerst deine Liga
                </h2>
                <p className="text-zinc-500 text-sm">In welcher Liga spielst du?</p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input 
                type="text"
                placeholder="Liga suchen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-white focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="grid gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                </div>
              ) : filteredLeagues.length > 0 ? (
                filteredLeagues.map(league => (
                  <button 
                    key={league.id}
                    onClick={() => handleLeagueSelect(league)}
                    className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-white/5 rounded-2xl hover:bg-zinc-800 transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center overflow-hidden border border-white/5">
                      <Trophy className="w-6 h-6 text-zinc-600 group-hover:text-amber-500 transition-all" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-bold">{league.name}</h4>
                      {league.region && (
                        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">{league.region}</p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-emerald-500 transition-colors" />
                  </button>
                ))
              ) : (
                <div className="text-center py-12 text-zinc-600">
                  Keine Ligen gefunden.
                </div>
              )}
            </div>
          </motion.div>
        );

      case 'club-selection':
        return (
          <motion.div 
            key="club-selection"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4">
              <button onClick={() => setStep('league-selection')} className="p-2 -ml-2 bg-transparent rounded-full text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span className="font-bold text-sm">Zurück</span>
              </button>
              <div>
                <h2 className="text-2xl font-black italic uppercase text-white">
                  Wähle deinen Verein
                </h2>
                <p className="text-zinc-500 text-sm">Suche nach deinem Club in der Datenbank.</p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input 
                type="text"
                placeholder="Verein suchen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-white focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="grid gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                </div>
              ) : filteredClubs.length > 0 ? (
                filteredClubs.map(club => (
                  <button 
                    key={club.id}
                    onClick={() => handleClubSelect(club)}
                    className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-white/5 rounded-2xl hover:bg-zinc-800 transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center overflow-hidden border border-white/5">
                      {club.logo_url ? (
                        <img src={club.logo_url} alt={club.name} className="w-full h-full object-contain p-2" />
                      ) : (
                        <Shield className="w-6 h-6 text-zinc-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-bold">{club.name}</h4>
                      <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">{club.leagues?.name || 'Regionalliga'}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-emerald-500 transition-colors" />
                  </button>
                ))
              ) : (
                <div className="text-center py-12 text-zinc-600">
                  Für diese Liga wurden noch keine Vereine gefunden.
                </div>
              )}
            </div>
          </motion.div>
        );

      case 'player-search':
        return (
          <motion.div 
            key="player-search"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4">
              <button onClick={() => setStep('club-selection')} className="p-2 -ml-2 bg-transparent rounded-full text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span className="font-bold text-sm">Zurück</span>
              </button>
              <div>
                <h2 className="text-2xl font-black italic uppercase text-white">Suche deinen Spieler</h2>
                <p className="text-zinc-500 text-sm">Wähle dein Profil bei {selectedClub?.name}.</p>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-zinc-900/30 rounded-3xl border border-white/5">
              <div className="p-4 bg-zinc-900/50 border-b border-white/5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input 
                    type="text"
                    placeholder="Dein Name..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-700"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    <p className="text-[10px] font-black italic text-zinc-600 uppercase tracking-widest">Spieler werden geladen...</p>
                  </div>
                ) : filteredPlayers.length > 0 ? (
                  filteredPlayers.map(player => {
                    const isSelected = selectedPlayer?.id === player.id;
                    return (
                      <button 
                        key={player.id}
                        onClick={() => handlePlayerSelect(player)}
                        disabled={saving}
                        className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all text-left group disabled:opacity-50 border ${
                          isSelected 
                            ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                            : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-800/80 hover:border-white/10'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden border transition-all flex-shrink-0 ${
                          isSelected ? 'border-emerald-500/50' : 'border-white/5'
                        }`}>
                          {player.photo_url ? (
                            <img 
                              src={player.photo_url} 
                              alt={player.full_name} 
                              className={`w-full h-full object-cover transition-all ${isSelected ? 'grayscale-0' : 'grayscale group-hover:grayscale-0'}`} 
                            />
                          ) : (
                            <Users className={`w-5 h-5 ${isSelected ? 'text-emerald-500' : 'text-zinc-600'}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-black italic uppercase text-xs truncate transition-colors ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                            {player.full_name}
                          </h4>
                          <p className="text-zinc-500 text-[8px] uppercase tracking-widest font-black italic">
                            {getPositionShort(player.position)} • {player.teams?.name}
                          </p>
                        </div>
                        {isSelected ? (
                          <div className="w-5 h-5 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 className="w-3 h-3 text-black" />
                          </div>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="text-center py-20 flex flex-col items-center gap-4 opacity-40">
                    <Search className="w-8 h-8 text-zinc-700" />
                    <p className="text-[10px] font-black italic uppercase tracking-widest text-center px-4">Für diesen Verein wurden noch keine Spieler angelegt.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="min-h-[80px] flex items-center pt-4">
              <AnimatePresence mode="wait">
                {selectedPlayer ? (
                  <motion.button
                    key="confirm-btn"
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={handleClaimPlayer}
                    disabled={saving}
                    className="w-full bg-emerald-500 text-black font-black italic uppercase tracking-tight py-5 rounded-2xl hover:bg-emerald-400 transition-all shadow-[0_10px_30px_rgba(16,185,129,0.2)] flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Trophy className="w-5 h-5" />
                        PROFIL BEANSPRUCHEN
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                ) : (
                  <div className="w-full py-5 rounded-2xl border border-white/5 bg-zinc-900/20 text-center">
                    <p className="text-[9px] font-black italic text-zinc-600 uppercase tracking-widest">Wähle dein Profil aus der Liste</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );

      case 'card-preview':
        if (!selectedPlayer) {
          setStep('player-search');
          return null;
        }
        
        if (hasSeenReveal) {
          return (
            <motion.div 
              key="card-preview-after"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center space-y-8"
            >
              <div className="w-full flex justify-start -mb-4">
                <button onClick={() => setStep('player-search')} className="p-2 -ml-2 bg-transparent rounded-full text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                  <span className="font-bold text-sm">Zurück</span>
                </button>
              </div>
              <PlayerCard player={selectedPlayer} />
              <button
                onClick={() => setStep('rating-logic')}
                className="w-full max-w-sm bg-emerald-500 text-black font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                WEITER
                <ChevronRight className="w-6 h-6" />
              </button>
            </motion.div>
          );
        }

        return (
          <motion.div
            key="card-reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CardRevealWrapper 
              player={selectedPlayer} 
              onComplete={() => {
                setHasSeenReveal(true);
                setStep('rating-logic');
              }} 
            />
          </motion.div>
        );

      case 'rating-logic':
        if (role === 'player' && !selectedPlayer) {
          setStep('player-search');
          return null;
        }
        return (
          <motion.div 
            key="rating-logic"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4">
              <button onClick={() => setStep(role === 'player' ? 'card-preview' : 'club-selection')} className="p-2 -ml-2 bg-transparent rounded-full text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span className="font-bold text-sm">Zurück</span>
              </button>
              <div>
                <h2 className="text-xl font-black italic uppercase text-white">Dein Rating</h2>
              </div>
            </div>
            <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 space-y-4 shadow-lg">
              <h3 className="text-lg font-black italic uppercase tracking-tight text-emerald-400">So funktioniert's</h3>
              <p className="text-zinc-300 leading-relaxed text-sm">
                Dein Rating verändert sich nach jedem Spiel automatisch. Tore bringen +1.0, Assists bringen +0.7. Auch Votes, Karten, Ergebnis und MVP können dein Rating beeinflussen. Neutral Votes werden gezählt, verändern dein Rating aber nicht.
              </p>
              <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <p className="text-emerald-400 font-bold text-sm italic">
                  Wichtig: Nicht nur Tore zählen – Teamplay wird belohnt.
                </p>
              </div>
            </div>
            <div className="pt-4">
              <button 
                onClick={() => setStep('complete')}
                className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                WEITER ZUR APP
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </motion.div>
        );

      case 'complete':
        return (
          <motion.div 
            key="complete"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8 py-12"
          >
            <div className="relative inline-block">
              <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/40">
                <CheckCircle2 className="w-12 h-12 text-black" />
              </div>
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-2 -right-2 w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center border border-emerald-500/50"
              >
                <Star className="w-4 h-4 text-emerald-500 fill-emerald-500" />
              </motion.div>
            </div>

            <div className="space-y-2">
              <h2 className="text-4xl font-black italic uppercase text-white">Du bist bereit.</h2>
              <p className="text-zinc-500">Starte jetzt mit deiner PLYRZ Reise.</p>
            </div>

            <button 
              onClick={handleComplete}
              disabled={saving}
              className="w-full bg-white text-black font-black py-5 rounded-2xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                <>
                  ZUR APP
                  <ChevronRight className="w-6 h-6" />
                </>
              )}
            </button>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-6">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </div>

      {/* Progress Indicator */}
      <div className="flex justify-center gap-2 mt-8">
        {['role-selection', 'club-selection', 'player-search', 'card-preview', 'rating-logic', 'complete'].map((s, i) => {
          const steps = role === 'player' 
            ? ['role-selection', 'club-selection', 'player-search', 'card-preview', 'rating-logic', 'complete']
            : ['role-selection', 'club-selection', 'rating-logic', 'complete'];
          
          if (!steps.includes(s)) return null;
          
          const currentIndex = steps.indexOf(step);
          const stepIndex = steps.indexOf(s);
          
          return (
            <div 
              key={s}
              className={`h-1 rounded-full transition-all duration-500 ${
                stepIndex <= currentIndex ? 'w-8 bg-emerald-500' : 'w-4 bg-zinc-800'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Onboarding;
