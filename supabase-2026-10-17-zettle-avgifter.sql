-- ══════════════════════════════════════════════════════════════════════
-- ZETTLE: AVGIFTER OCH UTBETALNINGAR (2026-10-17)
-- ══════════════════════════════════════════════════════════════════════
-- Förut hämtades bara köpen från Zettle, och de bokfördes rakt på banken
-- (1930). Kortpengarna kommer in på banken först vid utbetalningen, med
-- Zettles avgift avdragen. Nu bokförs kortköp på 1686 (fordran på Zettle)
-- och kontantköp på 1910, och nattjobbet (api/cron/reminders.js) hämtar
-- också avgifterna (summerade per dag) och utbetalningarna från Zettles
-- Finance API, som bokförs mot 1686. Samma idé som Stripe.
--
-- kind: 'purchase' (köp, som förut), 'fee' (dagens avgifter), 'payout'
-- (utbetalning till banken). zettle_purchase_uuid är fortfarande den unika
-- nyckeln: 'fee-<datum>' och 'payout-<Zettles uuid>' för de nya raderna.
--
-- Kör i Supabase → SQL Editor. Innan dess hämtas bara köpen som förut.

ALTER TABLE public.zettle_ledger_events
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'purchase';
