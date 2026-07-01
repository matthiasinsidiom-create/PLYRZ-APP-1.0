import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabaseService } from '../../services/supabaseService';
import { Fixture, Club } from '../../types';
import { calculateMatchScore } from '../../lib/score';
import { Loader2, Shield, User, ListOrdered } from 'lucide-react';

interface TableRow {
  clubName: string;
  logoUrl?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  clubId: string;
}

export const Table: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [matchType, setMatchType] = useState<'kampfmannschaft' | 'reserve'>('kampfmannschaft');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fData, cData] = await Promise.all([
          supabaseService.getFixtures(profile?.selected_league_id),
          supabaseService.getClubs(profile?.selected_league_id)
        ]);
        setFixtures(fData);
        setClubs(cData);
      } catch (err) {
        console.error('Error fetching data for table:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile]);

  const tableData = useMemo(() => {
    const rows: Record<string, TableRow> = {};
    const targetLeagueId = profile?.selected_league_id;
    
    // 1. Initialize all clubs in the league
    const leagueClubs = clubs.filter(c => !targetLeagueId || c.league_id === targetLeagueId);
    leagueClubs.forEach(c => {
      rows[c.id] = {
        clubName: c.name,
        logoUrl: c.logo_url,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
        clubId: c.id
      };
    });
    
    // 2. Process finished fixtures for the target league
    // Use 'kampfmannschaft' as default if match_type is null
    const finishedFixtures = fixtures.filter(f => 
      f.status === 'finished' && 
      (f.match_type || 'kampfmannschaft') === matchType &&
      (!targetLeagueId || f.league_id === targetLeagueId)
    );
    
    finishedFixtures.forEach(f => {
      const { homeScore, awayScore } = calculateMatchScore(f, (f as any).match_events || []);
      const homeTeam = (f as any).home_team;
      const awayTeam = (f as any).away_team;
      
      if (!homeTeam || !awayTeam) return;
      
      const hId = homeTeam.club_id;
      const aId = awayTeam.club_id;
      
      if (hId && rows[hId] && aId && rows[aId]) {
        rows[hId].played++;
        rows[aId].played++;
        rows[hId].goalsFor += homeScore;
        rows[hId].goalsAgainst += awayScore;
        rows[aId].goalsFor += awayScore;
        rows[aId].goalsAgainst += homeScore;
        
        if (homeScore > awayScore) {
          rows[hId].won++;
          rows[hId].points += 3;
          rows[aId].lost++;
        } else if (homeScore < awayScore) {
          rows[aId].won++;
          rows[aId].points += 3;
          rows[hId].lost++;
        } else {
          rows[hId].drawn++;
          rows[aId].drawn++;
          rows[hId].points += 1;
          rows[aId].points += 1;
        }
      }
    });
    
    Object.values(rows).forEach(r => {
      r.goalDiff = r.goalsFor - r.goalsAgainst;
    });
    
    return Object.values(rows).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.clubName.localeCompare(b.clubName);
    });
  }, [fixtures, clubs, matchType, profile?.selected_league_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white font-sans pb-28">
      {/* Header */}
      <div className="p-6 pt-[10px] flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-50 border-b border-white/5">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black italic uppercase tracking-tight">Tabelle</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <ListOrdered className="w-5 h-5 text-emerald-500" />
          </div>
          <button 
            onClick={() => navigate('/profile')}
            className="w-10 h-10 bg-zinc-900 rounded-xl border border-white/10 flex items-center justify-center hover:border-emerald-500 hover:text-emerald-500 transition-all shadow-lg active:scale-95"
            title="Profil"
            aria-label="Profil"
          >
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        
        {/* Toggle Switch */}
        <div className="flex justify-center">
          <div className="bg-zinc-900/50 p-1 rounded-2xl flex items-center border border-white/10 shadow-xl inline-flex relative overflow-hidden backdrop-blur-sm">
            <div 
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-zinc-800 rounded-xl shadow-lg border border-white/5 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
              style={{ 
                transform: matchType === 'kampfmannschaft' ? 'translateX(0)' : 'translateX(calc(100% + 8px))'
              }}
            />
            
            <button
              onClick={() => setMatchType('kampfmannschaft')}
              className={`relative z-10 px-8 py-3 text-sm font-black uppercase tracking-widest transition-colors duration-300 rounded-xl ${
                matchType === 'kampfmannschaft' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              KM
            </button>
            <button
              onClick={() => setMatchType('reserve')}
              className={`relative z-10 px-8 py-3 text-sm font-black uppercase tracking-widest transition-colors duration-300 rounded-xl ${
                matchType === 'reserve' ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              U23
            </button>
          </div>
        </div>

        {/* Table View */}
        {tableData.length === 0 ? (
          <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-10 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-6 border border-white/5 shadow-inner">
              <ListOrdered className="w-8 h-8 text-zinc-500" />
            </div>
            <h3 className="text-xl font-black italic uppercase tracking-tighter mb-2">Keine Teams</h3>
            <p className="text-zinc-500 text-sm font-medium">Noch keine Teams für diese Liga angelegt.</p>
          </div>
        ) : (
          <div className="bg-zinc-900/60 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-xl">
            <div className="w-full overflow-x-auto overflow-y-hidden pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
              <div className="min-w-[500px] w-full px-2 sm:px-4">
                <table className="w-full text-left border-collapse whitespace-nowrap table-auto">
                  <thead>
                    <tr className="border-b border-white/5 text-[9px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      <th className="py-3 px-1 sm:p-4 w-6 sm:w-12 text-center">Pl</th>
                      <th className="py-3 px-2 sm:p-4 w-auto">Team</th>
                      <th className="py-3 px-1 sm:p-4 w-8 sm:w-12 text-center">Sp</th>
                      <th className="py-3 px-1 sm:p-4 w-8 sm:w-12 text-center">S</th>
                      <th className="py-3 px-1 sm:p-4 w-8 sm:w-12 text-center">U</th>
                      <th className="py-3 px-1 sm:p-4 w-8 sm:w-12 text-center">N</th>
                      <th className="py-3 px-1 sm:p-4 w-12 sm:w-16 text-center">Tore</th>
                      <th className="py-3 px-1 sm:p-4 w-10 sm:w-14 text-center">Diff</th>
                      <th className="py-3 px-2 sm:p-4 w-10 sm:w-14 text-center text-emerald-500">Pkt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {tableData.map((row, index) => {
                      const isFavorite = profile?.favorite_club_id === row.clubId;
                      return (
                        <tr 
                          key={row.clubId}
                          className={`transition-colors hover:bg-white/5 ${isFavorite ? 'bg-emerald-500/10' : ''}`}
                        >
                          <td className="py-3 px-1 sm:p-4 text-center font-bold text-zinc-400 text-xs sm:text-base">
                            {index + 1}
                          </td>
                          <td className="py-3 px-2 sm:p-4 font-black italic tracking-tight flex items-center gap-2 sm:gap-3">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-zinc-800/80 rounded-lg flex items-center justify-center p-0.5 sm:p-1 border border-white/5 flex-shrink-0">
                              {row.logoUrl ? (
                                <img src={row.logoUrl} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                              ) : (
                                <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-zinc-600" />
                              )}
                            </div>
                            <span className="truncate max-w-[120px] sm:max-w-[200px] text-xs sm:text-base">{row.clubName}</span>
                          </td>
                          <td className="py-3 px-1 sm:p-4 text-center text-zinc-300 font-medium text-xs sm:text-base">{row.played}</td>
                          <td className="py-3 px-1 sm:p-4 text-center text-zinc-300 text-xs sm:text-base">{row.won}</td>
                          <td className="py-3 px-1 sm:p-4 text-center text-zinc-300 text-xs sm:text-base">{row.drawn}</td>
                          <td className="py-3 px-1 sm:p-4 text-center text-zinc-300 text-xs sm:text-base">{row.lost}</td>
                          <td className="py-3 px-1 sm:p-4 text-center text-zinc-300 text-[10px] sm:text-sm">
                            {row.goalsFor}:{row.goalsAgainst}
                          </td>
                          <td className="py-3 px-1 sm:p-4 text-center font-bold text-zinc-300 text-xs sm:text-base">
                            {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                          </td>
                          <td className="py-3 px-2 sm:p-4 text-center font-black text-emerald-400 text-sm sm:text-lg">
                            {row.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
