import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabaseService } from '../../services/supabaseService';
import { Player, Club, Team } from '../../types';
import { PlayerCard } from '../../components/PlayerCard';
import { PlayerCardBack } from '../../components/PlayerCardBack';
import { ArrowLeft, Download, Loader2, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as htmlToImage from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const CardExport: React.FC = () => {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Use refs to store actual DOM elements for rendering
  const cardFrontRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const cardBackRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    loadClubs();
  }, []);

  const loadClubs = async () => {
    try {
      const dbClubs = await supabaseService.getClubs();
      setClubs(dbClubs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedClubId) {
      loadTeams(selectedClubId);
    } else {
      setTeams([]);
      setSelectedTeamId('');
      setPlayers([]);
    }
  }, [selectedClubId]);

  const loadTeams = async (clubId: string) => {
    try {
      const allTeams = await supabaseService.getTeams(clubId);
      setTeams(allTeams);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedTeamId) {
      loadPlayers(selectedTeamId);
    } else {
      setPlayers([]);
    }
  }, [selectedTeamId]);

  const loadPlayers = async (teamId: string) => {
    setLoading(true);
    try {
      // Use the service to fetch players including their stats
      const teamPlayers = await supabaseService.getPlayers(teamId);
      setPlayers(teamPlayers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getExportOptions = () => {
    return {
      pixelRatio: 4, // 4x scale for high resolution print
      backgroundColor: 'transparent',
    };
  };

  const exportSingleCard = async (player: Player) => {
    const frontNode = cardFrontRefs.current[player.id];
    const backNode = cardBackRefs.current[player.id];
    
    if (!frontNode || !backNode) return;

    setExporting(true);
    setExportProgress(0);
    try {
      const sanitizedName = (player.last_name || player.full_name || 'player').replace(/[^a-z0-9ßäöüÄÖÜ]/gi, '_').toLowerCase();
      
      const frontDataUrl = await htmlToImage.toPng(frontNode, getExportOptions());
      saveAs(frontDataUrl, `${sanitizedName}_front.png`);
      
      // Add slight delay to prevent browser locking up
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const backDataUrl = await htmlToImage.toPng(backNode, getExportOptions());
      saveAs(backDataUrl, `${sanitizedName}_back.png`);
      
    } catch (err) {
      console.error('Export failed:', err);
      alert('Fehler beim Exportieren. Ggf. blockieren externe Bilder (CORS) den Export.');
    } finally {
      setExporting(false);
    }
  };

  const exportAllCards = async () => {
    if (players.length === 0) return;
    
    setExporting(true);
    setExportProgress(0);
    
    const zip = new JSZip();
    const folder = zip.folder('PlayerCards');
    
    let successCount = 0;
    
    try {
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        const frontNode = cardFrontRefs.current[player.id];
        const backNode = cardBackRefs.current[player.id];
        
        if (frontNode && backNode && folder) {
          try {
            await new Promise(resolve => setTimeout(resolve, 100));
            const frontDataUrl = await htmlToImage.toPng(frontNode, getExportOptions());
            
            await new Promise(resolve => setTimeout(resolve, 100));
            const backDataUrl = await htmlToImage.toPng(backNode, getExportOptions());
            
            const frontBase64 = frontDataUrl.split(',')[1];
            const backBase64 = backDataUrl.split(',')[1];
            
            const sanitizedName = (player.full_name || 'player').replace(/[^a-z0-9ßäöüÄÖÜ]/gi, '_').toLowerCase();
            
            folder.file(`${sanitizedName}_${player.id.substring(0,6)}_front.png`, frontBase64, { base64: true });
            folder.file(`${sanitizedName}_${player.id.substring(0,6)}_back.png`, backBase64, { base64: true });
            
            successCount += 2;
          } catch (e) {
            console.error(`Failed to export ${player.full_name}:`, e);
          }
        }
        
        setExportProgress(Math.round(((i + 1) / players.length) * 100));
      }
      
      if (successCount > 0) {
        const selectedClub = clubs.find(c => c.id === selectedClubId);
        const fileName = selectedClub ? `${selectedClub.name.replace(/[^a-z0-9ßäöüÄÖÜ]/gi, '_')}_Karten.zip` : `Karten_Export.zip`;
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, fileName);
      } else {
        alert('Keine Karten konnten exportiert werden (möglicherweise CORS Fehler bei Bildern).');
      }
    } catch (err) {
      console.error('ZIP Export failed:', err);
      alert('Ein Fehler ist beim Erstellen der ZIP aufgetreten.');
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  const activeClub = clubs.find(c => c.id === selectedClubId);

  return (
    <div className="min-h-screen bg-transparent p-6 text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-8 pb-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin')}
            className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">KARTEN EXPORT</h1>
            <p className="text-zinc-500 font-medium text-sm">Druckfertige Karten (Front & Back, {`>300`} DPI) inkl. ZIP-Export</p>
          </div>
        </div>

        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Verein</label>
              <select 
                value={selectedClubId}
                onChange={(e) => setSelectedClubId(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-emerald-500 transition-colors"
                disabled={exporting}
              >
                <option value="">Bitte wählen...</option>
                {clubs.map(club => (
                  <option key={club.id} value={club.id}>{club.name}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Erste Mannschaft</label>
              <select 
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
                disabled={!selectedClubId || exporting}
              >
                <option value="">Bitte wählen...</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedTeamId && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold uppercase tracking-tight">Vorschau & Export ({players.length} Spieler)</h2>
              
              <button
                onClick={exportAllCards}
                disabled={exporting || players.length === 0}
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{exportProgress}% EXPORTIERT</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>ALLE KARTEN EXPORTIEREN (ZIP)</span>
                  </>
                )}
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : players.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {players.map(player => (
                  <div key={player.id} className="flex flex-col items-center gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                    {/* Render target for Front */}
                    <div className="flex flex-col gap-2 items-center">
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Vorderseite</span>
                      <div ref={el => cardFrontRefs.current[player.id] = el} className="bg-transparent inline-block">
                        <PlayerCard player={player} clubLogo={activeClub?.logo_url} />
                      </div>
                    </div>
                    
                    {/* Render target for Back */}
                    <div className="flex flex-col gap-2 items-center mt-4">
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Rückseite</span>
                      <div ref={el => cardBackRefs.current[player.id] = el} className="bg-transparent inline-block">
                        <PlayerCardBack player={player} clubLogo={activeClub?.logo_url} />
                      </div>
                    </div>
                    
                    <button
                      onClick={() => exportSingleCard(player)}
                      disabled={exporting}
                      className="mt-4 flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 text-sm w-full justify-center border border-white/10"
                    >
                      <ImageIcon className="w-4 h-4" />
                      EINZEL-EXPORT
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-zinc-500 bg-black/20 rounded-2xl border border-white/5">
                Keine Spieler gefunden.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CardExport;