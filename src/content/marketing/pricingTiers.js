// ── Lokaliserad text ovanpå den delade, STRUKTURELLA priskatalogen
// (components/marketing/pricingTiers.js: key/price/gradient/accent/
// featured — aldrig översatt, priset i kronor och layouten är samma
// oavsett språk). Bara namnen/beskrivningarna/funktionslistorna byts ut
// per språk, kopplat ihop via `key` så en featured-flagga eller ett pris
// aldrig kan glida isär mellan språken. sv behöver ingen post här — den
// STRUKTURELLA katalogen ÄR redan den svenska texten.
import { PRICING_TIERS } from '../../components/marketing/pricingTiers';

const TEXT = {
  en: {
    solo: {
      name: 'No employees',
      subtitle: 'For you without staff',
      recommend: 'For you without employees — e.g. a sole trader or consultant who invoices on their own.',
      features: [
        'Automatic bookkeeping from receipts and invoices',
        'Unlimited customer and supplier invoices',
        'Four invoice templates with your own logo and accent colour',
        'VAT return every quarter',
        'Year-end close that locks the financial year',
        'Card payments on invoices via Stripe',
        'SIE4 export — your bookkeeping is always yours',
      ],
      missing: [
        'Payroll runs with automatic tax deduction',
        'Employer declarations (AGI) and income statements',
        'Payment file (ISO 20022), ready to upload to the bank',
      ],
    },
    employer: {
      name: 'With employees',
      subtitle: 'For you with staff',
      recommend: 'For you with employees — e.g. a limited company running its own payroll.',
      features: [
        'Automatic bookkeeping from receipts and invoices',
        'Unlimited customer and supplier invoices',
        'Four invoice templates with your own logo and accent colour',
        'VAT return every quarter',
        'Year-end close that locks the financial year',
        'Card payments on invoices via Stripe',
        'SIE4 export — your bookkeeping is always yours',
        'Payroll runs with automatic tax deduction',
        'Employer declarations (AGI) and income statements',
        'Payment file (ISO 20022), ready to upload to the bank',
      ],
    },
  },
  no: {
    solo: {
      name: 'Uten ansatte',
      subtitle: 'For deg uten ansatte',
      recommend: 'Passer deg uten ansatte — f.eks. enkeltpersonforetak eller konsulent som fakturerer selv.',
      features: [
        'Automatisk bokføring fra kvitteringer og fakturaer',
        'Kunde- og leverandørfakturaer, ubegrenset antall',
        'Fire fakturamaler med din egen logo og aksentfarge',
        'Momsoppgave hvert kvartal',
        'Årsavslutning som låser regnskapsåret',
        'Kortbetaling direkte på fakturaen via Stripe',
        'SIE4-eksport — bokføringen din er alltid din egen',
      ],
      missing: [
        'Lønnskjøring med automatisk skattetrekk',
        'Arbeidsgiveroppgaver (AGI) og kontrolluppgifter',
        'Betalingsfil (ISO 20022), klar til opplasting i banken',
      ],
    },
    employer: {
      name: 'Med ansatte',
      subtitle: 'For deg med ansatte',
      recommend: 'Passer deg med ansatte — f.eks. et aksjeselskap som kjører egen lønn.',
      features: [
        'Automatisk bokføring fra kvitteringer og fakturaer',
        'Kunde- og leverandørfakturaer, ubegrenset antall',
        'Fire fakturamaler med din egen logo og aksentfarge',
        'Momsoppgave hvert kvartal',
        'Årsavslutning som låser regnskapsåret',
        'Kortbetaling direkte på fakturaen via Stripe',
        'SIE4-eksport — bokføringen din er alltid din egen',
        'Lønnskjøring med automatisk skattetrekk',
        'Arbeidsgiveroppgaver (AGI) og kontrolluppgifter',
        'Betalingsfil (ISO 20022), klar til opplasting i banken',
      ],
    },
  },
  dk: {
    solo: {
      name: 'Uden ansatte',
      subtitle: 'Til dig uden ansatte',
      recommend: 'Passer til dig uden ansatte — f.eks. en enkeltmandsvirksomhed eller konsulent, der selv fakturerer.',
      features: [
        'Automatisk bogføring fra kvitteringer og fakturaer',
        'Kunde- og leverandørfakturaer, ubegrænset antal',
        'Fire fakturaskabeloner med dit eget logo og din accentfarve',
        'Momsopgørelse hvert kvartal',
        'Årsafslutning der låser regnskabsåret',
        'Kortbetaling direkte på fakturaen via Stripe',
        'SIE4-eksport — din bogføring er altid din egen',
      ],
      missing: [
        'Lønkørsel med automatisk skattetræk',
        'Arbejdsgiveropgørelser (AGI) og kontroloplysninger',
        'Betalingsfil (ISO 20022), klar til upload i banken',
      ],
    },
    employer: {
      name: 'Med ansatte',
      subtitle: 'Til dig med ansatte',
      recommend: 'Passer til dig med ansatte — f.eks. et aktieselskab, der selv kører løn.',
      features: [
        'Automatisk bogføring fra kvitteringer og fakturaer',
        'Kunde- og leverandørfakturaer, ubegrænset antal',
        'Fire fakturaskabeloner med dit eget logo og din accentfarve',
        'Momsopgørelse hvert kvartal',
        'Årsafslutning der låser regnskabsåret',
        'Kortbetaling direkte på fakturaen via Stripe',
        'SIE4-eksport — din bogføring er altid din egen',
        'Lønkørsel med automatisk skattetræk',
        'Arbejdsgiveropgørelser (AGI) og kontroloplysninger',
        'Betalingsfil (ISO 20022), klar til upload i banken',
      ],
    },
  },
  fi: {
    solo: {
      name: 'Ei työntekijöitä',
      subtitle: 'Sinulle ilman henkilöstöä',
      recommend: 'Sopii sinulle ilman työntekijöitä — esim. toiminimelle tai konsultille, joka laskuttaa itse.',
      features: [
        'Automaattinen kirjanpito kuiteista ja laskuista',
        'Asiakas- ja toimittajalaskut, rajoittamaton määrä',
        'Neljä laskupohjaa omalla logolla ja korostusvärillä',
        'Alv-ilmoitus joka vuosineljännes',
        'Tilinpäätös, joka lukitsee tilikauden',
        'Korttimaksut suoraan laskulla Stripen kautta',
        'SIE4-vienti — kirjanpitosi on aina omasi',
      ],
      missing: [
        'Palkanajo automaattisella verovähennyksellä',
        'Työnantajailmoitukset (AGI) ja valvontatiedot',
        'Maksutiedosto (ISO 20022), valmis ladattavaksi pankkiin',
      ],
    },
    employer: {
      name: 'Työntekijöitä',
      subtitle: 'Sinulle, jolla on henkilöstöä',
      recommend: 'Sopii sinulle, jolla on työntekijöitä — esim. osakeyhtiölle, joka hoitaa palkanlaskennan itse.',
      features: [
        'Automaattinen kirjanpito kuiteista ja laskuista',
        'Asiakas- ja toimittajalaskut, rajoittamaton määrä',
        'Neljä laskupohjaa omalla logolla ja korostusvärillä',
        'Alv-ilmoitus joka vuosineljännes',
        'Tilinpäätös, joka lukitsee tilikauden',
        'Korttimaksut suoraan laskulla Stripen kautta',
        'SIE4-vienti — kirjanpitosi on aina omasi',
        'Palkanajo automaattisella verovähennyksellä',
        'Työnantajailmoitukset (AGI) ja valvontatiedot',
        'Maksutiedosto (ISO 20022), valmis ladattavaksi pankkiin',
      ],
    },
  },
};

/** sv (eller ett språk utan text ovan) → den ostörda strukturella
 * katalogen rakt av. Annars samma tiers, bara med name/subtitle/recommend/
 * features/missing utbytta mot TEXT[locale][tier.key]. */
export function localizedPricingTiers(locale) {
  const overlay = TEXT[locale];
  if (!overlay) return PRICING_TIERS;
  return PRICING_TIERS.map((tier) => ({ ...tier, ...overlay[tier.key] }));
}
