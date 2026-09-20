// Funktioner som är byggda men medvetet avstängda tills de provats mot
// Skatteverkets riktiga tjänster. Slå på genom att ändra värdet här.

// AGI-filen (agiXml.js) är validerad mot Skatteverkets XSD men aldrig
// uppladdad i e-tjänsten "Lämna arbetsgivardeklaration" (kräver BankID).
// Ett fel i den filen blir ett fel i en arbetsgivardeklaration.
export const AGI_XML_ENABLED = false;

// eSKD-fält för omvänd skattskyldighet (ruta 21, 22, 30-32) är inte provade
// i Skatteverkets e-tjänst. Bokföringen av dem är på, men momsdeklarationen
// varnar när perioden innehåller sådana belopp.
export const REVERSE_CHARGE_ESKD_VERIFIED = false;
