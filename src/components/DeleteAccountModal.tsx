import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ isOpen, onClose }) => {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const isConfirmed = confirmText.trim().toUpperCase() === 'LÖSCHEN';

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht authentifiziert');

      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Fehler beim Löschen des Kontos');
      }
      
      // Cleanup locally
      localStorage.clear();
      await signOut();
      navigate('/login', { replace: true });

    } catch (err: any) {
      setError(err.message || 'Ein unbekannter Fehler ist aufgetreten.');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={!loading ? onClose : undefined}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-zinc-900 border border-red-500/20 rounded-[2rem] p-6 shadow-2xl space-y-6"
          >
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-black italic uppercase text-red-500">Konto endgültig löschen?</h3>
              <p className="text-zinc-400 text-sm">
                Diese Aktion kann <strong>nicht rückgängig</strong> gemacht werden. Deine persönlichen Daten (Profil, E-Mail, Push-Tokens, Vereins-Admin-Rechte, Votes) werden dauerhaft gelöscht.
              </p>
              <p className="text-zinc-500 text-xs mt-2">
                Hinweis: Deine Spieler-Historie und Match-Events bleiben für die sportliche Integrität der Liga erhalten, werden aber von dir entkoppelt (anonymisiert).
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-zinc-500 pl-2">
                  Tippe <span className="text-red-500 font-black">LÖSCHEN</span> zur Bestätigung
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="LÖSCHEN"
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 text-center font-black uppercase tracking-widest placeholder:text-zinc-700"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-medium text-center">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold text-sm text-white transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!isConfirmed || loading}
                  className="py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-red-500 rounded-xl font-black italic uppercase text-white transition-colors flex items-center justify-center"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Konto löschen'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
