import React from 'react';

export const RatingLogicContent: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 space-y-4">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-emerald-400">⭐ So funktioniert dein Rating</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Dein Rating verändert sich nach jedem Spiel automatisch. Es zählt nicht nur, wer ein Tor schießt. Auch Vorlagen, Abstimmungen, Spielereignisse und das Ergebnis beeinflussen deine Bewertung.
        </p>
      </div>

      <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 space-y-4">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">⚽ Aktionen im Spiel</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">Bestimmte Aktionen im Spiel wirken sich direkt auf dein Rating aus:</p>
        <ul className="text-sm text-zinc-300 space-y-2 list-none">
          <li>•  ⚽ Tor: +1.0</li>
          <li>•  🎯 Assist (Vorlage): +0.7</li>
          <li>•  🧤 Clean Sheet (kein Gegentor im Team):
            <ul className="ml-4 mt-1 space-y-1 text-zinc-400">
              <li>o Torwart: +1.0</li>
              <li>o Feldspieler: +0.3</li>
            </ul>
          </li>
          <li>•  ❌ Gegentor: –0.2 pro Gegentor (kann einen kleinen negativen Einfluss haben)</li>
          <li>•  🟨 Gelbe Karte: –0.2 (kann negativ wirken)</li>
          <li>•  🟥 Rote Karte: –1.5 (wirkt negativ)</li>
        </ul>
        <p className="text-sm text-zinc-400 mt-2">
          Gute Aktionen helfen deinem Rating, Fehler können es senken.
        </p>
      </div>

      <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 space-y-4">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">🙌 Warum Assists wichtig sind</h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Nicht nur Tore zählen. Wenn du ein Tor vorbereitest, bekommst du für den Assist +0.7. So wird auch mannschaftsdienliches Spielen belohnt.
        </p>
      </div>

      <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 space-y-4">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">🗳️ Stimmen der Fans und Mitspieler</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">Nach dem Spiel wirst du von anderen bewertet:</p>
        <ul className="text-sm text-zinc-300 space-y-2 list-none">
          <li>•  👍 Positive Stimme: wirkt positiv</li>
          <li>•  👎 Negative Stimme: wirkt negativ</li>
          <li>•  ⚪ Neutral: wird gezählt, verändert dein Rating aber nicht</li>
        </ul>
        <p className="text-sm text-zinc-400 mt-2">
          Es zählt nicht eine einzelne Stimme allein, sondern das Gesamtbild.
        </p>
      </div>

      <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 space-y-4">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">🏆 Ergebnis und MVP</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">Das Spielergebnis und individuelle Leistungen zählen:</p>
        <ul className="text-sm text-zinc-300 space-y-2 list-none">
          <li>•  Das Spielergebnis kann dein Rating beeinflussen (Sieg, Unentschieden, Niederlage).</li>
          <li>•  Der beste Spieler des Matches kann einen MVP-Bonus (+1.0) erhalten.</li>
          <li>•  MVP basiert auf Events, Votes und Gesamtleistung.</li>
        </ul>
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
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-emerald-400">🎯 Kurz gesagt</h2>
        <ul className="text-sm text-zinc-300 space-y-2 list-none">
          <li>•  Tor schießen hilft</li>
          <li>•  Assist geben hilft</li>
          <li>•  Gut spielen hilft</li>
          <li>•  Fair bleiben hilft</li>
          <li>•  Neutral Votes schaden nicht</li>
          <li>•  Teamplay wird belohnt</li>
        </ul>
        <p className="text-sm text-white mt-4 font-bold italic tracking-wide">
          👉 Votes + Leistung = dein Rating
        </p>
      </div>
    </div>
  );
};

export default RatingLogicContent;
