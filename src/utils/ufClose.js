import { supabase } from '../supabaseClient';
import { confirmDialog } from '../components/shared/ConfirmDialog';

// ── Avsluta UF-året (klientsidan). Servern gör jobbet, se api/_ufAccount.js:
// kontot blir skrivskyddat, ligger kvar i tre månader så att gruppen hinner
// ladda ner allt, och raderas sedan helt. UF omfattas inte av
// bokföringslagen, så sjuårsarkivet gäller inte här.

const DATE_FMT = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });

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
    `Kontot blir skrivskyddat direkt. Allt ligger kvar till ${deleteLabelFromNow()} så att ni hinner ladda ner bokföringen, sedan raderas kontot och all data för gott. Vill ni fortsätta med Bokix senare går det att betala när som helst innan dess.`,
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
