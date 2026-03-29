import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  loading = false
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-500/10 blur-[100px]" />
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-red-500/10 rounded-2xl">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">
                  {title}
                </h2>
                <p className="text-zinc-400 font-medium leading-relaxed">
                  {message}
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  disabled={loading}
                  onClick={onConfirm}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'DELETE PERMANENTLY'
                  )}
                </button>
                <button
                  disabled={loading}
                  onClick={onClose}
                  className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/5"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DeleteConfirmationModal;
