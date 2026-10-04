-- ══════════════════════════════════════════════════════════════════════
-- E-POSTINKORG: GODKÄNDA AVSÄNDARE (2026-10-04, efter inkorg-filen)
-- ══════════════════════════════════════════════════════════════════════
-- Valfri lista per adress. Tom = alla kan skicka (som förut). Med en lista
-- tas bara mejl emot från de adresserna eller domänerna (t.ex. "@telia.se").
-- Det senast stoppade mejlet sparas så att det syns i appen. Säkert att köra
-- flera gånger.

ALTER TABLE public.inbox_addresses ADD COLUMN IF NOT EXISTS allowed_senders text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.inbox_addresses ADD COLUMN IF NOT EXISTS last_blocked_from text;
ALTER TABLE public.inbox_addresses ADD COLUMN IF NOT EXISTS last_blocked_at timestamptz;
