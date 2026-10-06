// Tangentbordet på telefon, som i en app (installeras i App.jsx).
//
// 1. Returtangenten: "Nästa" hoppar till nästa fält i formuläret, på sista
//    fältet står "Klar" och tangentbordet stängs i stället för att formuläret
//    skickas av misstag. Sökfält får "Sök" och stänger tangentbordet.
// 2. Fältet man skriver i skrollas fram ovanför tangentbordet när det öppnas,
//    i stället för att ligga gömt bakom det eller bakom en fast knapprad.
// 3. Sifferfält (type="number") utan eget inputMode får decimaltangentbordet,
//    som beloppsfälten redan har (SimpleBookingPanel m.fl.).
//
// Bara på pekskärm under 768 px. Fält som själva tar hand om Enter (en
// öppen sökrullista som väljer med Enter, en dialog) lämnas i fred: de
// anropar preventDefault, och då gör vi ingenting.

const TEXT_TYPES = new Set(['text', 'email', 'tel', 'url', 'number', 'password', 'search', 'date', 'month', 'time', '']);

function isPhone() {
  return window.matchMedia('(max-width: 768px)').matches && window.matchMedia('(pointer: coarse)').matches;
}

function isTypingField(el) {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && TEXT_TYPES.has((el.getAttribute('type') || '').toLowerCase());
}

function isSearchField(el) {
  return el.type === 'search' || el.getAttribute('role') === 'searchbox' || !!el.closest('.lfb, .inv-search, [data-search]');
}

// Formuläret fältet hör till: helskärmsformuläret (mform), en dialog eller
// närmaste <form>. Utanför dessa rör vi inte returtangenten.
function scopeOf(el) {
  return el.closest('.mform-page, .modal-content, form') || (document.documentElement.hasAttribute('data-form') ? el.closest('.main-content-inner') : null);
}

// Fält man skriver i. Rullistor och datumfält hoppas över: de öppnas inte av
// att fokus flyttas dit, så "Nästa" hade stannat på något som inte gör något.
const PICKER_TYPES = new Set(['date', 'month', 'time']);
function fieldsIn(scope, current) {
  return [...scope.querySelectorAll('input, textarea')].filter(f => {
    if (f !== current && (f.disabled || f.readOnly || !isTypingField(f) || PICKER_TYPES.has(f.type))) return false;
    const r = f.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

function nextField(el) {
  const scope = scopeOf(el);
  if (!scope) return null;
  const all = fieldsIn(scope, el);
  const i = all.indexOf(el);
  return i >= 0 ? all[i + 1] || null : null;
}

function onFocusIn(e) {
  const el = e.target;
  if (!isTypingField(el) || !isPhone()) return;

  if (el.tagName === 'INPUT') {
    if (el.type === 'number' && !el.hasAttribute('inputmode')) el.setAttribute('inputmode', 'decimal');
    if (el.type === 'email') {
      if (!el.hasAttribute('autocapitalize')) el.setAttribute('autocapitalize', 'none');
      if (!el.hasAttribute('autocorrect')) el.setAttribute('autocorrect', 'off');
      if (!el.hasAttribute('spellcheck')) el.setAttribute('spellcheck', 'false');
    }
    // Räknas om vid varje fokus: fält kan ha tillkommit sedan sist
    // ("Fler fält"). Ett fält som själv satt enterKeyHint behåller sitt.
    if (!el.hasAttribute('enterkeyhint') || el.hasAttribute('data-kb-hint')) {
      el.setAttribute('enterkeyhint', isSearchField(el) ? 'search' : (scopeOf(el) && nextField(el) ? 'next' : 'done'));
      el.setAttribute('data-kb-hint', '');
    }
  }

  // När tangentbordet har glidit upp (iOS ~300 ms): skrolla fram fältet om
  // det ligger bakom tangentbordet eller under toppfältet.
  clearTimeout(onFocusIn.timer);
  onFocusIn.timer = setTimeout(() => {
    if (document.activeElement !== el) return;
    const vv = window.visualViewport;
    const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const r = el.getBoundingClientRect();
    if (r.bottom > visibleBottom - 12 || r.top < 64) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, 320);
}

function onKeyDown(e) {
  if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing) return;
  const el = e.target;
  if (!el || el.tagName !== 'INPUT' || !isTypingField(el) || !isPhone()) return;
  // En öppen förslagslista (konto, kund) väljer med Enter själv.
  if (el.getAttribute('aria-expanded') === 'true') return;

  if (isSearchField(el)) { el.blur(); return; }
  if (!scopeOf(el)) return;
  e.preventDefault();
  const next = nextField(el);
  if (next) next.focus();
  else el.blur();
}

export function installMobileKeyboard() {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('focusin', onFocusIn);
  // Bubblingsfasen, efter Reacts egna onKeyDown: har fältet redan tagit hand
  // om Enter (preventDefault) gör vi ingenting.
  document.addEventListener('keydown', onKeyDown);
  return () => {
    document.removeEventListener('focusin', onFocusIn);
    document.removeEventListener('keydown', onKeyDown);
  };
}
