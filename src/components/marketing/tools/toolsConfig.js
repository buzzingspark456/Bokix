import { Percent, Users, Briefcase, Hammer, AlarmClock, PiggyBank, CalendarClock, FileClock, ScanLine } from 'lucide-react';

// ── EN källa för de fria verktygen ──────────────────────────────────────
// Listan konsumeras av: sidfoten (MarketingLayout.jsx), verktygsnavet
// (/verktyg), "andra verktyg"-raden längst ner på varje verktygssida,
// sitemap-arbetet och llms.txt. Samma princip som pricingTiers.js och
// FAQ_SCHEMA redan följer — ett nytt verktyg läggs till HÄR, en gång, och
// dyker upp överallt. Tidigare mönster i den här kodbasen där två listor
// fick glida isär (startsidan vs prissidan) är precis det här ska undvika.
//
// `path` måste matcha routen i AppRouter.jsx, prerender-listan i
// entry-server.jsx OCH rewriten i vercel.json — de tre hänger ihop för
// varje statisk marknadssida. Se kommentaren i entry-server.jsx.
// `footerLabel` är kortformen som används där utrymmet är smalt (sidfotens
// mobilkolumner) — sidans egen titel, meta och h1 påverkas aldrig av den.
export const TOOLS = [
  {
    slug: 'skanna-kvitto',
    footerLabel: 'Skanna kvitto',
    path: '/verktyg/skanna-kvitto',
    icon: ScanLine,
    accentKey: 'blue',
    title: 'Skanna kvitto (OCR)',
    short: 'Läs av ett kvitto direkt',
    description: 'Ladda upp en bild av ett kvitto — datum, belopp, moms och ett kontoförslag läses av automatiskt, direkt i din webbläsare.',
  },
  {
    slug: 'momskalkylator',
    footerLabel: 'Momskalkylator',
    path: '/verktyg/momskalkylator',
    icon: Percent,
    accentKey: 'blue',
    title: 'Momskalkylator',
    // `short` används där utrymmet är en rad (sidfot, relaterade verktyg),
    // `description` där det finns plats för en mening (navet, meta).
    short: 'Räkna moms fram och tillbaka',
    description: 'Lägg på eller räkna ur moms med 25, 12 eller 6 % — och se direkt vilka konton och momsrutor beloppet hamnar i.',
  },
  {
    slug: 'lonekalkylator',
    footerLabel: 'Lönekalkylator',
    path: '/verktyg/lonekalkylator',
    icon: Users,
    accentKey: 'green',
    title: 'Lönekalkylator',
    short: 'Vad en anställd kostar',
    description: 'Från bruttolön till verklig arbetsgivarkostnad: arbetsgivaravgift, semesteravsättning och sociala avgifter på semestern.',
  },
  {
    slug: 'egenavgifter',
    footerLabel: 'Egenavgifter',
    path: '/verktyg/egenavgifter',
    icon: Briefcase,
    accentKey: 'teal',
    title: 'Egenavgiftskalkylator',
    short: 'Enskild firma: vad blir kvar?',
    description: 'Schablonavdrag, egenavgifter och inkomstskatt på överskottet i en enskild firma — i rätt ordning.',
  },
  {
    slug: 'rot-rut',
    footerLabel: 'ROT och RUT',
    path: '/verktyg/rot-rut',
    icon: Hammer,
    accentKey: 'green',
    title: 'ROT- och RUT-kalkylator',
    short: 'Vad kunden betalar efter avdrag',
    description: 'Räkna ut ROT- eller RUT-avdraget på arbetskostnaden och se exakt vad kunden ska betala på fakturan.',
  },
  {
    slug: 'drojsmalsranta',
    footerLabel: 'Dröjsmålsränta',
    path: '/verktyg/drojsmalsranta',
    icon: AlarmClock,
    accentKey: 'red',
    title: 'Dröjsmålsränta',
    short: 'Ränta på en försenad faktura',
    description: 'Dröjsmålsränta per dag enligt räntelagen, plus de påminnelse- och förseningsavgifter du faktiskt får ta ut.',
  },
  {
    slug: 'utdelning',
    footerLabel: 'Utdelning 3:12',
    path: '/verktyg/utdelning',
    icon: PiggyBank,
    accentKey: 'teal',
    title: 'Utdelningskalkylator (3:12)',
    short: 'Gränsbelopp och skatt på utdelning',
    description: 'Räkna ut gränsbeloppet i ditt fåmansbolag enligt de nya 3:12-reglerna från 2026 — grundbelopp, lönebaserat utrymme och vad utdelningen kostar i skatt.',
  },
  {
    slug: 'momsdatum',
    footerLabel: 'Momsdatum',
    path: '/verktyg/momsdatum',
    icon: CalendarClock,
    accentKey: 'blue',
    title: 'Momsdeklaration — nästa datum',
    short: 'När ska jag deklarera moms?',
    description: 'Se nästa förfallodatum för momsdeklarationen — månadsvis, kvartalsvis eller årsvis, inklusive Skatteverkets undantag i januari och augusti.',
  },
  {
    slug: 'arsredovisning',
    footerLabel: 'Årsredovisning-deadline',
    path: '/verktyg/arsredovisning',
    icon: FileClock,
    accentKey: 'red',
    title: 'Deadline för årsredovisningen',
    short: 'Sju månader — och vad förseningen kostar',
    description: 'Räkna ut när årsredovisningen senast ska vara hos Bolagsverket och hela förseningsavgiftstrappan om den blir sen.',
  },
];

export const TOOLS_HUB_PATH = '/verktyg';

export function toolBySlug(slug) {
  return TOOLS.find(t => t.slug === slug);
}
