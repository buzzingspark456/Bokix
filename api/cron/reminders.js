import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../_security.js';
import { hasResendApiKey, sendWithFallback } from '../_resend.js';
import { buildInvoiceReminderHtml, buildVatDeadlineHtml, buildAgiDeadlineHtml } from '../_emailTemplates.js';
import { nextVatDeadline, nextAgiDeadline } from '../../src/utils/declarationDeadlines.js';

// Vercel Cron (vercel.json: crons) anropar den här EN gång/dag — den ENDA
// nya funktionen för hela "automatiska påminnelser"-funktionen (Vercels
// 12-funktionsgräns, Hobby-plan, redan på 11/12 efter api/company-access.js
// — se filkommentaren där). Hanterar därför TRE olika sorters påminnelser
// i en enda körning istället för tre separata cron-endpoints:
//   1) Fakturapåminnelse till KUNDEN, N dagar efter förfallodatum
//   2) Momsdeklarations-deadline till FÖRETAGET, N dagar innan
//   3) AGI-deadline till FÖRETAGET, N dagar innan
//
// Ingen SQL-tabell med enskilda fakturor finns (allt ligger i user_data.
// state, en JSONB-blob per användare) — det går alltså INTE att göra en
// riktad "WHERE dueDate = ..."-fråga. Den här funktionen läser istället
// VARJE users hela state (service-role, kringgår RLS med avsikt — det är
// en betrodd serverprocess, ingen mänsklig anropare) och letar i JS.
// Fullständig genomsökning på varje körning, en gång om dagen — helt rimligt
// för en liten/medelstor kundbas, men skalar INTE till tiotusentals företag
// med hundratals fakturor vardera. Om det blir aktuellt: bygg om till en
// egen, indexerad "påminnelser att skicka"-tabell istället för att gissa i
// förväg — se plan-diskussionen för samma resonemang.
const DEFAULT_NOTIFICATIONS = { enabled: true, invoiceReminderDays: 3, declarationReminderDays: 7, agiRemindersSent: {} };
const SITE_URL = 'https://www.bokix.se';

