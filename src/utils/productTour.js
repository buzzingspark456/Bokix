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
import { supabase } from '../supabaseClient';

// Ökas om stegen ändras på ett sätt som gör en redan visad rundtur
// missvisande (t.ex. ett steg pekar på ett element som flyttats/döpts om)
// — en ny version visar rundturen igen automatiskt även för konton som
// redan sett en äldre version, se hasSeenTour nedan.
const TOUR_VERSION = 'v4';

function storageKey(uid) {
  return `bokix_tour_done_${TOUR_VERSION}_${uid}`;
}

// Markeringen sparas på två ställen: i webbläsaren (snabbt) och på kontot
// (user_metadata.bokix_tour_seen), så att rundturen inte kommer tillbaka i
// en ny webbläsare, på en ny enhet eller när Safari rensat localStorage.
const META_KEY = 'bokix_tour_seen';
// Automatiskt bara för nya konton. Befintliga användare startar den själva
// under Hjälp och support.
const AUTO_START_MAX_AGE_DAYS = 7;

/** true = redan sedd (eller inget känt konto att komma ihåg det på — visas
 * då hellre INTE automatiskt än att riskera att störa en delad/utloggad
 * session). false = ska visas automatiskt vid nästa tillfälle. */
export function hasSeenTour(uid, user = null) {
  if (!uid) return true;
  if (user?.user_metadata?.[META_KEY]) return true;
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
    // Går inte att komma ihåg lokalt — kontot kommer ihåg det nedan.
  }
  // På kontot också, en gång. Misslyckas det gör det inget: localStorage
  // och åldersgränsen hindrar ändå att rundturen tjatar.
  supabase.auth.updateUser({ data: { [META_KEY]: TOUR_VERSION } }).catch(() => {});
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
// Omgjord 2026-11-10: kort (5–6 steg) och pekar på menyn i stället för att
// öppna formulär. Startar aldrig av sig själv längre (Kom igång är första
// mötet för ett nytt konto); den startas från Kom igång eller Hjälp och support.
// `when` = steget tas bara med om villkoret stämmer när turen startar.
const isPhone = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(max-width: 768px)').matches);
const hasGetStarted = () => Boolean(document.querySelector('.gs-card'));

const STEP_DEFS = [
  {
    popover: {
      title: 'Välkommen till Bokix',
      description: 'Så hittar du rätt, på en halv minut. Hoppa över när du vill.',
    },
  },
  {
    tab: 'dashboard',
    element: '.gs-card',
    when: hasGetStarted,
    popover: {
      title: 'Börja här',
      description: 'Nästa steg står alltid överst, och korten bockas av av sig själva när du gjort dem.',
    },
  },
  {
    tab: 'dashboard',
    element: '.dash-body',
    when: () => !hasGetStarted(),
    popover: {
      title: 'Startsidan',
      description: 'Hur det går för företaget, och det som väntar på dig.',
    },
  },
  {
    element: '[data-tour="nav-business"]',
    when: () => !isPhone(),
    popover: {
      title: 'Pengar in',
      description: 'Kunder, offerter och fakturor. Allt som ger pengar in.',
      side: 'right',
    },
  },
  {
    element: '[data-tour="nav-finance"]',
    when: () => !isPhone(),
    popover: {
      title: 'Pengar ut',
      description: 'Kvitton, leverantörsfakturor och lön. Fota kvittot, så bokför Bokix det.',
      side: 'right',
    },
  },
  {
    element: '[data-tour="nav-reports"]',
    when: () => !isPhone(),
    popover: {
      title: 'Koll på ekonomin',
      description: 'Bank, bokföring, rapporter och moms, uträknat av det du lagt in.',
      side: 'right',
    },
  },
  {
    element: '.mobile-bottom-nav',
    when: isPhone,
    popover: {
      title: 'Menyn',
      description: 'Hem, Bokföring, Kvitton och Rapporter. Allt annat finns under Meny.',
      side: 'top',
    },
  },
  {
    element: '[data-tour="topbar-help"]',
    when: () => !isPhone(),
    popover: {
      title: 'Hjälp och support',
      description: 'Sök bland hjälptexterna, se hur allt fungerar steg för steg, eller skriv till oss.',
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
function buildSteps(hiddenTabs = []) {
  return STEP_DEFS.filter(step => (!step.when || step.when()) && (!step.optional || document.querySelector(step.element)) && !(step.tab && hiddenTabs.includes(step.tab)));
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
  // Ihopfälld menygrupp: fäll ut den så att det som visas syns.
  const el = step.element && document.querySelector(step.element);
  if (el?.classList.contains('is-collapsed')) el.previousElementSibling?.click();
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
export function startProductTour({ uid, navigate, hiddenTabs = [] } = {}) {
  const steps = buildSteps(hiddenTabs);
  if (steps.length === 0) return null;
  const nav = withNavigation(steps, navigate || (() => {}));

  const driverObj = driver({
    animate: true,
    smoothScroll: true,
    overlayColor: '#0b1a12',
    overlayOpacity: 0.55,
    stagePadding: 8,
    stageRadius: 16,
    popoverClass: 'bokix-tour-popover',
    showProgress: true,
    progressText: '{{current}} av {{total}}',
    nextBtnText: 'Nästa',
    prevBtnText: 'Tillbaka',
    doneBtnText: 'Klart',
    steps,
    onNextClick: nav.onNextClick,
    onPrevClick: nav.onPrevClick,
    onCloseClick: nav.onCloseClick,
    // Prickar i stället för "2 av 6": den aktiva är ett grönt streck, klara är ljusgröna.
    onPopoverRender: (popover, { state }) => {
      const at = state.activeIndex ?? 0;
      popover.progress.innerHTML = steps.map((_, k) => '<span class="bx-tour-dot' + (k === at ? ' on' : k < at ? ' done' : '') + '"></span>').join('');
      popover.progress.setAttribute('aria-label', 'Steg ' + (at + 1) + ' av ' + steps.length);
    },
    onDestroyed: () => { try { localStorage.setItem(storageKey(uid), '1'); } catch { /* privat läge */ } },
  });

  // Markeras som sedd redan när den startar: stängs fliken eller laddas
  // sidan om mitt i rundturen ska den inte börja om vid nästa inloggning.
  markTourSeen(uid);
  driverObj.drive();
  return driverObj;
}

/** Väntar in Dashboard-fliken (se waitForElement ovan) och startar sedan.
 * Delad av auto-starten (App.jsx, maybeAutoStartTour) och "Starta rundtur
 * igen" i Hjälp och support (HelpDrawer.jsx → App.jsx:s onStartTour). */
export async function startProductTourWhenReady({ uid, navigate, hiddenTabs = [] } = {}) {
  await waitForElement('.dash-top');
  return startProductTour({ uid, navigate, hiddenTabs });
}

/** Auto-start vid inloggning — bara om kontot inte redan sett den här
 * versionen. Anropas från App.jsx efter att inloggningen/betalspärrarna
 * släppt igenom till den riktiga app-vyn, se dess egen kommentar. */
export function maybeAutoStartTour(uid, navigate, hiddenTabs = [], user = null) {
  if (hasSeenTour(uid, user)) return null;
  // Bara nya konton (eller okänd ålder = hellre inte).
  const created = user?.created_at ? new Date(user.created_at).getTime() : NaN;
  if (!Number.isFinite(created) || Date.now() - created > AUTO_START_MAX_AGE_DAYS * 86400000) return null;
  return startProductTourWhenReady({ uid, navigate, hiddenTabs });
}
