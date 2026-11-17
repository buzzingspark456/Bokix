import { detectOrgType } from './orgType';

/**
 * Kontot ett kvitto krediteras när ägaren betalat privat (utlägg) i stället
 * för företagets konto (1930). Enskild firma och handelsbolag: 2018 Övriga
 * egna insättningar. Aktiebolag: 2893 Skulder till närstående personer,
 * kortfristig del. Övriga (föreningar m.fl.): 2890 Övriga kortfristiga skulder.
 */
export function ownerPaidAccount(orgNr) {
  const type = detectOrgType(orgNr);
  if (type === 'Enskild firma' || type === 'Handelsbolag / Kommanditbolag') return '2018';
  if (type === 'Aktiebolag (AB)') return '2893';
  return '2890';
}
