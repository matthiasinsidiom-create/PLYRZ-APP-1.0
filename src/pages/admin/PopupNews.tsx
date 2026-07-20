import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, MessageSquare, AlertCircle } from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';

const PopupNews: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [news, setNews] = useState({
    active: false,
    title: '',
    message: '',
    id: ''
  });

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    try {
      const data = await supabaseService.getGlobalSettings('popup_news');
      if (data) {
        setNews(data);
      }
    } catch (err) {
      console.error('Error loading popup news:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const newsData = {
        ...news,
        id: Date.now().toString() // new ID to force it to show to everyone again if changed
      };
      await supabaseService.updateGlobalSettings('popup_news', newsData);
      setNews(newsData);
      alert('Popup News erfolgreich gespeichert.');
    } catch (err) {
      console.error('Error saving popup news:', err);
      alert('Fehler beim Speichern der Popup News.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setSaving(true);
    try {
      const newsData = { ...news, active: false };
      await supabaseService.updateGlobalSettings('popup_news', newsData);
      setNews(newsData);
    } catch (err) {
      console.error('Error deactivating popup news:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-6 text-white font-sans">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin')}
            className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">Popup News</h1>
            <p className="text-zinc-500 font-medium text-sm">Verwalte App-weite Ankündigungen</p>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse h-64 bg-white/5 rounded-2xl" />
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
            
            <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <MessageSquare className="w-6 h-6 text-emerald-500" />
              <div className="flex-1">
                <h3 className="font-bold text-white">Status</h3>
                <p className="text-sm text-zinc-400">
                  {news.active ? 'Popup ist aktuell für alle Nutzer aktiv.' : 'Kein aktives Popup.'}
                </p>
              </div>
              <button
                onClick={() => setNews(prev => ({ ...prev, active: !prev.active }))}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                  news.active 
                    ? 'bg-rose-500/20 text-rose-500 hover:bg-rose-500/30' 
                    : 'bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30'
                }`}
              >
                {news.active ? 'Deaktivieren' : 'Aktivieren'}
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Titel</label>
                <input
                  type="text"
                  value={news.title}
                  onChange={e => setNews(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="z.B. Wichtiges Update!"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Nachricht</label>
                <textarea
                  value={news.message}
                  onChange={e => setNews(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full h-32 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 resize-none"
                  placeholder="Deine Nachricht an die Nutzer..."
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
              Speichern & Veröffentlichen
            </button>
            
            <p className="text-xs text-zinc-500 text-center flex items-center justify-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Nutzer sehen die Nachricht einmalig beim Öffnen der App.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PopupNews;
