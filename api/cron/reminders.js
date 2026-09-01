import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { applySecurityHeaders } from '../_security.js';
import { hasResendApiKey, sendWithFallback } from '../_resend.js';
import { buildInvoiceReminderHtml, buildVatDeadlineHtml, buildAgiDeadlineHtml, buildTrialEndingHtml } from '../_emailTemplates.js';
import { nextVatDeadline, nextAgiDeadline } from '../../src/utils/declarationDeadlines.js';

// Bugkritiskt (lokal utveckling, samma orsak/fix som api/_resend.js): måste
// vara en LAT, memoiserad getter, inte en toppnivå-konstant. server.js
// importerar den här filens handler direkt (se kommentaren vid
// remindersHandler-importen där) — ES-moduler evaluerar hela importgrafen
// INNAN server.js:s egen dotenv.config() körs, så en toppnivå-läsning av
// process.env.STRIPE_SECRET_KEY här hade fångat ett tomt värde lokalt.
// Vercel-produktionen opåverkad (env-variabler finns redan satta innan
// någon modul evalueras där).
let stripeClient;
function getStripeClient() {
  if (stripeClient !== undefined) return stripeClient;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
  stripeClient = stripeSecretKey && !stripeSecretKey.startsWith('pk_')
    ? new Stripe(stripeSecretKey, {
        // apiVersion removed to use Stripe account default
      })
    : null;
  return stripeClient;
}

// Vercel Cron (vercel.json: crons) anropar den här EN gång/dag — den ENDA
// nya funktionen för hela "automatiska påminnelser"-funktionen (Vercels
// 12-funktionsgräns, Hobby-plan, redan på 11/12 efter api/company-access.js
// — se filkommentaren där). Hanterar därför FEM olika sorters påminnelser/
// underlag i en enda körning istället för fem separata cron-endpoints:
//   1) Fakturapåminnelse till KUNDEN, N dagar efter förfallodatum
//   2) Momsdeklarations-deadline till FÖRETAGET, N dagar innan
//   3) AGI-deadline till FÖRETAGET, N dagar innan
//   4) Trial-slut-påminnelse till KONTOT, N dagar innan kortet dras
//   5) Stripe-bokföringsunderlag från KUNDENS anslutna Stripe-konto
//      (betalningar/utbetalningar/avgifter, se stripe_ledger_events i
//      supabase-setup.sql och ReviewQueue.jsx för resten av flödet)
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
// (Punkt 4 och 5 ovan är INTE med i den begränsningen — de läser
// public.subscriptions/public.stripe_ledger_events, riktiga SQL-tabeller
// med riktade frågor, inte user_data-blobben.)
const DEFAULT_NOTIFICATIONS = { enabled: true, invoiceReminderDays: 3, declarationReminderDays: 7, agiRemindersSent: {} };
const SITE_URL = 'https://www.bokix.se';
// Kundrapporterad brist: ingen påminnelse skickades innan kortet drogs
// första gången efter provperioden — se TermsPolicy.jsx/PaymentRequiredGate.
// jsx ("30 dagar gratis, avsluta innan dess så kostar det ingenting"), ett
// löfte som kräver att kunden FAKTISKT hinner få veta att tiden går ut.
const TRIAL_REMINDER_DAYS_BEFORE = 3;

// Skalningsskydd (kodgranskning): user_data-genomsökningen längre ner gör en
// riktig avvaktad nätverksbegäran (Resend, Stripe) per företag som faktiskt
// har något att påminna om — med tillräckligt många aktiva företag samma
// dag kan EN daglig körning i teorin ta längre än funktionens exekverings-
// gräns, oavsett vilken den faktiskt är (Vercel höjde nyligen Hobby-planens
// standardgräns rejält med Fluid compute, men den här filen kan inte läsa av
// projektets faktiska inställning, och en felaktigt optimistisk gissning här
// är värre än en för försiktig — se checkpoint-resonemanget nedan). Satt
// medvetet lågt med bred marginal, inte som en gissning på plattformens
// exakta gräns: konsekvensen av att stanna för tidigt är bara att en
// fullständig genomsökning sprids ut över fler dagars körningar (se
// cron_progress i supabase-setup.sql), aldrig ett avbrutet skriv-anrop.
const TIME_BUDGET_MS = 8000;

