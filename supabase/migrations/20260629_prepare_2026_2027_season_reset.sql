-- =============================================================================
-- WARNUNG: SAISON-RESET SCRIPT 2026/2027
-- =============================================================================
-- Dieses Skript löscht ALLE bestehenden Spieldaten (Fixtures, Votes, Events, etc.)
-- und setzt die Spielerstatistiken (player_stats) auf die Standardwerte (50) zurück.
-- Vereine, Teams, Spieler, Profile und Administratoren bleiben erhalten.
--
-- VOR AUSFÜHRUNG: BITTE EIN VOLLSTÄNDIGES DATENBANK-BACKUP MACHEN!
-- =============================================================================

-- SICHERHEITS-GUARD (Aktivieren durch Auskommentieren oder Variablen-Setzen, 
-- in diesem SQL-Dialekt packen wir es in einen DO-Block, der bei Bedarf ausgeführt werden kann)
-- Um das Skript auszuführen, markiere und führe den gesamten Text aus, 
-- oder führe die Anweisungen im SQL-Editor von Supabase aus.

BEGIN;

-- 1. Abhängige Tabellen löschen (Reihenfolge wichtig wegen Foreign Keys auf fixtures)

-- Zuerst Tabellen löschen, die auf fixtures und players referenzieren
DELETE FROM public.fixture_vote_completions;
DELETE FROM public.player_votes;
DELETE FROM public.match_checkins;
DELETE FROM public.match_events;
DELETE FROM public.fixture_lineups;
DELETE FROM public.player_rating_history;

-- 2. Alte Fixtures löschen
DELETE FROM public.fixtures;

-- 3. Player Stats zurücksetzen
-- Setze alle Rating-Werte auf den Standardwert (50) zurück.
-- Zähler für Ziele/Karten (falls vorhanden) würden hier auch genullt, 
-- die aktuelle Struktur hat aber laut Typen nur diese Basis-Werte.
UPDATE public.player_stats
SET 
    overall = 50,
    tem = 50,
    sch = 50,
    pas = 50,
    dri = 50,
    def = 50,
    phy = 50,
    updated_at = NOW();

COMMIT;

-- =============================================================================
-- KONTROLL-ABFRAGEN
-- (Zeigen nach der Ausführung die aktuelle Anzahl der Einträge an)
-- =============================================================================
SELECT 'fixtures' AS table_name, COUNT(*) AS row_count FROM public.fixtures
UNION ALL
SELECT 'player_votes', COUNT(*) FROM public.player_votes
UNION ALL
SELECT 'fixture_lineups', COUNT(*) FROM public.fixture_lineups
UNION ALL
SELECT 'player_rating_history', COUNT(*) FROM public.player_rating_history
UNION ALL
SELECT 'player_stats', COUNT(*) FROM public.player_stats;
