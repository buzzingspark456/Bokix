import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Users } from '../icons';
import { AdminList, AdminRow, Pill } from './AdminList';
import { accountStage } from './UsersAdmin';
import CustomerCard from './CustomerCard';
import { Page, Loadable, Section, Stats, Stat, Card } from './ui';
import { dateTimeFormat, numberFormat } from '../../utils/intlCache';

// Översikt: först det som behöver göras, sedan siffrorna och kontona att
// hålla koll på (api/admin, resource 'overview'). Datan hämtas av
// InternalApp, som också visar antalen i menyn.

const fmtDate = (iso) => (iso ? dateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(new Date(iso)) : '—');
const kr = (n) => `${numberFormat('sv-SE', { maximumFractionDigits: 0 }).format(n || 0)} kr`;
const EVENT_LABEL = { ocr_error: 'kvittoläsning', vision_error: 'Vision', client_error: 'appkrasch', email_failed: 'mejl', email_fallback: 'avsändare', contact_email_failed: 'kontaktformulär', cron_failed: 'nattkörning', backup_failed: 'säkerhetskopia', company_mismatch: 'företagskopia', company_sync_failed: 'företagskopia' };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Det som behöver göras, i den ordning det brådskar.
function todoItems(d) {
  const items = [];
  if (d.subscriptions.atRisk > 0) {
    items.push({ tone: 'red', text: `${plural(d.subscriptions.atRisk, 'betalning', 'betalningar')} har misslyckats`, sub: 'Kontakta kunden innan kontot spärras.', tab: 'payments', action: 'Betalningar' });
  }
  if (d.errorsLastDay.total > 0) {
    const kinds = Object.entries(d.errorsLastDay.byKind).map(([k, n]) => `${n} ${EVENT_LABEL[k] || k}`).join(', ');
    items.push({ tone: 'red', text: `${plural(d.errorsLastDay.total, 'fel', 'fel')} det senaste dygnet`, sub: kinds, tab: 'system', action: 'Systemstatus' });
  }
  if (d.unhandledMessages > 0) {
    items.push({ tone: 'amber', text: `${plural(d.unhandledMessages, 'meddelande', 'meddelanden')} att svara på`, sub: 'Kontaktformuläret och Rapportera fel.', tab: 'inbox', action: 'Inkorg' });
  }
  const soon = d.trialsEnding.filter(t => t.daysLeft <= 2);
  if (soon.length > 0) {
    items.push({ tone: 'amber', text: `${plural(soon.length, 'provperiod', 'provperioder')} slutar inom två dagar`, sub: soon.map(t => t.company || t.email).join(', '), tab: 'payments', action: 'Betalningar' });
  }
  if (d.notStarted.length > 0) {
    items.push({ tone: 'blue', text: `${plural(d.notStarted.length, 'nytt konto', 'nya konton')} har inte kommit igång`, sub: 'Inget bokfört, fakturerat eller uppladdat. Listan finns längre ner.' });
  }
  return items;
}