const grossOf = (inv) => inv.rows?.reduce((a, r) => a + r.qty * r.unitPrice * (1 + r.vatRate / 100), 0) || inv.amount || 0;
const daysBetween = (a, b) => Math.round((a - b) / 86400000);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function handler(req, res) {
  const startTime = Date.now();
  applySecurityHeaders(res);

  // Delad hemlighet, inte requireAuthedUser — en cron-körning har ingen
  // mänsklig inloggad session. Vercel skickar automatiskt
  // `Authorization: Bearer $CRON_SECRET` på sina egna schemalagda anrop så
  // fort miljövariabeln finns satt i projektet; samma header går att sätta
  // manuellt för att trigga/testa körningen (se README-verifieringssteg).
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'] || '';
  // Säkerhetsgranskningen: `!==` på en hemlighet är en icke-konstant-tids-
  // jämförelse (returnerar vid FÖRSTA avvikande tecknet) — teoretiskt
  // läcker det via svarstiden hur många tecken av CRON_SECRET som redan
  // stämmer. Bytt till crypto.timingSafeEqual, samma mönster som
  // _signedToken.js:s signaturjämförelse redan använder. Längdkollen
  // (Buffer.byteLength) FÅR göras icke-konstant — bara innehållet, inte
  // längden, är det som ska vara svårt att sidokanalsläsa ut.
  const expectedHeader = `Bearer ${expectedSecret || ''}`;
  const expectedBuf = Buffer.from(expectedHeader);
  const actualBuf = Buffer.from(authHeader);
  const authorized = !!expectedSecret
    && expectedBuf.length === actualBuf.length
    && crypto.timingSafeEqual(expectedBuf, actualBuf);
  if (!authorized) {
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

  const summary = { dryRun, usersScanned: 0, invoiceReminders: 0, vatReminders: 0, agiReminders: 0, trialReminders: 0, stripeLedgerEvents: 0, errors: [], wouldSend: [] };

  try {
    const today = startOfToday();

    // ── 4) Trial-slut-påminnelse till KONTOT ── körs FÖRST och separat
    // från user_data-genomsökningen nedan — public.subscriptions är en
    // riktig tabell, ingen anledning att vänta på/blanda ihop med
    // JSONB-scanningen. is('trial_reminder_sent_at', null) är dedup-
    // markören (supabase-setup.sql) — utan den skulle "daysLeft <=" (robust
    // mot ett missat cron-pass, se samma resonemang för moms/AGI nedan)
    // skicka om mejlet varje dag ända fram till att provperioden tar slut.
    try {
      const { data: trialRows, error: trialError } = await admin
        .from('subscriptions')
        .select('id, user_id, trial_ends_at')
        .eq('status', 'trialing')
        .is('trial_reminder_sent_at', null)
        .not('trial_ends_at', 'is', null);
      if (trialError) throw trialError;

      for (const row of trialRows || []) {
        const daysLeft = daysBetween(new Date(row.trial_ends_at), today);
        if (daysLeft > TRIAL_REMINDER_DAYS_BEFORE || daysLeft < 0) continue;

        try {
          if (dryRun) {
            summary.wouldSend.push({ type: 'trial', userId: row.user_id, trialEndsAt: row.trial_ends_at, daysLeft });
            summary.trialReminders += 1;
            continue;
          }
          // E-postadressen finns bara i auth.users, inte i user_data/
          // subscriptions — samma admin-klient (service-role) som redan
          // används här, GoTrue-admin-uppslag istället för en egen kopia av
          // kontots e-post i subscriptions-tabellen.
          const { data: authUserData, error: authError } = await admin.auth.admin.getUserById(row.user_id);
          const recipient = authUserData?.user?.email;
          if (authError || !recipient) {
            summary.errors.push(`trial ${row.user_id}: kunde inte slå upp kontots e-postadress`);
            continue;
          }

          const html = buildTrialEndingHtml({ trialEndsAt: row.trial_ends_at, siteUrl: SITE_URL });
          const result = await sendWithFallback({
            to: [recipient],
            subject: 'Din provperiod hos Bokix går snart ut',
            html,
          });
          if (!result.ok) throw new Error(result.data?.message || 'Resend-fel');

          const { error: markError } = await admin
            .from('subscriptions')
            .update({ trial_reminder_sent_at: new Date().toISOString() })
            .eq('id', row.id);
          if (markError) throw markError;

          summary.trialReminders += 1;
        } catch (err) {
          summary.errors.push(`trial ${row.user_id}: ${err.message}`);
        }
      }
    } catch (err) {
      summary.errors.push(`trial scan: ${err.message}`);
    }
    // Sidindelad hämtning, inte ett enda .select() — PostgREST (Supabase)
    // begränsar tyst ett oavgränsat svar till projektets "max rows"
    // (default 1000). Utan detta skulle cronen efter ~1000 rader i
    // user_data sluta se resten av användarna helt tyst, trots
    // kommentaren ovan om "fullständig genomsökning" — och ingen error
    // hade avslöjat det.
    //
    // Checkpoint (se cron_progress i supabase-setup.sql och TIME_BUDGET_MS
    // ovan): fortsätter från senast FÄRDIGBEHANDLADE user_id i stället för
    // att alltid börja om från början — annars skulle en körning som tar
    // slut på tid varje dag bara hinna med samma första sida användare i
    // user_id-ordning, och resten skulle aldrig någonsin nås. Sidan/raden
    // hämtas OCH bearbetas varvat (inte "hämta allt, bearbeta sen") så att
    // tidsbudgeten också täcker själva hämtningen för en väldigt stor
    // tabell, inte bara e-postutskicken.
    const PAGE_SIZE = 1000;
    const { data: progressRow, error: progressError } = await admin
      .from('cron_progress')
      .select('cursor_value')
      .eq('id', 'reminders')
      .maybeSingle();
    if (progressError) summary.errors.push(`cron_progress läsning: ${progressError.message}`);
    const cursor = progressRow?.cursor_value || null;

    let lastCompletedUserId = cursor;
    let completedFullPass = true;

    pageLoop:
    for (let from = 0; ; from += PAGE_SIZE) {
      if (Date.now() - startTime > TIME_BUDGET_MS) { completedFullPass = false; break; }

      let pageQuery = admin
        .from('user_data')
        .select('user_id, state')
        .not('state', 'is', null)
        .order('user_id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (cursor) pageQuery = pageQuery.gt('user_id', cursor);

      const { data: page, error: pageError } = await pageQuery;
      if (pageError) throw pageError;
      if (!page || page.length === 0) break;

      for (const row of page) {
        if (Date.now() - startTime > TIME_BUDGET_MS) { completedFullPass = false; break pageLoop; }
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

          // ── 5) Stripe-bokföringsunderlag från kundens anslutna konto ──
          // Skriver till EN EGEN tabell (stripe_ledger_events), inte via
          // changedFields/set_company_field nedan som resten av loopen — se
          // filkommentaren i supabase-setup.sql för varför (samma "aldrig
          // rakt in i user_data.state"-skäl som stripe_payment_events/
          // subscriptions). Aldrig auto-bokfört: ReviewQueue.jsx föreslår en
          // kontering som användaren själv godkänner.
          const stripeAccountId = companyData.company?.stripeAccountId;
          const stripe = getStripeClient();
          if (stripe && stripeAccountId) {
            try {
              // Samma överlappande fönster-princip som trial-påminnelsen
              // ovan (robust mot ett missat cron-pass) — UNIQUE(stripe_
              // balance_transaction_id) + ignoreDuplicates gör en omkörning
              // av samma dagar ofarlig.
              const lookbackSeconds = 4 * 86400;
              const createdAfter = Math.floor(Date.now() / 1000) - lookbackSeconds;
              const balanceTxns = await stripe.balanceTransactions.list(
                { limit: 100, created: { gte: createdAfter } },
                { stripeAccount: stripeAccountId }
              );

              if (balanceTxns.data.length > 0) {
                // Kandidater att matcha CHARGE-poster (en kunds
                // fakturabetalning som landar direkt på kundens eget
                // Stripe-saldo, se create-checkout-session.js:s "direct
                // charge"-kommentar) mot Bokix EGNA loggade
                // fakturabetalningar, samma fönster. Bästa-försök-matchning
                // på tidsnärhet (±15 min), INTE en garanterad metadata-
                // koppling: balanceTransactions.list() bär inte igenom
                // Checkout-sessionens egen metadata (invoice_id). Ofarligt
                // att gissa fel här — raden hamnar bara som ett FÖRSLAG i
                // ReviewQueue.jsx, aldrig auto-bokfört.
                //
                // Var tidigare bt.type === 'transfer' (destination-charge-
                // modellen, se git-historiken) — en direct charge dyker
                // istället upp som 'charge' på det ANSLUTNA kontots eget
                // saldo, med bt.fee redan satt till summan av Stripes EGEN
                // avgift + Bokix application_fee (inget att gissa fram via
                // en belopps-mellanskillnad längre). Bokix egen andel bryts
                // ut separat ur fee_details (type 'application_fee') istället
                // för hela bt.fee, så platform_fee_amount fortsätter betyda
                // "bara Bokix andel", inte Stripes också.
                const { data: paymentEvents } = await admin
                  .from('stripe_payment_events')
                  .select('invoice_id, amount_total, paid_at')
                  .eq('user_id', row.user_id)
                  .eq('company_id', companyId)
                  .gte('paid_at', new Date(createdAfter * 1000).toISOString());
                const unmatchedEvents = [...(paymentEvents || [])];
                const MATCH_WINDOW_MS = 15 * 60 * 1000;

                const toInsert = balanceTxns.data.map(bt => {
                  let matchedInvoiceId = null;
                  let platformFeeAmount = null;
                  if (bt.type === 'charge' && bt.currency === 'sek') {
                    const btCreatedMs = bt.created * 1000;
                    let bestIdx = -1, bestDiff = Infinity;
                    unmatchedEvents.forEach((ev, idx) => {
                      const diff = Math.abs(new Date(ev.paid_at).getTime() - btCreatedMs);
                      if (diff < MATCH_WINDOW_MS && diff < bestDiff) { bestDiff = diff; bestIdx = idx; }
                    });
                    if (bestIdx !== -1) {
                      const ev = unmatchedEvents.splice(bestIdx, 1)[0];
                      matchedInvoiceId = ev.invoice_id;
                      // Bokix egen andel, direkt ur Stripes fee_details —
                      // se filkommentaren i supabase-setup.sql. Bara sparad
                      // om positiv (annars inget att bokföra).
                      const applicationFeeEntry = (bt.fee_details || []).find(fd => fd.type === 'application_fee');
                      const feeAmount = applicationFeeEntry ? applicationFeeEntry.amount / 100 : 0;
                      if (feeAmount > 0) platformFeeAmount = feeAmount;
                    }
                  }

                  return {
                    user_id: row.user_id,
                    company_id: companyId,
                    stripe_account_id: stripeAccountId,
                    stripe_balance_transaction_id: bt.id,
                    type: bt.type,
                    amount: bt.amount / 100,
                    fee: bt.fee / 100,
                    currency: bt.currency,
                    description: bt.description || null,
                    source_id: typeof bt.source === 'string' ? bt.source : (bt.source?.id || null),
                    created_at_stripe: new Date(bt.created * 1000).toISOString(),
                    matched_invoice_id: matchedInvoiceId,
                    platform_fee_amount: platformFeeAmount,
                  };
                });

                if (dryRun) {
                  summary.wouldSend.push({ type: 'stripe_ledger', companyId, count: toInsert.length });
                  summary.stripeLedgerEvents += toInsert.length;
                } else {
                  // ignoreDuplicates → INSERT ... ON CONFLICT DO NOTHING: en
                  // redan loggad (och kanske redan granskad/bokförd) rad ska
                  // ALDRIG skrivas över av en omkörning av samma dagar.
                  const { error: insertError } = await admin
                    .from('stripe_ledger_events')
                    .upsert(toInsert, { onConflict: 'stripe_balance_transaction_id', ignoreDuplicates: true });
                  if (insertError) throw insertError;
                  summary.stripeLedgerEvents += toInsert.length;
                }
              }
            } catch (err) {
              summary.errors.push(`stripe ledger ${companyId}: ${err.message}`);
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

        // Den här ANVÄNDAREN (alla dess företag) är nu helt klar — flyttar
        // checkpointen hit, inte vid varje enskilt fält, så en tidsbudget som
        // tar slut MITT I en användares företagslista aldrig lämnar den
        // användaren halvbehandlad över ett cron-pass till nästa: nästa
        // körnings `.gt('user_id', cursor)` börjar om just den användaren
        // från noll (idempotent — remindersSent-markörerna ovan gör redan
        // utskickade påminnelser till ett billigt no-op, aldrig ett dubbelt
        // mejl).
        lastCompletedUserId = row.user_id;
      }

      if (page.length < PAGE_SIZE) break;
    }

    // completedFullPass: hela user_data hann genomsökas den här körningen
    // (ingen tidsbudget-avbrytning ovan) — nollställ checkpointen så NÄSTA
    // körning börjar om från början igen i stället för att stå still för
    // evigt på det sista user_id:t. Annars (avbruten av TIME_BUDGET_MS):
    // spara var vi kom, så nästa körning fortsätter därifrån.
    if (!dryRun) {
      const { error: checkpointError } = await admin
        .from('cron_progress')
        .upsert({ id: 'reminders', cursor_value: completedFullPass ? null : lastCompletedUserId, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (checkpointError) summary.errors.push(`cron_progress skrivning: ${checkpointError.message}`);
    }
    summary.truncatedByTimeBudget = !completedFullPass;
    if (!completedFullPass) summary.resumeFrom = lastCompletedUserId;

    res.status(200).json(summary);
  } catch (error) {
    console.error('Cron reminders error:', error);
    res.status(500).json({ error: error?.message || 'Cron-körningen misslyckades.', partialSummary: summary });
  }
}
