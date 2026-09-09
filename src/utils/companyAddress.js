// Företagets adress på ETT ställe.
//
// Kundönskemål: adressen ska fyllas i som tre riktiga fält — gatuadress,
// postnummer och ort — i stället för en enda textrad man skriver som man
// vill. Skälet är inte kosmetiskt: adressen skrivs ut på fakturor, i mejl
// och i filer till myndigheter, och då måste postnummer och ort gå att
// läsa var för sig.
//
// BAKÅTKOMPATIBILITET (viktig): alla företag som redan finns har hela
// adressen i `address` ("Storgatan 15, 111 23 Stockholm"), och de fälten
// rörs aldrig automatiskt — att gissa var gatan slutar och postnumret
// börjar i en fritextrad är precis den sortens tysta datamanipulation som
// inte hör hemma i ett bokföringsprogram. Funktionerna nedan ger därför
// exakt samma resultat som förut för gammal data: saknas postalCode/city
// returneras `address` orörd.

/** Adressen som EN rad, för fakturor/mejl där den skrivs på ett ställe. */
export function formatCompanyAddress(company) {
  const street = (company?.address || '').trim();
  const postalCity = [company?.postalCode, company?.city]
    .map(v => (v || '').trim())
    .filter(Boolean)
    .join(' ');
  return [street, postalCity].filter(Boolean).join(', ');
}

/** Adressen som separata rader, för brevhuvuden där den ska brytas. */
export function companyAddressLines(company) {
  const street = (company?.address || '').trim();
  const postalCity = [company?.postalCode, company?.city]
    .map(v => (v || '').trim())
    .filter(Boolean)
    .join(' ');
  return [street, postalCity].filter(Boolean);
}