export default function OverviewAdmin({ overview, onOpenTab }) {
  const { data: raw, error, updatedAt, refreshing, reload } = overview;
  // Ett ofullständigt svar (t.ex. en äldre server under en utrullning) ska
  // visa Hämtar…, inte krascha sidan.
  const data = raw?.accounts && raw?.subscriptions && raw?.errorsLastDay ? raw : null;
  const [openId, setOpenId] = useState(null);
  const todos = data ? todoItems(data) : [];

  return (
    <Page
      title="Översikt"
      description="Det som behöver göras i dag, och läget för konton och intäkter. Grundarnas egna konton räknas inte."
      refresh={{ updatedAt, refreshing, onRefresh: reload }}
    >
      <Loadable data={data} error={error}>
        {data && (
          <>
            <Section title="Att göra" id="ov-todo">
              <Card flush>
                {todos.length === 0 ? (
                  <div className="ix-todo"><span className="ix-ok"><CheckCircle2 size={16} /> Inget att göra just nu.</span></div>
                ) : todos.map(t => (
                  <div className="ix-todo" key={t.text}>
                    <span className={`ix-dot ${t.tone}`} aria-hidden="true" />
                    <span className="ix-todo-text"><strong>{t.text}</strong>{t.sub && <span className="ix-todo-sub">{t.sub}</span>}</span>
                    {t.tab && <button type="button" className="ix-btn quiet" onClick={() => onOpenTab(t.tab)}>{t.action} <ArrowRight size={14} /></button>}
                  </div>
                ))}
              </Card>
            </Section>

            <Section title="Konton och intäkter" id="ov-numbers">
              <Stats cols={4}>
                <Stat label="Nya konton i veckan" value={data.accounts.week} sub={`${data.accounts.today} senaste dygnet · ${data.accounts.total} totalt`} onClick={() => onOpenTab('users')} />
                <Stat label="Provperiod" value={data.subscriptions.trialing} sub={data.trialsEnding.length ? `${data.trialsEnding.length} slutar inom en vecka` : 'Ingen slutar inom en vecka'} onClick={() => onOpenTab('payments')} />
                <Stat label="Betalande" value={data.payingCount ?? data.subscriptions.active} sub={data.subscriptions.cancelingAtPeriodEnd ? `${data.subscriptions.cancelingAtPeriodEnd} avslutas vid periodens slut` : 'Ingen har sagt upp'} onClick={() => onOpenTab('payments')} />
                <Stat label="Intäkt per månad" value={data.mrr != null ? kr(data.mrr) : '—'} sub="MRR, efter rabatter" onClick={() => onOpenTab('payments')} />
              </Stats>
            </Section>

            <Section title="Konton att hålla koll på" id="ov-watch">
              <div className="ix-two">
                <AdminList title="Provperioder som slutar inom en vecka" count={data.trialsEnding.length} empty="Ingen provperiod slutar den närmaste veckan.">
                  {data.trialsEnding.map(x => (
                    <AdminRow
                      key={x.userId}
                      onClick={() => setOpenId(x.userId)}
                      initial={x.email?.[0]}
                      primary={x.company || x.email}
                      secondary={x.company ? x.email : x.plan}
                      pills={<>
                        <Pill tone={x.daysLeft <= 2 ? 'amber' : 'blue'}>{x.daysLeft === 0 ? 'Slutar i dag' : x.daysLeft === 1 ? '1 dag kvar' : `${x.daysLeft} dagar kvar`}</Pill>
                        {x.started === false && <Pill tone="amber">Inte igång</Pill>}
                      </>}
                      meta={[['Slutar', fmtDate(x.trialEndsAt)]]}
                    />
                  ))}
                </AdminList>

                <AdminList title="Nya konton som inte kommit igång" count={data.notStarted.length} empty="Alla nya konton har bokfört, fakturerat eller laddat upp något.">
                  {data.notStarted.map(x => (
                    <AdminRow
                      key={x.userId}
                      onClick={() => setOpenId(x.userId)}
                      initial={x.email?.[0]}
                      primary={x.company || x.email}
                      secondary={x.company ? x.email : 'Inget företag upplagt'}
                      pills={<SubscriptionPill status={x.status} />}
                      meta={[['Skapad', fmtDate(x.createdAt)], ['Inloggad', fmtDate(x.lastSignInAt)]]}
                    />
                  ))}
                </AdminList>
              </div>
            </Section>

            <Section title="Senaste konton" id="ov-recent" actions={<button type="button" className="ix-link" onClick={() => onOpenTab('users')}><Users size={14} /> Alla användare</button>}>
              <AdminList empty="Inga konton än.">
                {data.recentSignups.map(x => (
                  <AdminRow
                    key={x.userId}
                    onClick={() => setOpenId(x.userId)}
                    initial={x.email?.[0]}
                    primary={x.company || x.email}
                    secondary={x.company ? x.email : 'Inget företag upplagt'}
                    pills={<>
                      {(() => { const st = accountStage({ subscriptionStatus: x.status, cancelAtPeriodEnd: x.cancelAtPeriodEnd, suspended: x.suspended, emailConfirmed: x.emailConfirmed !== false, companyName: x.company }); return <Pill tone={st.tone}>{st.label}</Pill>; })()}
                      {x.started === true && <Pill tone="green">Igång</Pill>}
                      {x.started === false && <Pill tone="amber">Inte igång</Pill>}
                    </>}
                    meta={[['Skapad', fmtDate(x.createdAt)]]}
                  />
                ))}
              </AdminList>
            </Section>
          </>
        )}
      </Loadable>

      {openId && <CustomerCard userId={openId} onClose={() => setOpenId(null)} />}
    </Page>
  );
}
