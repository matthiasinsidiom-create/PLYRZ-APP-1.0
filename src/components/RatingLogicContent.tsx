import React from 'react';

export const RatingLogicContent: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 space-y-4">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-emerald-400">⭐ Rating-Logik (einfach erklärt)</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Dein Rating verändert sich nach jedem Spiel.<br />
          Es setzt sich aus Votes, Spielereignissen und dem Ergebnis zusammen.
        </p>
      </div>

      <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 space-y-4">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">🗳️ Votes (wichtigster Faktor)</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">Nach dem Spiel wirst du von anderen bewertet:</p>
        <ul className="text-sm text-zinc-300 space-y-2 list-none">
          <li>•  👍 Upvote = + Punkte</li>
          <li>•  👎 Downvote = – Punkte</li>
          <li>•  ⚪ Neutral = keine Auswirkung</li>
        </ul>
        <p className="text-sm text-zinc-400 mt-2">
          <span className="font-bold text-emerald-400">👉 Berechnung:</span><br/>
          (Upvotes – Downvotes) bestimmen deinen Vote-Einfluss.
        </p>
      </div>

      <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 space-y-4">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">⚽ Spielereignisse</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">Bestimmte Aktionen im Spiel wirken sich direkt auf dein Rating aus:</p>
        <ul className="text-sm text-zinc-300 space-y-2 list-none">
          <li>•  ⚽ Tor: +1.0</li>
          <li>•  🧤 Clean Sheet (kein Gegentor im Team):
            <ul className="ml-4 mt-1 space-y-1 text-zinc-400">
              <li>o Torwart: +1.0</li>
              <li>o Feldspieler: +0.3</li>
            </ul>
          </li>
          <li>•  ❌ Gegentor: –0.2 pro Gegentor</li>
          <li>•  🟨 Gelbe Karte: –0.2</li>
          <li>•  🟥 Rote Karte: –1.5</li>
        </ul>
      </div>

      <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 space-y-4">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">🏆 Spielergebnis</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">Das Ergebnis zählt für alle gleich:</p>
        <ul className="text-sm text-zinc-300 space-y-2 list-none">
          <li>•  Sieg: +0.2</li>
          <li>•  Unentschieden: 0.0</li>
          <li>•  Niederlage: –0.2</li>
        </ul>
      </div>

      <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 space-y-4">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">⭐ MVP (Most Valuable Player)</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">Wenn mehrere Spieler gleich stark sind, entscheiden die Votes:</p>
        <ul className="text-sm text-zinc-300 space-y-2 list-none">
          <li>•  Der Spieler mit den besten Votes wird MVP</li>
          <li>•  MVP bekommt +1.0 Bonus</li>
          <li>•  Maximaler Anstieg pro Spiel:
            <ul className="ml-4 mt-1 space-y-1 text-zinc-400">
              <li>o Normal: +2.0</li>
              <li>o MVP: +3.0</li>
            </ul>
          </li>
        </ul>
        <p className="text-sm text-zinc-400 mt-2">
          <span className="font-bold text-red-400">👉 Wichtig:</span><br/>
          Nur Spieler mit positiven Votes können MVP werden.
        </p>
      </div>

      <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 space-y-4">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">📊 Attribute (deine Werte)</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">Deine Werte entwickeln sich je nach Position:</p>
        <ul className="text-sm text-zinc-300 space-y-2 list-none">
          <li>•  🧤 Torwart → DEF, PHY, PAS</li>
          <li>•  🛡️ Abwehr → DEF, PHY, TEM, PAS</li>
          <li>•  🎯 Mittelfeld → PAS, DRI, TEM, PHY</li>
          <li>•  ⚡ Sturm → SCH, TEM, DRI, PAS</li>
        </ul>
        <p className="text-sm text-zinc-400 mt-2">
          <span className="font-bold text-emerald-400">👉 Beispiel:</span><br/>
          Ein Stürmer verbessert eher seinen Schuss, ein Verteidiger eher seine Defensive.
        </p>
      </div>

      <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 space-y-4">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">📈 Grenzen</h2>
        <ul className="text-sm text-zinc-300 space-y-2 list-none">
          <li>•  Maximaler Anstieg pro Spiel: +2.0 (MVP: +3.0)</li>
          <li>•  Maximaler Abfall: –2.0</li>
        </ul>
      </div>
      
      <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 rounded-3xl p-6 border border-emerald-500/20 space-y-4">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-emerald-400">🎯 Fazit</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">Dein Rating hängt davon ab:</p>
        <ul className="text-sm text-zinc-300 space-y-2 list-none">
          <li>•  wie gut du spielst (Tore, Aktionen)</li>
          <li>•  wie dein Team performt</li>
          <li>•  wie dich andere bewerten</li>
        </ul>
        <p className="text-sm text-white mt-2 font-bold italic tracking-wide">
          👉 Votes + Leistung = dein Rating
        </p>
      </div>
    </div>
  );
};

export default RatingLogicContent;
