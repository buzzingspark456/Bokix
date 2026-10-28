// Landet anropet kommer ifrån, enligt Vercel (x-vercel-ip-country, ISO-kod
// som 'SE'). Bokix är bara för svenska företag: nya konton får bara skapas
// från Sverige (api/auth/request-password-reset.js, send-signup-code).
// Inloggning och inbjudna personer påverkas inte; en svensk kund på resa och
// en revisor i ett annat land ska fortsätta kunna arbeta.
//
// Saknas rubriken (lokal utveckling, server.js) räknas anropet som svenskt.

/** Landskoden i versaler, eller null om den inte är känd. */
export function requestCountry(req) {
  const raw = req?.headers?.['x-vercel-ip-country'];
  const code = String(Array.isArray(raw) ? raw[0] : raw || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** Kommer anropet bevisligen från ett annat land än Sverige? */
export function isOutsideSweden(req) {
  const country = requestCountry(req);
  return Boolean(country) && country !== 'SE';
}
