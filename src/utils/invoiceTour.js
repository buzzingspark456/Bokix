// Fakturaguiden — en egen, kort rundtur (driver.js, samma bibliotek som
// utils/productTour.js) scopead till bara Fakturor-sidan. Egen fil istället
// för en gren i productTour.js: den behöver aldrig byta flik (startas redan
// stående på Fakturor-sidan — se knappen i Invoices.jsx), så den delar bara
// waitForElement härifrån importerad, inte hela stegmotorn.
//
// Kundönskemål: en genväg längst upp på Fakturor-sidan som visar hur man
// skapar en faktura och vad radmenyns olika åtgärder gör — försvinner från
// sidan efter första visningen (eller att man stänger guiden i förtid), men
// går alltid att starta om under Hjälp och support (HelpDrawer.jsx). Exakt
// samma "sedd en gång, alltid återstartbar"-mönster som den globala
// rundturen, bara med sin egen lagringsnyckel/version.
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '../styles/productTour.css';
import { waitForElement } from './productTour';

// Ökas om stegen ändras på ett sätt som gör en redan visad guide
// missvisande — se TOUR_VERSION i productTour.js för samma resonemang.
const TOUR_VERSION = 'v1';

function storageKey(uid) {
  return `bokix_invoice_tour_done_${TOUR_VERSION}_${uid}`;
}

/** true = redan sedd (eller inget känt konto att komma ihåg det på — visas
 * då hellre INTE automatiskt/kvar som knapp än att riskera en delad/
 * utloggad session). Se hasSeenTour i productTour.js för samma avvägning. */
export function hasSeenInvoiceTour(uid) {
  if (!uid) return true;
  try {
    return localStorage.getItem(storageKey(uid)) === '1';
  } catch {
    return true;
  }
}

export function markInvoiceTourSeen(uid) {
  if (!uid) return;
  try {
    localStorage.setItem(storageKey(uid), '1');
  } catch {
    // Går inte att komma ihåg — ofarligt, knappen visas bara igen.
  }
}

// data-inv-tour-attributen matchas mot attribut satta direkt i
// Invoices.jsx (flikraden, "Skapa faktura", statusmärket och radmenyn) och
// InvoiceForm (kundfältet, Avbryt-knappen) — CSS-selektorer, inte
// referenser, så den här filen aldrig behöver importera dem.
//
// De två sista raderna kräver minst en riktig faktura i listan för att
// finnas — `optional: true` filtrerar bort dem annars (se buildSteps),
// istället för att peka på ett element som aldrig dyker upp för ett
// helt nytt konto utan fakturor än.
const STEP_DEFS = [
  {
    popover: {
      title: 'Så funkar Fakturering',
      description: 'En snabb genomgång av hur du skapar och hanterar fakturor — hoppa över när du vill.',
    },
  },
  {
    element: '[data-inv-tour="tabs"]',
    popover: {
      title: 'Kundfakturor och leverantörsfakturor',
      description: 'Kundfakturor skickar du till dina egna kunder. Leverantörsfakturor är de du själv tar emot och ska betala — två separata flikar på samma sida.',
    },
  },
  {
    openSelector: '[data-inv-tour="create-cta"]',
    element: '[data-inv-tour="form-customer"]',
    closeSelector: '[data-inv-tour="form-cancel"]',
    popover: {
      title: 'Skapa en faktura',
      description: 'Välj kund och lägg till rader — moms och totalsumma räknas ut automatiskt när du sparar.',
    },
  },
  {
    element: '[data-inv-tour="row-status"]',
    optional: true,
    popover: {
      title: 'Markera som betald',
      description: 'Klicka direkt på statusmärket för att markera fakturan som betald, utan att öppna den.',
    },
  },
  {
    openSelector: '[data-inv-tour="row-menu"]',
    element: '[role="menu"]',
    closeSelector: '[data-inv-tour="row-menu"]',
    optional: true,
    popover: {
      title: 'Fler åtgärder per faktura',
      description: 'Visa faktura, Redigera, Markera som betald, Koppla till transaktion, Skapa betalningslänk, Kopiera faktura, Markera som skickad, Skicka påminnelse, Kreditera faktura och Ta bort — allt samlat i den här menyn, olika alternativ beroende på fakturans status.',
    },
  },
  {
    popover: {
      title: 'Klart',
      description: 'Hitta guiden igen under Hjälp och support, uppe till höger.',
    },
  },
];

