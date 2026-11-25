-- ══════════════════════════════════════════════════════════════════════
-- BOKFÖRDA VERIFIKATIONER SKYDDAS I DATABASEN (2026-11-22)
-- ══════════════════════════════════════════════════════════════════════
-- Bokföringslagen (1999:1078) 5 kap. 5 § och BFNAR 2013:2 (punkt 2.18):
-- i en datorbaserad bokföring rättas en bokföringspost med en ny
-- rättelsepost som dokumenteras med en egen verifikation; den felaktiga
-- posten tas inte bort eller skrivs över. En rättelse får inte göras i en
-- period där arbetet redan är avslutat (låst räkenskapsår).
--
-- Appen följer redan detta. Den här triggern gör att databasen också gör
-- det, oavsett vem som skriver (appen, servern, en gammal flik):
--
--   1. En bokförd verifikation tas aldrig bort (deleted_at sätts inte).
--   2. På en bokförd verifikation ändras aldrig raderna, datumet, serien,
--      numret eller statusen. Underlag, anteckningar och andra fält som inte
--      är bokföringen går att ändra (även i ett låst år).
--   3. En ny bokförd verifikation (eller ett utkast som bokförs) med datum i
--      ett låst räkenskapsår sparas inte, utom bokslutets egna verifikationer
--      (som bokas samtidigt som året låses) och SIE-import.
--
-- Undantag: utkast (status 'draft') och SIE-importerade verifikationer
-- (source börjar med 'sie_import'; Ta bort SIE-import ångrar en felaktig
-- import och originalet finns i det gamla programmet).
--
-- Triggern stoppar inte sparningen (ingen exception): en otillåten ändring
-- hoppas över och loggas i system_events (verif_guard), resten av
-- sparningen går igenom. Annars hade en enda otillåten rad kunnat få allt
-- annat användaren gjort att försvinna. Vid nästa inläsning visar appen det
-- som faktiskt ligger i databasen.
--
-- Ett helt företag som raderas berörs inte (companies.deleted_at, och
-- kontoradering är DELETE, som triggern inte rör).
--
-- Ta bort:
--   DROP TRIGGER IF EXISTS guard_verification_records ON public.company_records;
--   DROP FUNCTION IF EXISTS private.guard_verification_records();

CREATE OR REPLACE FUNCTION private.verification_is_protected(p_data jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(p_data ->> 'status', 'booked') <> 'draft'
     AND coalesce(p_data ->> 'source', '') NOT LIKE 'sie_import%';
$$;

-- Ligger datumet i ett låst räkenskapsår? Samma regel som lockedPeriodFor i
-- src/utils/fiscalYear.js: med start och slut jämförs datumet, annars är
-- nyckeln ("2025") början på datumet.
CREATE OR REPLACE FUNCTION private.in_locked_fiscal_year(p_company uuid, p_date text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(p_date, '') <> '' AND EXISTS (
    SELECT 1
    FROM public.companies c,
         jsonb_each(CASE WHEN jsonb_typeof(c.settings -> 'lockedFiscalYears') = 'object' THEN c.settings -> 'lockedFiscalYears' ELSE '{}'::jsonb END) AS l(key, lock)
    WHERE c.id = p_company
      AND l.lock IS NOT NULL AND l.lock <> 'null'::jsonb AND l.lock <> 'false'::jsonb
      AND CASE
        WHEN jsonb_typeof(l.lock) = 'object' AND coalesce(l.lock ->> 'start', '') <> '' AND coalesce(l.lock ->> 'end', '') <> ''
          THEN left(p_date, 10) BETWEEN l.lock ->> 'start' AND l.lock ->> 'end'
        ELSE p_date LIKE l.key || '%'
      END
  );
$$;

CREATE OR REPLACE FUNCTION private.guard_verification_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Verifikationer som bokas när året stängs (samma spara som låset).
  v_closing text[] := ARRAY['year_end_close', 'year_open_transfer', 'equity_reclass', 'partner_allocation', 'dividend', 'patronage_refund'];
  v_reason text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND private.verification_is_protected(OLD.data) THEN
    IF NEW.deleted_at IS NOT NULL THEN
      v_reason := 'remove';
    ELSIF (NEW.data -> 'rows') IS DISTINCT FROM (OLD.data -> 'rows')
       OR (NEW.data ->> 'date') IS DISTINCT FROM (OLD.data ->> 'date')
       OR (NEW.data ->> 'series') IS DISTINCT FROM (OLD.data ->> 'series')
       OR (NEW.data ->> 'number') IS DISTINCT FROM (OLD.data ->> 'number')
       OR coalesce(NEW.data ->> 'status', 'booked') IS DISTINCT FROM coalesce(OLD.data ->> 'status', 'booked') THEN
      v_reason := 'change';
    END IF;
    IF v_reason IS NOT NULL THEN
      INSERT INTO public.system_events (kind, detail)
      VALUES ('verif_guard', left(format('%s company=%s id=%s', v_reason, OLD.company_id, OLD.id), 500));
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  -- Ny bokförd verifikation, eller ett utkast som bokförs, i ett låst år.
  IF NEW.deleted_at IS NULL
     AND private.verification_is_protected(NEW.data)
     AND NOT (coalesce(NEW.data ->> 'source', '') = ANY (v_closing))
     -- INSERT ... ON CONFLICT kör insert-triggern även när raden redan finns;
     -- då avgör uppdateringen (ovan), annars hade underlag i ett låst år
     -- inte gått att lägga till.
     AND (TG_OP = 'UPDATE' OR NOT EXISTS (
       SELECT 1 FROM public.company_records r
       WHERE r.company_id = NEW.company_id AND r.kind = NEW.kind AND r.id = NEW.id AND r.deleted_at IS NULL))
     AND (TG_OP = 'INSERT' OR OLD.deleted_at IS NOT NULL OR NOT private.verification_is_protected(OLD.data))
     AND private.in_locked_fiscal_year(NEW.company_id, NEW.data ->> 'date') THEN
    INSERT INTO public.system_events (kind, detail)
    VALUES ('verif_guard', left(format('locked_year company=%s id=%s date=%s', NEW.company_id, NEW.id, NEW.data ->> 'date'), 500));
    IF TG_OP = 'INSERT' THEN RETURN NULL; END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_verification_records() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_verification_records ON public.company_records;
CREATE TRIGGER guard_verification_records
  BEFORE INSERT OR UPDATE ON public.company_records
  FOR EACH ROW
  WHEN (NEW.kind = 'verifications')
  EXECUTE FUNCTION private.guard_verification_records();
