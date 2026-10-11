-- Logotyp och profilbild gick inte att ladda upp: "new row violates
-- row-level security policy". Uppladdningen sker med upsert (en ny bild
-- ersätter den gamla), och då kräver Supabase Storage även SELECT på
-- objektet. Den publika läspolicyn togs bort 2026-09-30 (säkerhetslintern,
-- "Public Bucket Allows Listing") och ersattes aldrig, så upsert stoppades.
--
-- Här: läsning bara av den egna mappen ("<uid>/..."), samma mönster som
-- "Egen läsning i bokix-uploads". Ingen kan lista andras filer. Bilderna
-- visas ändå för alla via den publika URL:en, som inte går via policyerna.
-- Säkert att köra flera gånger.

DROP POLICY IF EXISTS "Egen läsning i companylogo" ON storage.objects;
CREATE POLICY "Egen läsning i companylogo"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'companylogo' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Egen läsning i profile" ON storage.objects;
CREATE POLICY "Egen läsning i profile"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));