// Bugkritiskt: ett steg med `openSelector` (t.ex. radmenyn) pekar till slut
// på ett element som INTE finns förrän openSelector klickats (menyns
// `[role="menu"]`-panel öppnas ju först då) — kollar `optional` mot just
// det elementet filtrerade därför bort steget varenda gång, oavsett om det
// fanns fakturor i listan eller inte. Kollar istället mot `openSelector`
// när det är satt (knappen som ÖPPNAR steget, redan i DOM:et om det finns
// minst en faktura) och faller tillbaka på `element` annars.
function buildSteps() {
  return STEP_DEFS.filter(step => !step.optional || document.querySelector(step.openSelector || step.element));
}

/** Går in i `step`: öppnar ev. formulär/meny (openSelector) och väntar in
 * det slutgiltiga elementet. Ingen flikväxling här (till skillnad från
 * productTour.js:s enterStep) — guiden startas alltid redan stående på
 * Fakturor-sidan. */
async function enterStep(step) {
  if (!step) return;
  if (step.openSelector) {
    await waitForElement(step.openSelector, 3000);
    document.querySelector(step.openSelector)?.click();
  }
  if (step.element) await waitForElement(step.element, 3000);
}

/** Lämnar `step`: stänger ett ev. öppnat formulär/meny (closeSelector) så
 * det inte blir kvar öppet när man går vidare, går bakåt igen, eller
 * stänger hela guiden mitt i. */
function leaveStep(step) {
  if (!step?.closeSelector) return;
  document.querySelector(step.closeSelector)?.click();
}

function withSteps(steps) {
  return {
    onNextClick: async (_element, _step, opts) => {
      leaveStep(steps[opts.index]);
      await enterStep(steps[opts.index + 1]);
      opts.driver.moveNext();
    },
    onPrevClick: async (_element, _step, opts) => {
      leaveStep(steps[opts.index]);
      await enterStep(steps[opts.index - 1]);
      opts.driver.movePrevious();
    },
    onCloseClick: (_element, _step, opts) => {
      leaveStep(steps[opts.index]);
      opts.driver.destroy();
    },
  };
}

/** Startar fakturaguiden direkt — anropas bara när Fakturor-sidan redan är
 * monterad (knappen i Invoices.jsx, eller startInvoiceTourWhenReady nedan).
 * `uid` (Supabase user.id) minns bara att kontot sett den, se
 * hasSeenInvoiceTour. `onDestroyed` — extra callback (utöver att markera
 * guiden sedd) så Invoices.jsx kan gömma sin egen genvägsknapp direkt när
 * guiden stängs, oavsett om den klickats igenom eller avbrutits i förtid. */
export function startInvoiceTour({ uid, onDestroyed } = {}) {
  const steps = buildSteps();
  if (steps.length === 0) return null;
  const nav = withSteps(steps);

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
    onDestroyed: () => { markInvoiceTourSeen(uid); onDestroyed?.(); },
  });

  driverObj.drive();
  return driverObj;
}

/** Väntar in Fakturor-sidan (samma väntemönster som
 * startProductTourWhenReady) och startar sedan — används av "Fakturaguide"
 * i Hjälp och support (App.jsx), som kan anropas från en HELT ANNAN flik. */
export async function startInvoiceTourWhenReady({ uid, onDestroyed } = {}) {
  await waitForElement('[data-inv-tour="tabs"]');
  return startInvoiceTour({ uid, onDestroyed });
}
