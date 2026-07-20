import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Bell, Send, CheckCircle2, AlertCircle, RefreshCw, XCircle, Search, Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { supabaseService } from '../../services/supabaseService';

export const PushNotifications: React.FC = () => {
  const navigate = useNavigate();
  
  const [audienceType, setAudienceType] = useState('all');
  const [platform, setPlatform] = useState('all'); // all, ios, android
  const [clubId, setClubId] = useState('');
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  
  const [clubs, setClubs] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateResult, setEstimateResult] = useState<any>(null);
  
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadClubs();
    loadCampaigns();
  }, []);

  const loadClubs = async () => {
    try {
      const data = await supabaseService.getClubs();
      setClubs(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('push_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (data) {
        setCampaigns(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getPayload = (action: string) => ({
    action,
    audienceType: action === 'send_test' ? 'test' : audienceType,
    platform: platform === 'all' ? null : platform,
    clubId: audienceType === 'club' ? clubId : null,
    userId: audienceType === 'user' ? userId : null,
    title,
    message,
    confirmationRecipientCount: action === 'send' ? estimateResult?.recipientCount : undefined
  });

  const handleEstimate = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsEstimating(true);
    setEstimateResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht angemeldet');

      const { data, error } = await supabase.functions.invoke('send-manual-push', {
        body: getPayload('estimate')
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Fehler bei der Berechnung');

      setEstimateResult(data);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSendTest = async () => {
    if (title.trim().length < 2 || title.trim().length > 60) {
      setErrorMsg('Titel muss zwischen 2 und 60 Zeichen lang sein.');
      return;
    }
    if (message.trim().length < 2 || message.trim().length > 240) {
      setErrorMsg('Nachricht muss zwischen 2 und 240 Zeichen lang sein.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht angemeldet');

      const { data, error } = await supabase.functions.invoke('send-manual-push', {
        body: getPayload('send_test')
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Fehler beim Testversand');

      setSuccessMsg('Test erfolgreich versendet!');
      loadCampaigns();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendReal = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSending(true);
    setShowConfirm(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht angemeldet');

      const { data, error } = await supabase.functions.invoke('send-manual-push', {
        body: getPayload('send')
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Fehler beim Versand');

      setSuccessMsg(`Erfolgreich gesendet: ${data.successCount} zugestellt, ${data.failedCount} fehlgeschlagen.`);
      setEstimateResult(null);
      loadCampaigns();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent p-6 text-white font-sans pb-24">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/admin')}
              className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <h1 className="text-3xl font-black italic tracking-tighter uppercase">Benachrichtigungszentrale</h1>
              <p className="text-zinc-500 font-medium text-sm">Manuelle Push-Nachrichten versenden</p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{successMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Form */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-6">
            <h2 className="text-xl font-bold">Neue Push-Nachricht</h2>
            
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Zielgruppe</label>
              <select 
                value={audienceType}
                onChange={(e) => {
                  setAudienceType(e.target.value);
                  setEstimateResult(null);
                }}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
              >
                <option value="all">Alle registrierten Geräte</option>
                <option value="platform">Nach Plattform</option>
                <option value="club">Nach Verein (Fans, Admins, Spieler)</option>
                <option value="user">Bestimmter Nutzer (User ID)</option>
              </select>
            </div>

            {audienceType === 'club' && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Verein wählen</label>
                <select 
                  value={clubId}
                  onChange={(e) => {
                    setClubId(e.target.value);
                    setEstimateResult(null);
                  }}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">Bitte wählen...</option>
                  {clubs.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {audienceType === 'user' && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">User ID (UUID)</label>
                <input 
                  type="text"
                  value={userId}
                  onChange={(e) => {
                    setUserId(e.target.value);
                    setEstimateResult(null);
                  }}
                  placeholder="z.B. 123e4567-e89b-12d3-a456-426614174000"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            )}

            {audienceType === 'platform' && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Plattform</label>
                <select 
                  value={platform}
                  onChange={(e) => {
                    setPlatform(e.target.value);
                    setEstimateResult(null);
                  }}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="ios">iOS (APNs)</option>
                  <option value="android">Android (FCM)</option>
                </select>
              </div>
            )}

            <div>
              <div className="flex justify-between mb-2">
                <label className="block text-sm font-medium text-zinc-400">Titel</label>
                <span className={`text-xs ${title.length > 60 ? 'text-red-400' : 'text-zinc-500'}`}>{title.length}/60</span>
              </div>
              <input 
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Kurzer, knackiger Titel"
                maxLength={65}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="block text-sm font-medium text-zinc-400">Nachricht</label>
                <span className={`text-xs ${message.length > 240 ? 'text-red-400' : 'text-zinc-500'}`}>{message.length}/240</span>
              </div>
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Details zur Benachrichtigung..."
                maxLength={250}
                rows={4}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleEstimate}
                disabled={isEstimating}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isEstimating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                Empfänger berechnen
              </button>
              
              <button
                onClick={handleSendTest}
                disabled={isSending || title.length < 2 || message.length < 2}
                className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 border border-blue-600/30"
              >
                Test an mich
              </button>
            </div>
            
            {estimateResult && (
              <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <h3 className="font-medium text-emerald-400 mb-2">Berechnung erfolgreich</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-white">{estimateResult.recipientCount}</div>
                    <div className="text-xs text-zinc-400 uppercase">Gesamt</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{estimateResult.iosCount}</div>
                    <div className="text-xs text-zinc-400 uppercase">iOS</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{estimateResult.androidCount}</div>
                    <div className="text-xs text-zinc-400 uppercase">Android</div>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={isSending || estimateResult.recipientCount === 0 || title.length < 2 || message.length < 2}
                  className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                  Jetzt senden
                </button>
              </div>
            )}
          </div>
          
          {/* Verlauf */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl flex flex-col">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-500" />
              Verlauf
            </h2>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[600px]">
              {campaigns.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">Noch keine Kampagnen versendet.</p>
              ) : (
                campaigns.map((camp) => (
                  <div key={camp.id} className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-white line-clamp-1">{camp.title}</h3>
                      <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                        camp.status === 'sent' ? 'bg-emerald-500/20 text-emerald-400' :
                        camp.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        camp.status === 'sending' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {camp.status}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 mb-3 line-clamp-2">{camp.message}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {camp.audience_type}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {camp.success_count || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-red-500" /> {camp.failure_count || 0}
                      </span>
                      <span>
                        {new Date(camp.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-white/10 p-6 rounded-2xl max-w-md w-full shadow-2xl"
          >
            <h3 className="text-xl font-bold text-white mb-2">Push wirklich senden?</h3>
            <p className="text-zinc-400 mb-6">
              Diese Nachricht wird an <strong className="text-white">{estimateResult?.recipientCount} Geräte</strong> gesendet. Dieser Vorgang kann nicht rückgängig gemacht werden.
            </p>
            
            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isSending}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-xl transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSendReal}
                disabled={isSending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isSending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                Senden
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// Added missing icon import for Users which was used above but not imported
import { Users } from 'lucide-react';

export default PushNotifications;
