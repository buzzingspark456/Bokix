// Produktrundturen — driver.js (https://driverjs.com), valt eftersom det
// är beroendefritt, litet (~5kB) och pekar/lyfter fram RIKTIGA element i
// appen istället för att bara vara en separat hjälptext ingen läser.
//
// Historik/kundfeedback, i tur och ordning: v1 pekade bara på sidomenyns
// länkar och beskrev dem utifrån ("det här är Fakturering"). v2 navigerade
// in på varje sida och pekade på EN riktig knapp där. v3 (den här): för
// mycket text på välkomststeget, emojis som inte passade, för få sidor
// (Kunder/Projekt/Granskning saknades), och knapparna pekades bara på
// istället för att formulären faktiskt öppnades så de riktiga fälten syns.
//
// Egen fil (inte inline i App.jsx) så både auto-starten vid första
// inloggning och "Starta rundtur igen" i Hjälp och support
// (HelpDrawer.jsx) kan dela exakt samma stegdefinition. Vet ingenting om
// App.jsx:s state — får `navigate` (App.jsx:s handleNavTabChange) inskickat
// istället för att importera hela App.jsx.
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '../styles/productTour.css';

// Ökas om stegen ändras på ett sätt som gör en redan visad rundtur
// missvisande (t.ex. ett steg pekar på ett element som flyttats/döpts om)
// — en ny version visar rundturen igen automatiskt även för konton som
// redan sett en äldre version, se hasSeenTour nedan.
const TOUR_VERSION = 'v3';

function storageKey(uid) {
  return `bokix_tour_done_${TOUR_VERSION}_${uid}`;
}

/** true = redan sedd (eller inget känt konto att komma ihåg det på — visas
 * då hellre INTE automatiskt än att riskera att störa en delad/utloggad
 * session). false = ska visas automatiskt vid nästa tillfälle. */
export function hasSeenTour(uid) {
  if (!uid) return true;
  try {
    return localStorage.getItem(storageKey(uid)) === '1';
  } catch {
    // Privat läge/blockerad localStorage — visa hellre inte om och om
    // igen varje sidladdning, samma avvägning som consent.js gör.
    return true;
  }
}

function markTourSeen(uid) {
  if (!uid) return;
  try {
    localStorage.setItem(storageKey(uid), '1');
  } catch {
    // Går inte att komma ihåg — ofarligt, rundturen visar sig bara igen.
  }
}

/** Pollar tills `selector` finns i DOM:et, eller tills `timeout` gått ut
 * (löser ändå — anroparen fortsätter oavsett, driver.js faller tillbaka på
 * ett centrerat dummy-läge om elementet aldrig dyker upp). Behövs eftersom
 * praktiskt taget alla flikar är `lazy(() => import(...))` i App.jsx och
 * inte hinner ladda sin JS-bunt inom en enkel fast fördröjning, särskilt
 * vid en helt kall session.
 * Exporterad — utils/invoiceTour.js (Fakturor-sidans egen, kortare guide)
 * återanvänder den här istället för att hålla en andra tyst kopia. */
export function waitForElement(selector, timeout = 3000, interval = 80) {
  return new Promise(resolve => {
    const start = Date.now();
    const check = () => {
      if (document.querySelector(selector)) { resolve(true); return; }
      if (Date.now() - start >= timeout) { resolve(false); return; }
      setTimeout(check, interval);
    };
    check();
  });
}

