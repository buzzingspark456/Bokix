// Produktrundturen — driver.js (https://driverjs.com), valt eftersom det
// är beroendefritt, litet (~5kB) och pekar/lyfter fram RIKTIGA element i
// appen istället för att bara vara en separat hjälptext ingen läser.
//
// Kundfeedback (v1 av den här rundturen visade bara sidomenyns knappar och
// beskrev dem utifrån — "det här är Fakturering" osv.): en riktig rundtur
// måste faktiskt VISA hur mjukvaran funkar, sida för sida — så varje
// "sektion"-steg nedan navigerar in på den riktiga sidan (samma
// handleNavTabChange som ett klick i sidomenyn skulle göra, se `navigate`)
// och pekar på en RIKTIG funktion där (knappen som skapar en faktura,
// knappen som bokför en verifikation, osv.), inte bara på länken i
// sidomenyn som ledde dit.
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
const TOUR_VERSION = 'v2';

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
 * (löser ändå — anroparen visar bara ett degraderat/färre-steg-läge om
 * elementet aldrig dyker upp). Behövs eftersom praktiskt taget alla flikar
 * (Dashboard/Invoices/Verifications/Reports/Taxes/Settings) är
 * `lazy(() => import(...))` i App.jsx och inte hinner ladda sin JS-bunt
 * inom en enkel fast fördröjning, särskilt vid en helt kall session. */
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

// Ett steg per rad. `tab` (om satt) = fliken måste vara aktiv för att
// `element` ska finnas — se withNavigation nedan, som byter flik automatiskt
// när man klickar Nästa/Föregående in i eller ut ur ett sådant steg.
// data-tour-attributen matchas mot attribut satta direkt i App.jsx
// (sidomeny/topbar) och i respektive sidas "riktiga knapp" (Invoices.jsx/
// Verifications.jsx/Settings.jsx/Taxes.jsx/Reports.jsx) — CSS-selektorer,
// inte referenser, så den här filen aldrig behöver importera dem.
const STEP_DEFS = [
  {
    popover: {
      title: 'Välkommen till Bokix 👋',
      description: 'Vi visar hur du faktiskt använder Bokix — en sida i taget, med de knappar du kommer klicka på i verkligheten. Under en minut, och du kan hoppa över när du vill.',
    },
  },
  {
    tab: 'dashboard',
    element: '.dash-quick-actions',
    popover: {
      title: '🏠 Startsida — snabbåtgärder',
      description: 'Det du gör oftast — ny faktura, nytt kvitto, ny utgift — är alltid ett klick bort härifrån, oavsett var i appen du befinner dig.',
    },
  },
  {
    tab: 'dashboard',
    element: '[data-tour="dash-checklist"]',
    popover: {
      title: '🏠 Kom igång-listan',
      description: 'Fyra korta steg som gör kontot helt klart — bocka av i din egen takt, den försvinner av sig själv när allt är gjort.',
    },
  },
  {
    tab: 'invoices',
    element: '[data-tour="page-invoices-cta"]',
    popover: {
      title: '🧾 Fakturering',
      description: 'Klicka här för att skapa en faktura: välj kund, lägg till rader — Bokix räknar ut moms och totalsumma automatiskt, och du skickar direkt från appen.',
    },
  },
  {
    tab: 'verifications',
    element: '[data-tour="page-verifications-cta"]',
    popover: {
      title: '📚 Bokföring',
      description: '"Ny verifikation" bokför en affärshändelse — ladda upp ett kvitto eller fyll i belopp och konton själv. Allt du bokför landar här, sökbart och redo för bokslutet.',
    },
  },
  {
    tab: 'reports',
    element: '[data-tour="page-reports-list"]',
    popover: {
      title: '📊 Rapport och analys',
      description: 'Klicka på en rapport för att öppna den fullständigt beräknad — resultat, balans, moms och mer, alltid byggd direkt på din riktiga bokföring, inte en uppskattning.',
    },
  },
  {
    tab: 'taxes',
    element: '[data-tour="page-taxes-content"]',
    popover: {
      title: '🧮 Skatt och bokslut',
      description: 'Momsdeklaration, bokslut och andra viktiga datum — uträknat automatiskt utifrån din bokföring, så du alltid vet vad som gäller och när det ska in.',
    },
  },
  {
    tab: 'settings',
    element: '[data-tour="page-settings-nav"]',
    popover: {
      title: '⚙️ Inställningar',
      description: 'Företagsuppgifter, användare och prenumeration — allt samlat i den här menyn, en sektion per rad.',
    },
  },
  {
    element: '[data-tour="topbar-help"]',
    popover: {
      title: '💬 Hjälp och support',
      description: 'Ordlista, kontakt — och den här rundturen igen, när du vill se den en gång till.',
    },
  },
  {
    element: '[data-tour="topbar-profile"]',
    popover: {
      title: '👤 Ditt konto',
      description: 'Tema, fler företag att lägga till, och utloggning — allt hittar du under din avatar.',
    },
  },
  {
    popover: {
      title: 'Klart! 🎉',
      description: 'Kör igång — och hitta den här rundturen igen under Hjälp och support om du vill se den en gång till.',
    },
  },
];

function buildSteps() {
  return STEP_DEFS.filter(step => !step.element || document.querySelector(step.element));
}

/** Bygger driver-nivåns onNextClick/onPrevClick: byter fram/tillbaka till
 * målstegets `tab` (om något, t.ex. 'invoices') INNAN driver.js faktiskt
 * flyttar till det steget — annars skulle stegets `element` inte finnas i
 * DOM:et än (fel flik aktiv) och driver.js skulle rendera en tom/felaktig
 * centrerad popover istället för att peka på den riktiga knappen. `navigate`
 * är App.jsx:s egen handleNavTabChange — samma funktion ett klick i
 * sidomenyn skulle anropa, så den uppdaterar URL-hash/stänger mobilmenyn
 * precis som en riktig navigering. Anropar alltid `navigate(tab)` även om
 * den flikan råkar redan vara aktiv (ofarligt no-op) — enklare och säkrare
 * än att hålla reda på "nuvarande flik" separat i den här filen. */
function withNavigation(steps, navigate) {
  const goToStepTab = async (targetStep) => {
    if (!targetStep?.tab) return;
    navigate(targetStep.tab);
    await waitForElement(targetStep.element, 3000);
  };
  return {
    onNextClick: async (_element, _step, opts) => {
      await goToStepTab(steps[opts.index + 1]);
      opts.driver.moveNext();
    },
    onPrevClick: async (_element, _step, opts) => {
      await goToStepTab(steps[opts.index - 1]);
      opts.driver.movePrevious();
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
