import React from 'react';
import { ExternalLink } from '../icons';
import { Page, Section, Stats, Stat, Notice } from './ui';
import { AdminList, AdminRow, Pill } from './AdminList';
import { RULES, RULE_AREAS, nextCheck, ruleStatus } from '../../utils/rulesRegistry';
import { dateTimeFormat } from '../../utils/intlCache';

// Regler: allt Bokix räknar med (src/utils/rulesRegistry.js), med källa,
// senaste kontroll och nästa. Värdena kommer från samma konstanter som
// beräkningarna, så det som står här är det appen faktiskt använder.
// Kontrollera mot källan och uppdatera verifiedAt i filen.

const fmt = (iso) => (iso ? dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—');
const STATUS = {
  overdue: ['red', 'Kontrollen är försenad'],
  ending: ['amber', 'Upphör snart'],
  soon: ['amber', 'Kontrollera snart'],
  ok: ['green', 'Kontrollerad'],
};

export default function RulesAdmin() {
  const today = new Date();
  const withStatus = RULES.map(r => ({ ...r, status: ruleStatus(r, today), next: nextCheck(r) }));
  const count = (s) => withStatus.filter(r => r.status === s).length;
  const attention = count('overdue') + count('ending') + count('soon');

  return (
    <Page
      title="Regler"
      description="Allt Bokix räknar med: momssatser, avgifter, avdrag och filformat. Varje rad har en källa och ett datum för nästa kontroll."
    >
      {count('overdue') > 0 && (
        <Notice tone="red">{count('overdue')} regler har passerat sitt kontrolldatum. Öppna källan, jämför och uppdatera verifiedAt i src/utils/rulesRegistry.js.</Notice>
      )}
      <Section>
        <Stats cols={4}>
          <Stat label="Regler" value={RULES.length} />
          <Stat label="Kontrollerade" value={count('ok')} />
          <Stat label="Behöver ses över" value={attention} tone={attention ? 'amber' : undefined} />
          <Stat label="Försenade" value={count('overdue')} tone={count('overdue') ? 'red' : undefined} />
        </Stats>
      </Section>

      {RULE_AREAS.map(area => {
        const rows = withStatus.filter(r => r.area === area);
        if (!rows.length) return null;
        return (
          <Section key={area} title={area} note={`${rows.length} st`}>
            <AdminList>
              {rows.map(r => {
                const [tone, label] = STATUS[r.status];
                return (
                  <AdminRow
                    key={r.id}
                    onClick={() => window.open(r.source.url, '_blank', 'noopener,noreferrer')}
                    primary={r.title}
                    secondary={`${r.value} · ${r.usedIn}`}
                    pills={<>
                      <Pill tone={tone}>{label}</Pill>
                      {r.validTo && <Pill tone="blue">Gäller till {fmt(r.validTo)}</Pill>}
                    </>}
                    meta={[['Kontrollerad', fmt(r.verifiedAt)], ['Nästa', fmt(r.next)], [null, <span key="src" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{r.source.name} <ExternalLink size={12} /></span>]]}
                  />
                );
              })}
            </AdminList>
          </Section>
        );
      })}
    </Page>
  );
}
