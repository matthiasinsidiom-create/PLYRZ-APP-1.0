import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, ShieldCheck, Star, Share2, MessageCircle, ArrowLeft, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabaseService } from '../../services/supabaseService';
import type { Player, Club, Team } from '../../types';
import { createWhatsAppPremiumLink } from '../../config/contact';

export const PremiumInfo: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [claimedPlayer, setClaimedPlayer] = useState<(Player & { teams: Team & { clubs: Club } }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingPremium, setRequestingPremium] = useState(false);
  const [premiumRequested, setPremiumRequested] = useState(false);

  useEffect(() => {
    const loadClaimedPlayer = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const players = await supabaseService.getPlayers();
        const claimed = players.find(p => p.claimed_by_user_id === user.id);
        if (claimed) {
          setClaimedPlayer(claimed);
        }
      } catch (err) {
        console.error('Error loading claimed player:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadClaimedPlayer();
  }, [user]);

  const handlePremiumRequest = async () => {
    if (!user || !claimedPlayer) return;
    try {
      setRequestingPremium(true);
      await supabaseService.requestPremium(claimedPlayer.id, claimedPlayer.teams?.club_id || claimedPlayer.team_id);
      setPremiumRequested(true);
      alert('Deine Premium-Anfrage ist eingegangen. Wir melden uns in Kürze.');
    } catch (err: any) {
      if (err.message === 'already_requested') {
        setPremiumRequested(true);
        alert('Deine Premium-Anfrage liegt bereits vor und wird bearbeitet.');
      } else if (err.message && err.message.includes('Datenbank nicht bereit')) {
        alert('Die Premium-Funktion ist noch nicht vollständig eingerichtet. Bitte den Admin kontaktieren (SQL Migration fehlt).');
      } else {
        console.error('Error requesting premium:', err);
        alert('Fehler bei der Anfrage. Bitte versuche es später noch einmal.');
      }
    } finally {
      setRequestingPremium(false);
    }
  };

  const handleWhatsAppContact = async () => {
    if (!user || !claimedPlayer) return;
    
    // Zuerst Anfrage speichern, falls noch nicht passiert
    if (!premiumRequested) {
      try {
        await supabaseService.requestPremium(claimedPlayer.id, claimedPlayer.teams?.club_id || claimedPlayer.team_id);
        setPremiumRequested(true);
      } catch (err: any) {
        if (err.message === 'already_requested') {
          setPremiumRequested(true);
        }
      }
    }

    const clubName = claimedPlayer.teams?.clubs?.name || 'Unbekannter Verein';
    const whatsappUrl = createWhatsAppPremiumLink(claimedPlayer.full_name, clubName, claimedPlayer.id);
    
    window.open(whatsappUrl, '_blank');
  };

  const isPremiumActive = claimedPlayer?.is_premium && (!claimedPlayer.premium_until || new Date(claimedPlayer.premium_until).getTime() + 86400000 > Date.now());

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        Zurück
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 rounded-3xl border border-amber-500/20 overflow-hidden"
      >
        <div className="p-8 pb-0 text-center relative">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />
          
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20 shadow-lg shadow-amber-500/10 relative z-10">
            <Crown className="w-10 h-10 text-amber-500" />
          </div>
          
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white mb-2 relative z-10">
            PLYRZ Premium
          </h1>
          <p className="text-zinc-400 font-medium max-w-sm mx-auto relative z-10">
            Mehr aus deiner Spielerkarte für die Saison 2026/2027.
          </p>
        </div>

        <div className="p-8 space-y-8">
          <div className="bg-black/30 rounded-2xl p-6 border border-white/5 space-y-4">
            <p className="text-zinc-300 text-sm leading-relaxed">
              PLYRZ Premium ist ein optionaler Saisonstatus für Spieler, die mehr aus ihrer Karte und ihrer Saison herausholen möchten.
            </p>
            <div>
              <h4 className="text-white font-bold text-sm mb-1">Was ist PLYRZ Premium?</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Mit PLYRZ Premium erhältst du zusätzliche Vorteile rund um deine Spielerkarte. Dazu gehören eine besondere Kennzeichnung in der App, exklusive Darstellungen und physische Spielerkarten als hochwertige Erinnerung an deine Saison.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              Deine Vorteile mit Premium
            </h3>
            
            <ul className="space-y-4">
              {[
                { icon: Crown, text: 'Premium-Badge auf deiner Spielerkarte' },
                { icon: ShieldCheck, text: 'Exklusive Darstellung deiner Karte in der App' },
                { icon: Star, text: 'Besondere Sichtbarkeit deiner Karte' },
                { icon: Share2, text: 'Exklusive Share-Grafiken' },
                { icon: Star, text: 'Erweiterte persönliche Statistiken, sobald verfügbar' },
                { icon: ShieldCheck, text: 'Zwei physische Spielerkarten pro Saison' },
                { icon: Crown, text: 'Premium-Status bis Saisonende' }
              ].map((benefit, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-1 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                    <benefit.icon className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-zinc-300 text-sm leading-relaxed">
                    {benefit.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-black/30 rounded-2xl p-6 border border-amber-500/20 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white uppercase tracking-tight italic mb-2">
                Deine physischen Premium-Karten
              </h3>
              <p className="text-zinc-300 text-sm leading-relaxed">
                Als Premium-Spieler erhältst du zwei physische Spielerkarten pro Saison:
              </p>
              <ul className="list-disc list-inside text-zinc-400 text-sm mt-2 space-y-1">
                <li>eine Karte nach der Herbstsaison</li>
                <li>eine Karte nach Saisonende</li>
              </ul>
            </div>
            
            <div className="relative rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-800">
              <img 
                src="/mockup.png" 
                alt="Physische Premium-Karte" 
                className="w-full h-auto object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement?.classList.add('flex', 'items-center', 'justify-center', 'h-48');
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="text-zinc-500 flex flex-col items-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 mb-2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg><span class="text-sm">Mockup-Bild (public/mockup.png)</span></div>';
                }}
              />
            </div>
            <p className="text-xs text-zinc-500 text-center italic">
              Beispielhafte Darstellung deiner physischen Premium-Karte im Plexiglas-Look mit Holzsockel.
            </p>
          </div>

          <div className="border-t border-white/10 pt-8">
            {loading ? (
              <div className="text-center text-zinc-500">Lade Status...</div>
            ) : !user ? (
              <div className="text-center text-zinc-400 bg-zinc-800/50 rounded-xl p-4 border border-white/5">
                Bitte melde dich an, um Premium anzufragen.
              </div>
            ) : !claimedPlayer ? (
              <div className="text-center text-zinc-400 bg-zinc-800/50 rounded-xl p-4 border border-white/5">
                Premium ist für geclaimte Spielerkarten verfügbar. Bitte verifiziere zuerst deine Spielerkarte.
              </div>
            ) : isPremiumActive ? (
              <div className="text-center bg-emerald-500/10 rounded-xl p-6 border border-emerald-500/20">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                <h4 className="text-emerald-500 font-bold mb-1">Premium ist aktiv</h4>
                <p className="text-emerald-500/80 text-sm">
                  Dein Premium-Status ist gültig bis {claimedPlayer.premium_until ? new Date(claimedPlayer.premium_until).toLocaleDateString('de-DE') : 'Saisonende'}.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-zinc-500 text-center mb-6">
                  Hinweis: Premium wird aktuell nicht direkt in der App gekauft. Wenn du Interesse hast, sende uns eine Anfrage. Wir melden uns mit weiteren Informationen.
                </p>
                
                <button
                  onClick={handleWhatsAppContact}
                  className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#25D366]/20"
                >
                  <MessageCircle className="w-5 h-5" />
                  Über WhatsApp Kontakt aufnehmen
                </button>

                <button
                  onClick={handlePremiumRequest}
                  disabled={requestingPremium || premiumRequested}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-white/5 disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                  {premiumRequested ? 'Anfrage bereits eingegangen' : requestingPremium ? 'Sende...' : 'Nur Interesse senden'}
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PremiumInfo;
