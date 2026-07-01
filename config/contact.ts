// Format: international, no '+', no spaces, no leading 0
// Example Austria: 0664 1234567 -> 436641234567
export const WHATSAPP_BUSINESS_PHONE = "HIER_DEINE_NUMMER_EINTRAGEN";

export function createWhatsAppPremiumLink(playerName?: string, clubName?: string, playerId?: string): string {
  let message = 'Hallo, ich interessiere mich für PLYRZ Premium für meine Spielerkarte. Bitte schickt mir weitere Infos.';
  
  if (playerName || clubName || playerId) {
    message = 'Hallo, ich interessiere mich für PLYRZ Premium.\n';
    if (playerName) message += `Spieler: ${playerName}\n`;
    if (clubName) message += `Verein: ${clubName}\n`;
    if (playerId) message += `Player-ID: ${playerId}\n`;
    message += 'Bitte schickt mir weitere Infos.';
  }

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${WHATSAPP_BUSINESS_PHONE}?text=${encodedMessage}`;
}