const grossOf = (inv) => inv.rows?.reduce((a, r) => a + r.qty * r.unitPrice * (1 + r.vatRate / 100), 0) || inv.amount || 0;
const daysBetween = (a, b) => Math.round((a - b) / 86400000);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function handler(req, res) {
  applySecurityHeaders(res);

  // Delad hemlighet, inte requireAuthedUser — en cron-körning har ingen
  // mänsklig inloggad session. Vercel skickar automatiskt
  // `Authorization: Bearer $CRON_SECRET` på sina egna schemalagda anrop så
  // fort miljövariabeln finns satt i projektet; samma header går att sätta
  // manuellt för att trigga/testa körningen (se README-verifieringssteg).
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'] || '';
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!hasResendApiKey()) {
    res.status(503).json({ error: 'RESEND_API_KEY saknas — kan inte skicka påminnelser.' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY saknas.' });
    return;
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Dry run: ?dryRun=true — beräknar EXAKT samma sak (vilka påminnelser som
  // skulle skickas idag) men skickar aldrig något riktigt mejl via Resend
  // och skriver aldrig tillbaka några remindersSent-markörer. Enda säkra
  // sättet att verifiera att den här endpointen faktiskt fungerar utan
  // risk att mejla en riktig kund — se `summary.wouldSend` för vad en
  // skarp körning skulle ha gjort.
  const dryRun = req.query?.dryRun === 'true' || req.query?.dryRun === '1';

  const summary = { dryRun, usersScanned: 0, invoiceReminders: 0, vatReminders: 0, agiReminders: 0, errors: [], wouldSend: [] };

  try {
    // Sidindelad hämtning, inte ett enda .select() — PostgREST (Supabase)
    // begränsar tyst ett oavgränsat svar till projektets "max rows"
    // (default 1000). Utan detta skulle cronen efter ~1000 rader i
    // user_data sluta se resten av användarna helt tyst, trots
    // kommentaren ovan om "fullständig genomsökning" — och ingen error
    // hade avslöjat det.
    const PAGE_SIZE = 1000;
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data: page, error: pageError } = await admin
        .from('user_data')
        .select('user_id, state')
        .not('state', 'is', null)
        .range(from, from + PAGE_SIZE - 1);
      if (pageError) throw pageError;
      rows.push(...(page || []));
      if (!page || page.length < PAGE_SIZE) break;
    }

    const today = startOfToday();

    for (const row of rows || []) {
      summary.usersScanned += 1;
      const companies = row.state?.companies || {};

      for (const [companyId, companyData] of Object.entries(companies)) {
        const notif = { ...DEFAULT_NOTIFICATIONS, ...(companyData.company?.notifications || {}) };
        if (!notif.enabled) continue;

        // Samlar vad som FAKTISKT ändrades för DEN HÄR companyn så bara
        // ändrade fält skrivs tillbaka (set_company_field, ett fält i
        // taget) — aldrig ett helblobs-upsert från cronen.
        const changedFields = new Set();

        // ── 1) Fakturapåminnelser till kunden ──
        const invoices = Array.isArray(companyData.invoices) ? companyData.invoices : [];
        for (const inv of invoices) {
          if (inv.status === 'paid' || inv.status === 'draft' || !inv.dueDate) continue;
          const daysOverdue = daysBetween(today, new Date(`${inv.dueDate}T00:00:00`));
          if (daysOverdue < notif.invoiceReminderDays) continue;

          const marker = `overdue_${notif.invoiceReminderDays}d`;
          if (inv.remindersSent?.includes(marker)) continue;

          const customer = (companyData.contacts || []).find(c => c.id === inv.customerId);
          if (!customer?.email) continue;

          try {
            if (dryRun) {
              summary.wouldSend.push({ type: 'invoice', companyId, to: customer.email, invoiceNumber: inv.invoiceNumber, daysOverdue });
              summary.invoiceReminders += 1;
              continue;
            }
            const remainingDue = Math.max(0, grossOf(inv) - (inv.paidAmount || 0));
            const html = buildInvoiceReminderHtml({ invoice: inv, customer, company: companyData.company, grossAmount: remainingDue });
            const result = await sendWithFallback({
              to: [customer.email],
              subject: `Betalningspåminnelse – faktura ${inv.invoiceNumber}`,
              html,
            }, companyData.company);
            if (!result.ok) throw new Error(result.data?.message || 'Resend-fel');

            inv.remindersSent = [...(inv.remindersSent || []), marker];
            changedFields.add('invoices');
            summary.invoiceReminders += 1;
          } catch (err) {
            summary.errors.push(`invoice ${inv.id} (${companyId}): ${err.message}`);
          }
        }

        // ── 2) Momsdeklarations-deadline till företaget ──
        // "<=" (inte "===") av samma skäl som fakturapåminnelsen ovan: ett
        // enda missat cron-pass (deploy-fönster, kall start, avbrott) skulle
        // annars göra att daysLeft aldrig träffar exakt N igen för den här
        // perioden och påminnelsen uteblir helt. remindersSent-markören
        // nedan gör ändå att den bara skickas EN gång per period.
        const vatDeadline = nextVatDeadline(companyData.company, companyData.vatPeriods || {});
        if (vatDeadline && vatDeadline.daysLeft <= notif.declarationReminderDays) {
          const periodKey = `${vatDeadline.year}-Q${vatDeadline.quarter}`;
          const period = (companyData.vatPeriods || {})[periodKey] || {};
          const marker = `deadline_${notif.declarationReminderDays}d`;
          const recipient = companyData.company?.email;
          if (!period.remindersSent?.includes(marker) && recipient) {
            try {
              if (dryRun) {
                summary.wouldSend.push({ type: 'vat', companyId, to: recipient, quarter: vatDeadline.quarter, year: vatDeadline.year, daysLeft: vatDeadline.daysLeft });
                summary.vatReminders += 1;
              } else {
                const html = buildVatDeadlineHtml({ company: companyData.company, deadline: vatDeadline, siteUrl: SITE_URL });
                const result = await sendWithFallback({
                  to: [recipient],
                  subject: `Påminnelse: momsdeklaration kvartal ${vatDeadline.quarter} ska in ${vatDeadline.dueDate.toLocaleDateString('sv-SE')}`,
                  html,
                }, companyData.company);
                if (!result.ok) throw new Error(result.data?.message || 'Resend-fel');

                companyData.vatPeriods = { ...(companyData.vatPeriods || {}), [periodKey]: { ...period, remindersSent: [...(period.remindersSent || []), marker] } };
                changedFields.add('vatPeriods');
                summary.vatReminders += 1;
              }
            } catch (err) {
              summary.errors.push(`vat ${companyId}: ${err.message}`);
            }
          }
        }

        // ── 3) AGI-deadline till företaget ──
        if (Array.isArray(companyData.employees) && companyData.employees.length > 0) {
          const agiDeadline = nextAgiDeadline(today);
          // Samma "<=" istället för "===" som för momsdeadlinen ovan, och
          // av samma skäl — robust mot ett missat cron-pass.
          if (agiDeadline.daysLeft <= notif.declarationReminderDays) {
            const marker = `deadline_${notif.declarationReminderDays}d`;
            const sentForPeriod = notif.agiRemindersSent?.[agiDeadline.periodKey] || [];
            const recipient = companyData.company?.email;
            if (!sentForPeriod.includes(marker) && recipient) {
              try {
                if (dryRun) {
                  summary.wouldSend.push({ type: 'agi', companyId, to: recipient, periodKey: agiDeadline.periodKey, daysLeft: agiDeadline.daysLeft });
                  summary.agiReminders += 1;
                } else {
                  const html = buildAgiDeadlineHtml({ company: companyData.company, deadline: agiDeadline, siteUrl: SITE_URL });
                  const result = await sendWithFallback({
                    to: [recipient],
                    subject: `Påminnelse: AGI för ${agiDeadline.periodKey} ska in ${agiDeadline.dueDate.toLocaleDateString('sv-SE')}`,
                    html,
                  }, companyData.company);
                  if (!result.ok) throw new Error(result.data?.message || 'Resend-fel');

                  companyData.company = {
                    ...companyData.company,
                    notifications: {
                      ...notif,
                      agiRemindersSent: { ...notif.agiRemindersSent, [agiDeadline.periodKey]: [...sentForPeriod, marker] },
                    },
                  };
                  changedFields.add('company');
                  summary.agiReminders += 1;
                }
              } catch (err) {
                summary.errors.push(`agi ${companyId}: ${err.message}`);
              }
            }
          }
        }

        // ── Skriv tillbaka bara det som faktiskt ändrades, ett fält i
        // taget via set_company_field (samma funktion som
        // api/company-access.js använder för en delad editors ändringar) —
        // aldrig ett helblobs-upsert från cronen. changedFields är redan
        // tomt vid dryRun (ingen av grenarna ovan lägger till något då),
        // men loopen skyddas explicit ändå — försvar i djupled, inte
        // enbart beroende av att inget hamnade i setet. ──
        if (dryRun) continue;
        for (const field of changedFields) {
          const { error: rpcError } = await admin.rpc('set_company_field', {
            p_user_id: row.user_id,
            p_company_id: companyId,
            p_field: field,
            p_value: companyData[field],
          });
          if (rpcError) summary.errors.push(`set_company_field ${field} (${companyId}): ${rpcError.message}`);
        }
      }
    }

    res.status(200).json(summary);
  } catch (error) {
    console.error('Cron reminders error:', error);
    res.status(500).json({ error: error?.message || 'Cron-körningen misslyckades.', partialSummary: summary });
  }
}
