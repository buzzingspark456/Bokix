-- ══════════════════════════════════════════════════════════════════════
-- E-POSTINKORG FÖR UNDERLAG (2026-10-04)
-- ══════════════════════════════════════════════════════════════════════
-- Varje företag får en egen adress (t.ex. bokixab-k29fq7@inbox.bokix.se).
-- Mejl dit tas emot av Resend, som anropar api/inbox/email.js. Bilagorna
-- (PDF och bilder) sparas i bokix-uploads under ägarens mapp och läggs som
-- rader i inbox_items. Appen (App.jsx) hämtar nya rader för det aktiva
-- företaget och lägger dem i Kvitton som "Ej hanterade", precis som en
-- uppladdning. Säkert att köra flera gånger.

CREATE TABLE IF NOT EXISTS public.inbox_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id text NOT NULL,              -- nyckel inuti state.companies
  token text NOT NULL UNIQUE,            -- delen före @ i adressen
  last_received_at timestamptz,          -- senaste mejlet, för "Vi har tagit emot mejl"
  gmail_confirmation_code text,          -- Gmails bekräftelsekod vid vidarebefordran
  gmail_confirmation_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, company_id)
);
-- Bara servern (service role) läser och skriver adresserna.
ALTER TABLE public.inbox_addresses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.inbox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id text NOT NULL,
  source text NOT NULL DEFAULT 'email',
  email_id text,                         -- Resends id, för att inte ta emot samma mejl två gånger
  from_email text,
  from_name text,
  subject text,
  file_url text,                         -- samma form som en uppladdning (publik Storage-URL, signeras vid visning)
  file_name text NOT NULL DEFAULT '',
  content_type text,
  size_bytes integer,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'imported', 'ignored')),
  received_at timestamptz NOT NULL DEFAULT now(),
  imported_at timestamptz,
  UNIQUE (email_id, file_name)
);
CREATE INDEX IF NOT EXISTS inbox_items_company_status_idx
  ON public.inbox_items (owner_user_id, company_id, status, received_at DESC);
ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

-- Ägaren och aktiva medlemmar i företaget ser raderna; ägaren och redigerare
-- får markera dem som hämtade.
DROP POLICY IF EXISTS "Läs företagets inkorg" ON public.inbox_items;
CREATE POLICY "Läs företagets inkorg"
ON public.inbox_items FOR SELECT TO authenticated
USING (
  owner_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.member_user_id = (SELECT auth.uid())
      AND m.owner_user_id = inbox_items.owner_user_id
      AND m.company_id = inbox_items.company_id
      AND m.status = 'active'
  )
);

DROP POLICY IF EXISTS "Hämta från företagets inkorg" ON public.inbox_items;
CREATE POLICY "Hämta från företagets inkorg"
ON public.inbox_items FOR UPDATE TO authenticated
USING (
  owner_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.member_user_id = (SELECT auth.uid())
      AND m.owner_user_id = inbox_items.owner_user_id
      AND m.company_id = inbox_items.company_id
      AND m.status = 'active'
      AND m.role = 'editor'
  )
)
WITH CHECK (
  owner_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.member_user_id = (SELECT auth.uid())
      AND m.owner_user_id = inbox_items.owner_user_id
      AND m.company_id = inbox_items.company_id
      AND m.status = 'active'
      AND m.role = 'editor'
  )
);
