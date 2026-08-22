import { checkBotId } from 'botid/server';

// Vercel BotID kräver i produktion en VERCEL_OIDC_TOKEN (Vercels OIDC-
// federation, automatiskt injicerad i deployade functions — men beroende
// på projektinställningar kan den saknas) och gör ett nätverksanrop mot
// Vercels egen bot-protection-tjänst. Om NÅGOT av det strular (OIDC av,
// tillfälligt nätverksfel hos Vercel) kastar checkBotId() ett fel — och
// det får ALDRIG slå ut riktiga betalnings-/mejl-endpoints för riktiga
// kunder. Bot-skyddet är ett extra lager ovanpå redan-byggda kontroller
// (auth, rate limiting, server-side omberäknade belopp), inte den enda
// spärren — så "fail open" (släpp igenom, logga en varning) är rätt val
// här, inte "fail closed" (blockera allt vid minsta strul).
export async function isRequestFromBot() {
  try {
    const { isBot } = await checkBotId();
    return isBot;
  } catch (err) {
    console.warn('BotID-kollen misslyckades (fail-open, request släpps igenom):', err.message);
    return false;
  }
}