// Ett steg per rad.
//   tab           - fliken måste vara aktiv för att elementet ska finnas;
//                   withNavigation byter dit automatiskt.
//   openSelector  - klickas (om satt) INNAN elementet letas upp, t.ex.
//                   sidans "Ny X"-knapp, så att formuläret faktiskt öppnas.
//   element       - det som lyfts fram/pekas på.
//   closeSelector - klickas när man LÄMNAR steget (framåt eller bakåt), så
//                   ett formulär öppnat via openSelector inte blir kvar
//                   öppet i bakgrunden.
// data-tour-attributen matchas mot attribut satta direkt i App.jsx
// (sidomeny/topbar) och i respektive sidas riktiga knappar/fält — CSS-
// selektorer, inte referenser, så den här filen aldrig behöver importera
// dem.
const STEP_DEFS = [
  {
    popover: {
      title: 'Välkommen till Bokix',
      description: 'En snabb rundtur — hoppa över när du vill.',
    },
  },
  {
    tab: 'dashboard',
    element: '.dash-quick-actions',
    popover: {
      title: 'Startsida',
      description: 'Det du gör oftast — ny faktura, nytt kvitto, ny utgift — är alltid ett klick bort härifrån.',
    },
  },
  {
    tab: 'dashboard',
    element: '[data-tour="dash-checklist"]',
    optional: true,
    popover: {
      title: 'Kom igång-listan',
      description: 'Fyra korta steg som gör kontot klart — bocka av i din egen takt.',
    },
  },
  {
    tab: 'contacts',
    openSelector: '[data-tour="page-contacts-cta"]',
    element: '[data-tour="page-contacts-field"]',
    closeSelector: '[data-tour="page-contacts-cancel"]',
    popover: {
      title: 'Kunder',
      description: 'Fyll i namnet — Bokix slår upp organisationsnummer och adress åt dig automatiskt.',
    },
  },
  {
    tab: 'invoices',
    openSelector: '[data-tour="page-invoices-cta"]',
    element: '[data-tour="page-invoices-field"]',
    closeSelector: '[data-tour="page-invoices-cancel"]',
    popover: {
      title: 'Fakturering',
      description: 'Välj kund och lägg till rader — Bokix räknar moms och totalsumma automatiskt.',
    },
  },
  {
    tab: 'verifications',
    openSelector: '[data-tour="page-verifications-cta"]',
    element: '[data-tour="page-verifications-field"]',
    closeSelector: '[data-tour="page-verifications-cancel"]',
    popover: {
      title: 'Bokföring',
      description: 'Beskriv affärshändelsen — datum, belopp och konton bokförs härifrån.',
    },
  },
  {
    tab: 'projects',
    openSelector: '[data-tour="page-projects-cta"]',
    element: '[data-tour="page-projects-field"]',
    closeSelector: '[data-tour="page-projects-cancel"]',
    popover: {
      title: 'Projekt',
      description: 'Namnge projektet — tid och kostnader går sedan att koppla hit.',
    },
  },
  {
    tab: 'review',
    element: '[data-tour="page-review-content"]',
    popover: {
      title: 'Granskning',
      description: 'Transaktioner som väntar på att kopplas till rätt konto, t.ex. från Stripe, hamnar här.',
    },
  },
  {
    tab: 'reports',
    element: '[data-tour="page-reports-list"]',
    popover: {
      title: 'Rapport och analys',
      description: 'Klicka på en rapport för att öppna den fullständigt beräknad, alltid byggd på din riktiga bokföring.',
    },
  },
  {
    tab: 'taxes',
    element: '[data-tour="page-taxes-content"]',
    popover: {
      title: 'Skatt och bokslut',
      description: 'Momsdeklaration, bokslut och viktiga datum — uträknat automatiskt utifrån din bokföring.',
    },
  },
  {
    tab: 'settings',
    element: '[data-tour="page-settings-nav"]',
    popover: {
      title: 'Inställningar',
      description: 'Företagsuppgifter, användare och prenumeration — allt samlat i den här menyn.',
    },
  },
  {
    element: '[data-tour="topbar-help"]',
    popover: {
      title: 'Hjälp och support',
      description: 'Ordlista, kontakt — och den här rundturen igen, när du vill.',
    },
  },
  {
    openSelector: '[data-tour="topbar-profile"]',
    element: '[data-tour="topbar-profile-dropdown"]',
    closeSelector: '[data-tour="topbar-profile"]',
    popover: {
      title: 'Ditt konto',
      description: 'Under din avatar: kontoplaner, viktiga datum, bokslut, momsredovisning och att lägga till fler företag.',
    },
  },
  {
    popover: {
      title: 'Klart',
      description: 'Hitta rundturen igen under Hjälp och support.',
    },
  },
];

/** De flesta steg inkluderas ovillkorligt även om deras `element` inte
 * finns just nu — de kräver ju ofta en flik-/formulärväxling först (se
 * withNavigation), så en synkron document.querySelector-koll HÄR skulle
 * fela på nästan varenda sidspecifikt steg innan turen ens hunnit
 * navigera dit (det var precis den buggen v2 hade: alla sidsteg
 * filtrerades bort direkt vid start). Enda undantaget är `optional`-
 * flaggade steg (just nu bara dash-checklist) — den kollen är trygg
 * eftersom startProductTourWhenReady redan garanterat väntat in
 * Dashboard-chunken innan buildSteps() körs. */
