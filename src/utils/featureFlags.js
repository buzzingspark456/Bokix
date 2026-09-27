// Funktioner som är byggda men medvetet avstängda tills de provats mot
// Skatteverkets riktiga tjänster. Slå på genom att ändra värdet här.

// AGI-filen (agiXml.js) är provad i Skatteverkets testtjänst för
// arbetsgivardeklaration 2026-09-24: aktiebolag och enskild firma, med
// förmåner, bilförmån, milersättning, traktamente och alla avgiftsgrupper
// (standard, 67+, född 1937 eller tidigare, unga) gav "Filen är godkänd",
// och en fil med ett felaktigt personnummer underkändes som den skulle.
// Testtjänsten: https://sso.test.skatteverket.se/agd_tt/da_testtjanst_web/login.do?method=test
export const AGI_XML_ENABLED = true;

// eSKD-fält för omvänd skattskyldighet, import och momsfri försäljning
// (ruta 20-24, 30-32, 35-42, 50, 60-62) är inte provade
// i Skatteverkets e-tjänst. Bokföringen av dem är på, men momsdeklarationen
// varnar när perioden innehåller sådana belopp.
export const REVERSE_CHARGE_ESKD_VERIFIED = false;
