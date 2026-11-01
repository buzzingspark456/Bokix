import { supabase } from '../supabaseClient';
import { confirmDialog } from '../components/shared/ConfirmDialog';
import { dateLocale } from '../i18n';
import { dateTimeFormat } from './intlCache';

// ── Avsluta UF-året (klientsidan). Servern gör jobbet, se api/_ufAccount.js:
// kontot blir skrivskyddat, ligger kvar i tre månader så att gruppen hinner
// ladda ner allt, och stängs sedan. Bokföringen och underlagen sparas ändå i
// sju år i arkivet, som Skatteverket kräver även för UF-företag.

const DATE_FMT = dateTimeFormat(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

/** Avslutat? Läser app_metadata, som bara servern kan skriva. */
export function ufClosedInfo(user) {
  const meta = user?.app_metadata || {};
  if (!meta.uf_closed_at || !meta.uf_delete_after) return null;
  const deleteAfter = new Date(`${meta.uf_delete_after}T12:00:00`);
  return {
    closedAt: meta.uf_closed_at,
    deleteAfter: meta.uf_delete_after,
    deleteLabel: Number.isNaN(deleteAfter.getTime()) ? meta.uf_delete_after : DATE_FMT.format(deleteAfter),
  };
}

/**
 * Väljer gruppen inget stängs kontot sex månader efter att gratisperioden
 * (registreringen + tre månader) tog slut, aldrig tidigare än en vecka efter
 * sista varningsmejlet. Samma uträkning som ufAutoCloseDate i
 * api/_ufAccount.js. Returnerar text, eller null om det inte går att räkna.
 */
export function ufAutoCloseLabel(user) {
  const created = new Date(user?.created_at);
  if (Number.isNaN(created.getTime())) return null;
  const d = new Date(created.getTime());
  d.setMonth(d.getMonth() + 3 + 6);
  let iso = d.toISOString().slice(0, 10);
  const notBefore = user?.app_metadata?.uf_close_not_before;
  if (notBefore && notBefore > iso) iso = notBefore;
  return DATE_FMT.format(new Date(`${iso}T12:00:00`));
}

/** Datumet tre månader fram, som text, för bekräftelsedialogen. */
function deleteLabelFromNow() {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return DATE_FMT.format(d);
}

/**
 * Frågar först, avslutar sedan. Returnerar { deleteAfter, deleteLabel } när
 * det är klart, null om användaren ångrade sig. Kastar vid fel, med ett
 * meddelande som går att visa rakt av.
 */
export async function closeUfYear() {
  const ok = await confirmDialog(
    `Kontot blir skrivskyddat direkt. Ni kan logga in och ladda ner allt till ${deleteLabelFromNow()}, sedan stängs kontot. Bokföringen och underlagen sparas ändå i sju år, som Skatteverket kräver, och kan begäras ut via bokixab@gmail.com. Vill ni fortsätta med Bokix går det att betala när som helst innan dess.`,
    { title: 'Avsluta UF-året?', confirmLabel: 'Avsluta UF-året', cancelLabel: 'Inte nu', danger: true },
  );
  if (!ok) return null;

  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Du behöver logga in igen.');
  const res = await fetch('/api/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action: 'uf_close' }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Kunde inte avsluta just nu. Försök igen om en stund.');

  // Ny token så att app_metadata (uf_closed_at) syns direkt, både för appen
  // och för databasens spärr.
  await supabase.auth.refreshSession().catch(() => {});
  const d = new Date(`${json.deleteAfter}T12:00:00`);
  return { deleteAfter: json.deleteAfter, deleteLabel: Number.isNaN(d.getTime()) ? json.deleteAfter : DATE_FMT.format(d) };
}