function buildSteps() {
  return STEP_DEFS.filter(step => !step.optional || document.querySelector(step.element));
}

/** Går in i `step`: byter flik (om satt), öppnar ev. formulär
 * (openSelector) och väntar in det slutgiltiga elementet. Anropas av
 * withNavigation innan driver.js faktiskt flyttar till steget. */
async function enterStep(step, navigate) {
  if (!step) return;
  if (step.tab) navigate(step.tab);
  if (step.openSelector) {
    await waitForElement(step.openSelector, 3000);
    document.querySelector(step.openSelector)?.click();
  }
  if (step.element) await waitForElement(step.element, 3000);
}

/** Lämnar `step`: stänger ett ev. öppnat formulär (closeSelector) så det
 * inte blir kvar öppet i bakgrunden när man navigerar iväg, går bakåt in
 * i det igen, eller stänger hela rundturen mitt i. */
function leaveStep(step) {
  if (!step?.closeSelector) return;
  document.querySelector(step.closeSelector)?.click();
}

/** Bygger driver-nivåns onNextClick/onPrevClick/onCloseClick.  `navigate`
 * är App.jsx:s egen handleNavTabChange — samma funktion ett klick i
 * sidomenyn skulle anropa, så den uppdaterar URL-hash/stänger mobilmenyn
 * precis som en riktig navigering. Anropar den alltid, även om flikens
 * redan aktiv (ofarligt no-op) — enklare än att hålla reda på "nuvarande
 * flik" separat i den här filen. */
function withNavigation(steps, navigate) {
  return {
    onNextClick: async (_element, _step, opts) => {
      leaveStep(steps[opts.index]);
      await enterStep(steps[opts.index + 1], navigate);
      opts.driver.moveNext();
    },
    onPrevClick: async (_element, _step, opts) => {
      leaveStep(steps[opts.index]);
      await enterStep(steps[opts.index - 1], navigate);
      opts.driver.movePrevious();
    },
    onCloseClick: (_element, _step, opts) => {
      leaveStep(steps[opts.index]);
      opts.driver.destroy();
    },
  };
}

/** Startar rundturen direkt, utan att vänta på något — använd
 * startProductTourWhenReady istället om Dashboard-fliken kanske inte hunnit
 * monteras än (auto-start/den manuella "Starta rundtur igen"-genvägen).
 * `uid` (Supabase user.id) används bara för att minnas att just det kontot
 * sett den, se hasSeenTour. `navigate` = App.jsx:s handleNavTabChange, se
 * withNavigation ovan för varför den behövs. */
export function startProductTour({ uid, navigate } = {}) {
  const steps = buildSteps();
  if (steps.length === 0) return null;
  const nav = withNavigation(steps, navigate || (() => {}));

  const driverObj = driver({
    animate: true,
    smoothScroll: true,
    overlayColor: '#0f172a',
    overlayOpacity: 0.6,
    stagePadding: 8,
    stageRadius: 12,
    popoverClass: 'bokix-tour-popover',
    showProgress: true,
    progressText: '{{current}} av {{total}}',
    nextBtnText: 'Nästa',
    prevBtnText: 'Föregående',
    doneBtnText: 'Klart',
    steps,
    onNextClick: nav.onNextClick,
    onPrevClick: nav.onPrevClick,
    onCloseClick: nav.onCloseClick,
    onDestroyed: () => markTourSeen(uid),
  });

  driverObj.drive();
  return driverObj;
}

/** Väntar in Dashboard-fliken (se waitForElement ovan) och startar sedan.
 * Delad av auto-starten (App.jsx, maybeAutoStartTour) och "Starta rundtur
 * igen" i Hjälp och support (HelpDrawer.jsx → App.jsx:s onStartTour). */
export async function startProductTourWhenReady({ uid, navigate } = {}) {
  await waitForElement('.dash-quick-actions');
  return startProductTour({ uid, navigate });
}

/** Auto-start vid inloggning — bara om kontot inte redan sett den här
 * versionen. Anropas från App.jsx efter att inloggningen/betalspärrarna
 * släppt igenom till den riktiga app-vyn, se dess egen kommentar. */
export function maybeAutoStartTour(uid, navigate) {
  if (hasSeenTour(uid)) return null;
  return startProductTourWhenReady({ uid, navigate });
}
