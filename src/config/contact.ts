export const PREMIUM_SUPPORT_EMAIL = "support@plyrz.at";
export const PREMIUM_EMAIL_SUBJECT = "PLYRZ Premium Anfrage";

export function createPremiumEmailLink(playerName?: string, clubName?: string, playerId?: string): string {
  const body = [
    "Servus PLYRZ Team,",
    "",
    "ich interessiere mich für PLYRZ Premium.",
    "",
    playerName ? `Name in der App: ${playerName}` : "Name in der App:",
    clubName ? `Verein: ${clubName}` : "Verein:",
    "Mannschaft:",
    playerId ? `Player-ID: ${playerId}` : "",
    "",
    "Bitte sendet mir die weiteren Infos zu Premium.",
    "",
    "Danke!"
  ].filter(line => line !== "").join("\n");

  return `mailto:${PREMIUM_SUPPORT_EMAIL}?subject=${encodeURIComponent(PREMIUM_EMAIL_SUBJECT)}&body=${encodeURIComponent(body)}`;
}
