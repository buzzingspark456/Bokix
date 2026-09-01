// Produktrundturen — driver.js (https://driverjs.com), valt eftersom det
// är beroendefritt, litet (~5kB) och pekar/lyfter fram RIKTIGA element i
// appen (sidomeny, snabbåtgärder, m.m.) istället för att bara vara en
// separat hjälptext ingen läser. Egen fil (inte inline i App.jsx) så både
// auto-starten vid första inloggning (App.jsx) och "Starta rundtur igen"
// i Hjälp och support (HelpDrawer.jsx) kan dela exakt samma stegdefinition
// utan att importera hela App.jsx.
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '../styles/productTour.css';

// Ökas om stegen ändras på ett sätt som gör en redan visad rundtur
// missvisande (t.ex. ett steg pekar på ett element som flyttats) — en ny
// version visar rundturen igen automatiskt även för konton som redan sett
// en äldre version, se hasSeenTour nedan.
const TOUR_VERSION = 'v1';

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

// Ett steg per rad. `element` matchas mot data-tour-attribut satta direkt
// på sidomenyns knappar (App.jsx) och två ytor på Startsidan
// (Dashboard.jsx) — CSS-selektorer, inte referenser, så den här filen
// aldrig behöver importera vare sig App.jsx eller Dashboard.jsx. Element
// som inte finns i DOM:et just nu (t.ex. "Kom igång"-kortet på ett konto
// som redan är klart) filtreras bort i buildSteps() istället för att låta
// driver.js visa ett tomt/felaktigt steg.
const STEP_DEFS = [
  {
    popover: {
      title: 'Välkommen till Bokix 👋',
      description: 'En snabb rundtur — under en minut, och du kan hoppa över när du vill.',
    },
  },
  {
    element: '.dash-quick-actions',
    popover: {
      title: 'Snabbåtgärder',
      description: 'Det du gör oftast — ny faktura, kvitto eller utgift — ett klick bort.',
    },
  },
  {
    element: '[data-tour="dash-checklist"]',
    popover: {
      title: 'Kom igång-listan',
      description: 'Fyra korta steg som gör kontot helt redo — bocka av i din egen takt.',
    },
  },
  {
    element: '[data-tour="nav-dashboard"]',
    popover: {
      title: 'Startsida',
      description: 'Överblick över intäkter, utgifter och vad som väntar just nu.',
    },
  },
  {
    element: '[data-tour="nav-invoices"]',
    popover: {
      title: 'Fakturering',
      description: 'Skapa, skicka och håll koll på betalningar för kundfakturor.',
    },
  },
  {
    element: '[data-tour="nav-verifications"]',
    popover: {
      title: 'Bokföring',
      description: 'Kvitton och underlag blir till verifikat och bokförs här.',
    },
  },
  {
    element: '[data-tour="nav-reports"]',
    popover: {
      title: 'Rapport och analys',
      description: 'Färdiga rapporter — resultat, balans och mer — utan eget krångel.',
    },
  },
  {
    element: '[data-tour="nav-taxes"]',
    popover: {
      title: 'Skatt och bokslut',
      description: 'Momsdeklaration, bokslut och viktiga datum, allt på ett ställe.',
    },
  },
  {
    element: '[data-tour="nav-settings"]',
    popover: {
      title: 'Inställningar',
      description: 'Företagsuppgifter, användare och prenumeration.',
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
    element: '[data-tour="topbar-profile"]',
    popover: {
      title: 'Ditt konto',
      description: 'Tema, fler företag och utloggning hittar du här.',
    },
  },
  {
    popover: {
      title: 'Klart! 🎉',
      description: 'Kör igång — rundturen väntar under Hjälp och support om du vill se den igen.',
    },
  },
];

function buildSteps() {
  return STEP_DEFS.filter(step => !step.element || document.querySelector(step.element));
}

/** Pollar tills `selector` finns i DOM:et, eller tills `timeout` gått ut
 * (löser ändå — anroparen bygger stegen av det som faktiskt finns, se
 * buildSteps). Behövs för .dash-quick-actions/dash-checklist: Dashboard är
 * en `lazy(() => import(...))`-flik (App.jsx) och hinner inte alltid
 * ladda sin JS-bunt inom en enkel fast fördröjning vid en helt kall första
 * inloggning — sidomenyns/topbarens data-tour-element ligger däremot i
 * App.jsx självt, utanför Suspense, och är redan där när den här kallas. */
function waitForElement(selector, timeout = 3000, interval = 80) {
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

/** Startar rundturen direkt, utan att vänta på något — använd
 * startProductTourWhenReady istället om Dashboard-fliken kanske inte hunnit
 * monteras än (auto-start/den manuella "Starta rundtur igen"-genvägen).
 * `uid` (Supabase user.id) används bara för att minnas att just det
 * kontot sett den — se hasSeenTour. */
export function startProductTour({ uid } = {}) {
  const steps = buildSteps();
  if (steps.length === 0) return null;

  const driverObj = driver({
    animate: true,
    smoothScroll: true,
    overlayColor: '#0f172a',
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 10,
    popoverClass: 'bokix-tour-popover',
    showProgress: true,
    progressText: '{{current}} av {{total}}',
    nextBtnText: 'Nästa',
    prevBtnText: 'Föregående',
    doneBtnText: 'Klart',
    steps,
    onDestroyed: () => markTourSeen(uid),
  });

  driverObj.drive();
  return driverObj;
}

/** Väntar in Dashboard-fliken (se waitForElement ovan) och startar sedan.
 * Delad av auto-starten (App.jsx, maybeAutoStartTour) och "Starta rundtur
 * igen" i Hjälp och support (HelpDrawer.jsx → App.jsx:s onStartTour). */
export async function startProductTourWhenReady({ uid } = {}) {
  await waitForElement('.dash-quick-actions');
  return startProductTour({ uid });
}

/** Auto-start vid inloggning — bara om kontot inte redan sett den här
 * versionen. Anropas från App.jsx efter att inloggningen/betalspärrarna
 * släppt igenom till den riktiga app-vyn, se dess egen kommentar. */
export function maybeAutoStartTour(uid) {
  if (hasSeenTour(uid)) return null;
  return startProductTourWhenReady({ uid });
}
