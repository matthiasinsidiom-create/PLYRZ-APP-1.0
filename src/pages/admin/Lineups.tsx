import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ListOrdered, 
  ArrowLeft,
  Search,
  Check,
  Loader2,
  Calendar,
  Users,
  Shield,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';

const AdminLineups: React.FC = () => {
  const navigate = useNavigate();
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<any>(null);
  const [homePlayers, setHomePlayers] = useState<any[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<any[]>([]);
  const [lineup, setLineup] = useState<{ home: string[], away: string[] }>({ home: [], away: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFixtures();
  }, []);

  const loadFixtures = async () => {
    setLoading(true);
    try {
      console.log('DEBUG: Loading fixtures for appearances...');
      const data = await supabaseService.getFixtures();
      console.log('DEBUG: Raw fixtures received:', data.length);
      const uniqueStatuses = Array.from(new Set(data.map(f => f.status)));
      console.log('DEBUG: Unique statuses in database:', uniqueStatuses);
      
      // Store all fixtures, but we'll filter them in the render logic
      setFixtures(data);
      
      const liveCount = data.filter(f => f.status === 'live').length;
      const finishedCount = data.filter(f => f.status === 'finished').length;
      const upcomingCount = data.filter(f => f.status === 'upcoming').length;
      console.log('DEBUG: Filtered live fixtures count:', liveCount);
      console.log('DEBUG: Filtered finished fixtures count:', finishedCount);
      console.log('DEBUG: Filtered upcoming fixtures count:', upcomingCount);
    } catch (err) {
      console.error('DEBUG: Error loading fixtures:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFixture = async (fixture: any) => {
    setLoading(true);
    setSelectedFixture(fixture);
    
    const homeClubId = fixture.home_team?.club_id;
    const awayClubId = fixture.away_team?.club_id;

    console.log('DEBUG: Selected fixture:', fixture.id);
    console.log('DEBUG: Home Team ID:', fixture.home_team_id);
    console.log('DEBUG: Away Team ID:', fixture.away_team_id);
    console.log('DEBUG: Home Club ID:', homeClubId);
    console.log('DEBUG: Away Club ID:', awayClubId);
    console.log('DEBUG: Home Team:', fixture.home_team?.clubs?.name, '-', fixture.home_team?.name);
    console.log('DEBUG: Away Team:', fixture.away_team?.clubs?.name, '-', fixture.away_team?.name);
    
    try {
      if (!homeClubId || !awayClubId) {
        console.error('DEBUG: Club IDs missing!', { homeClubId, awayClubId });
        throw new Error('Club IDs missing for this fixture');
      }

      console.log('DEBUG: Fetching players for clubs:', [homeClubId, awayClubId]);
      const [allPlayers, currentLineup] = await Promise.all([
        supabaseService.getPlayersByClubs([homeClubId, awayClubId]),
        supabaseService.getFixtureLineup(fixture.id)
      ]);

      console.log('DEBUG: Eligible players full result array:', allPlayers);
      allPlayers.forEach(p => {
        console.log(`DEBUG: Player: ${p.id} | Name: ${p.full_name} | Base Team ID: ${p.team_id} | Base Team Name: ${p.teams?.name} | Club ID: ${p.teams?.club_id} | Club Name: ${p.teams?.clubs?.name}`);
      });

      console.log('DEBUG: Existing lineup entries:', currentLineup.length);

      // Filter players by their club
      const homeClubPlayers = allPlayers.filter(p => (p as any).teams?.club_id === homeClubId);
      const awayClubPlayers = allPlayers.filter(p => (p as any).teams?.club_id === awayClubId);
      
      console.log('DEBUG: Eligible players count for home club:', homeClubPlayers.length);
      console.log('DEBUG: Eligible players count for away club:', awayClubPlayers.length);

      setHomePlayers(homeClubPlayers);
      setAwayPlayers(awayClubPlayers);
      
      const homeIds = currentLineup.filter(l => l.team_id === fixture.home_team_id).map(l => l.player_id);
      const awayIds = currentLineup.filter(l => l.team_id === fixture.away_team_id).map(l => l.player_id);
      
      console.log('DEBUG: Mapped home appearance IDs:', homeIds.length);
      console.log('DEBUG: Mapped away appearance IDs:', awayIds.length);
      
      setLineup({ home: homeIds, away: awayIds });
    } catch (err) {
      console.error('DEBUG: Error loading appearance data:', err);
      alert('Error loading data: ' + (err as any).message);
    } finally {
      setLoading(false);
    }
  };



  const togglePlayer = (team: 'home' | 'away', playerId: string) => {
    setLineup(prev => {
      const otherTeam = team === 'home' ? 'away' : 'home';
      const current = prev[team];
      const other = prev[otherTeam];

      if (current.includes(playerId)) {
        return { ...prev, [team]: current.filter(id => id !== playerId) };
      } else {
        // Add to current team, and remove from other team if they were there
        return {
          ...prev,
          [team]: [...current, playerId],
          [otherTeam]: other.filter(id => id !== playerId)
        };
      }
    });
  };

  const handleSaveLineup = async () => {
    if (!selectedFixture) return;
    setSaving(true);
    try {
      const lineupData = [
        ...lineup.home.map(id => ({ fixture_id: selectedFixture.id, team_id: selectedFixture.home_team_id, player_id: id })),
        ...lineup.away.map(id => ({ fixture_id: selectedFixture.id, team_id: selectedFixture.away_team_id, player_id: id }))
      ];
      console.log('DEBUG: Final fixture_lineups payload:', JSON.stringify(lineupData, null, 2));
      await supabaseService.updateFixtureLineup(selectedFixture.id, lineupData);
      alert('Lineup saved successfully!');
    } catch (err) {
      alert('Error saving lineup: ' + (err as any).message);
    } finally {
      setSaving(false);
    }
  };

  const liveFixtures = fixtures.filter(f => 
    f.status === 'live' && (
      f.home_team?.clubs?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.home_team?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.away_team?.clubs?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.away_team?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const finishedFixtures = fixtures.filter(f => 
    f.status === 'finished' && (
      f.home_team?.clubs?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.home_team?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.away_team?.clubs?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.away_team?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const upcomingFixtures = fixtures.filter(f => 
    f.status === 'upcoming' && (
      f.home_team?.clubs?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.home_team?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.away_team?.clubs?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.away_team?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  if (selectedFixture) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] p-6 text-white font-sans">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedFixture(null)}
                    className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-zinc-400" />
                  </button>
              <div>
                <h1 className="text-2xl font-black italic tracking-tighter uppercase">MATCH APPEARANCES</h1>
                <div className="flex items-center gap-2 text-zinc-500 font-medium text-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">{selectedFixture.home_team?.clubs?.name}</span>
                    <span className="font-bold text-white">{selectedFixture.home_team?.name}</span>
                  </div>
                  <span className="mx-2 text-zinc-700">VS</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">{selectedFixture.away_team?.clubs?.name}</span>
                    <span className="font-bold text-white">{selectedFixture.away_team?.name}</span>
                  </div>
                </div>
              </div>
                </div>
              <button
                disabled={saving}
                onClick={handleSaveLineup}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-black py-3 px-8 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                SAVE APPEARANCES
              </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {homePlayers.length === 0 && awayPlayers.length === 0 ? (
              <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-xl font-black italic uppercase tracking-tight text-white mb-2">No Players Found</h3>
                <p className="text-zinc-500 max-w-md mx-auto text-sm">
                  We couldn't find any players registered for the clubs involved in this match. 
                  Please ensure players are added to the clubs in the Player Manager.
                </p>
              </div>
            ) : (
              <>
                {/* Home Team */}
            <div className="space-y-4">
              <div className="flex flex-col gap-1 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-emerald-500" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">{selectedFixture.home_team?.clubs?.name}</span>
                    <h3 className="text-lg font-black uppercase italic tracking-tight leading-none text-white">{selectedFixture.home_team?.name}</h3>
                  </div>
                  <span className="ml-auto text-xs font-bold text-zinc-500">{lineup.home.length} Players</span>
                </div>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mt-2 border-t border-zinc-800 pt-2">
                  Select players from {selectedFixture.home_team?.clubs?.name} who played in this match
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {/* Selected Players */}
                {homePlayers.filter(p => lineup.home.includes(p.id)).length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest px-2">Selected Appearances</p>
                    {homePlayers.filter(p => lineup.home.includes(p.id)).map(player => (
                      <button
                        key={player.id}
                        onClick={() => togglePlayer('home', player.id)}
                        className="w-full flex items-center justify-between p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/50 text-emerald-500 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-emerald-500 text-black">
                            {player.shirt_number || '?'}
                          </div>
                          <div className="text-left">
                            <p className="font-bold">{player.full_name}</p>
                            <p className="text-[10px] uppercase tracking-wider opacity-60">
                              {player.position} • {player.teams?.name || 'No Team'}
                            </p>
                          </div>
                        </div>
                        <Check className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Available Players */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-2">Available Pool</p>
                  {homePlayers.filter(p => !lineup.home.includes(p.id)).map(player => (
                    <button
                      key={player.id}
                      onClick={() => togglePlayer('home', player.id)}
                      className="w-full flex items-center justify-between p-4 rounded-xl border bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-zinc-800">
                          {player.shirt_number || '?'}
                        </div>
                        <div className="text-left">
                          <p className="font-bold">{player.full_name}</p>
                          <p className="text-[10px] uppercase tracking-wider opacity-60">
                            {player.position} • {player.teams?.name || 'No Team'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

                {/* Away Team */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-1 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Shield className="w-6 h-6 text-blue-500" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">{selectedFixture.away_team?.clubs?.name}</span>
                        <h3 className="text-lg font-black uppercase italic tracking-tight leading-none text-white">{selectedFixture.away_team?.name}</h3>
                      </div>
                      <span className="ml-auto text-xs font-bold text-zinc-500">{lineup.away.length} Players</span>
                    </div>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mt-2 border-t border-zinc-800 pt-2">
                      Select players from {selectedFixture.away_team?.clubs?.name} who played in this match
                    </p>
                  </div>
                  {awayPlayers.length === 0 ? (
                    <div className="p-8 bg-zinc-900/50 border border-zinc-800 border-dashed rounded-xl text-center">
                      <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">No players found for this club</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {/* Selected Players */}
                      {awayPlayers.filter(p => lineup.away.includes(p.id)).length > 0 && (
                        <div className="space-y-2 mb-4">
                          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest px-2">Selected Appearances</p>
                          {awayPlayers.filter(p => lineup.away.includes(p.id)).map(player => (
                            <button
                              key={player.id}
                              onClick={() => togglePlayer('away', player.id)}
                              className="w-full flex items-center justify-between p-4 rounded-xl border bg-blue-500/10 border-blue-500/50 text-blue-500 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-blue-500 text-white">
                                  {player.shirt_number || '?'}
                                </div>
                                <div className="text-left">
                                  <p className="font-bold">{player.full_name}</p>
                                  <p className="text-[10px] uppercase tracking-wider opacity-60">
                                    {player.position} • {player.teams?.name || 'No Team'}
                                  </p>
                                </div>
                              </div>
                              <Check className="w-5 h-5" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Available Players */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-2">Available Pool</p>
                        {awayPlayers.filter(p => !lineup.away.includes(p.id)).map(player => (
                          <button
                            key={player.id}
                            onClick={() => togglePlayer('away', player.id)}
                            className="w-full flex items-center justify-between p-4 rounded-xl border bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-zinc-800">
                                {player.shirt_number || '?'}
                              </div>
                              <div className="text-left">
                                <p className="font-bold">{player.full_name}</p>
                                <p className="text-[10px] uppercase tracking-wider opacity-60">
                                  {player.position} • {player.teams?.name || 'No Team'}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin')}
            className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">MATCH APPEARANCES</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-zinc-500 font-medium text-sm">Assign players who participated in matches</p>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20">
                Upcoming, Live & Finished
              </span>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text"
            placeholder="Search fixtures..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-yellow-500/50 transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Loading matches...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Upcoming Matches Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <h2 className="text-xl font-black italic uppercase tracking-tight text-white">UPCOMING MATCHES</h2>
              </div>
              
              {upcomingFixtures.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl p-8 text-center">
                  <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">No upcoming fixtures found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingFixtures.map(fixture => (
                    <button
                      key={fixture.id}
                      onClick={() => handleSelectFixture(fixture)}
                      className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center justify-between group hover:border-blue-500/30 transition-all"
                    >
                      <div className="flex items-center gap-6">
                        <div className="p-3 bg-zinc-800 rounded-xl group-hover:bg-blue-500/10 transition-colors">
                          <Calendar className="w-6 h-6 text-zinc-500 group-hover:text-blue-500" />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                            <Shield className="w-3 h-3" />
                            {fixture.leagues?.name}
                          </div>
                          <div className="flex flex-col">
                            <p className="font-bold text-lg italic uppercase tracking-tight text-white">
                              {fixture.home_team?.clubs?.name} <span className="text-zinc-600 mx-1">VS</span> {fixture.away_team?.clubs?.name}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                              <span>{fixture.home_team?.name}</span>
                              <span className="text-zinc-800">vs</span>
                              <span>{fixture.away_team?.name}</span>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500 font-medium mt-1">
                            {new Date(fixture.kickoff_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-blue-500 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live Matches Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <h2 className="text-xl font-black italic uppercase tracking-tight text-white">LIVE MATCHES</h2>
              </div>
              
              {liveFixtures.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl p-8 text-center">
                  <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">No live fixtures found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {liveFixtures.map(fixture => (
                    <button
                      key={fixture.id}
                      onClick={() => handleSelectFixture(fixture)}
                      className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center justify-between group hover:border-red-500/30 transition-all"
                    >
                      <div className="flex items-center gap-6">
                        <div className="p-3 bg-zinc-800 rounded-xl group-hover:bg-red-500/10 transition-colors">
                          <Calendar className="w-6 h-6 text-zinc-500 group-hover:text-red-500" />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                            <Shield className="w-3 h-3" />
                            {fixture.leagues?.name}
                          </div>
                          <div className="flex flex-col">
                            <p className="font-bold text-lg italic uppercase tracking-tight text-white">
                              {fixture.home_team?.clubs?.name} <span className="text-zinc-600 mx-1">VS</span> {fixture.away_team?.clubs?.name}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                              <span>{fixture.home_team?.name}</span>
                              <span className="text-zinc-800">vs</span>
                              <span>{fixture.away_team?.name}</span>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500 font-medium mt-1">
                            {new Date(fixture.kickoff_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-red-500 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Finished Matches Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-zinc-500 rounded-full" />
                <h2 className="text-xl font-black italic uppercase tracking-tight text-white">FINISHED MATCHES</h2>
              </div>

              {finishedFixtures.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl p-8 text-center">
                  <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">No finished fixtures found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {finishedFixtures.map(fixture => (
                    <button
                      key={fixture.id}
                      onClick={() => handleSelectFixture(fixture)}
                      className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center justify-between group hover:border-yellow-500/30 transition-all"
                    >
                      <div className="flex items-center gap-6">
                        <div className="p-3 bg-zinc-800 rounded-xl group-hover:bg-yellow-500/10 transition-colors">
                          <Calendar className="w-6 h-6 text-zinc-500 group-hover:text-yellow-500" />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                            <Shield className="w-3 h-3" />
                            {fixture.leagues?.name}
                          </div>
                          <div className="flex flex-col">
                            <p className="font-bold text-lg italic uppercase tracking-tight text-white">
                              {fixture.home_team?.clubs?.name} <span className="text-zinc-600 mx-1">VS</span> {fixture.away_team?.clubs?.name}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                              <span>{fixture.home_team?.name}</span>
                              <span className="text-zinc-800">vs</span>
                              <span>{fixture.away_team?.name}</span>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500 font-medium mt-1">
                            {new Date(fixture.kickoff_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-yellow-500 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLineups;
