import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// playwright.config.js laddar inte .env åt oss (till skillnad från
// server.js, som redan gör det) — utan den här raden är
// SUPABASE_SERVICE_ROLE_KEY alltid `undefined` här och den riktiga
// integrationstestet nedan hade tyst hoppats över även lokalt, med en
// hemlighet som faktiskt finns i .env.
dotenv.config();

// Två helt olika sorters test i den här filen, med avsikt:
//
//   1) "Begär återställning" — klientens UI-beteende, nätverket MOCKAT
//      (samma mönster som e2e/contact.spec.js: rätt endpoint anropas, rätt
//      body postas, rätt UI-tillstånd visas). Kräver inga hemligheter,
//      körs alltid, även i en ren CI-miljö utan .env.
//
//   2) "Länken faktiskt fungerar" — en RIKTIG integrationstest mot
//      Supabase, inte mockad. Genererar en äkta återställningslänk via
//      Admin-API:et (samma sätt en riktig länk i mejlet skulle se ut,
//      bara utan att faktiskt vänta på/läsa ett mejl) och navigerar
//      webbläsaren dit på riktigt — övar alltså på RIKTIGT igenom exakt
//      det steget som gick sönder flera gånger under utvecklingen av den
//      här funktionen (fel redirect-domän, {}-felmeddelande, {fel
//      SMTP-lösenord). Kräver SUPABASE_SERVICE_ROLE_KEY lokalt (samma som
//      api/cron/reminders.js redan behöver) — skippas tyst om den saknas,
//      i stället för att krascha en CI-körning som inte har den hemligheten.
//      Använder ett EGET, engångs-testkonto (skapas/städas i testet) —
//      rör aldrig en riktig kunds konto.

test.describe('Begär återställning (Auth.jsx, mockat nätverk)', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: 'bokix_cookie_consent', value: 'denied', url: 'http://localhost:5173',
    }]);
  });

  test('skickar till /api/auth/request-password-reset och visar bekräftelse', async ({ page }) => {
    let capturedRequest = null;
    await page.route('**/api/auth/request-password-reset', async (route) => {
      capturedRequest = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Logga in' }).first().click();
    await page.getByRole('button', { name: 'Glömt lösenord?' }).click();
    await page.getByPlaceholder('din@epost.se').fill('test@example.com');
    await page.getByRole('button', { name: 'Skicka återställningslänk' }).click();

    await expect(page.getByText('Kolla din inkorg')).toBeVisible();
    expect(capturedRequest).toMatchObject({ email: 'test@example.com' });
  });

  test('visar serverns felmeddelande, t.ex. 5/dygn-gränsen, istället för att krascha på ett odefinierat fel', async ({ page }) => {
    // Regressionstest för buggen "blev det rött och står {}" — ett
    // ostrukturerat/oväntat felsvar ska ALDRIG visa den råa
    // felrepresentationen, bara ett läsbart meddelande.
    await page.route('**/api/auth/request-password-reset', async (route) => {
      await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'För många försök. Vänta en stund och försök igen.' }) });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Logga in' }).first().click();
    await page.getByRole('button', { name: 'Glömt lösenord?' }).click();
    await page.getByPlaceholder('din@epost.se').fill('test@example.com');
    await page.getByRole('button', { name: 'Skicka återställningslänk' }).click();

    await expect(page.getByText('För många försök. Vänta en stund och försök igen.')).toBeVisible();
    await expect(page.getByText('{}')).not.toBeVisible();
  });
});

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRunLiveTest = Boolean(supabaseUrl && serviceRoleKey);

test.describe('Återställningslänken fungerar på riktigt (mot Supabase)', () => {
  test.skip(!canRunLiveTest, 'Kräver SUPABASE_SERVICE_ROLE_KEY lokalt — se filkommentaren.');

  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: 'bokix_cookie_consent', value: 'denied', url: 'http://localhost:5173',
    }]);
  });

  const testEmail = `e2e-password-reset-${Date.now()}@bokix-test.invalid`;
  let admin;
  let userId;

  test.beforeAll(async () => {
    admin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: `original-${Date.now()}`,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  });

  test.afterAll(async () => {
    // Städar bort engångskontot oavsett testutfall — aldrig kvarlämnat
    // skräp i produktionsprojektets auth.users.
    if (admin && userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  });

  test('en äkta återställningslänk landar på "Skapa nytt lösenord", inte ett fel', async ({ page }) => {
    // Admin-API:et skickar INGET mejl (till skillnad från
    // resetPasswordForEmail) — returnerar bara action_link direkt, så
    // testet slipper läsa en riktig inkorg för att komma åt token:en.
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: testEmail,
      options: { redirectTo: 'https://www.bokix.se/' },
    });
    expect(error).toBeNull();

    // Följer själva verifieringslänken (samma sak Supabase gör server-
    // side när någon klickar länken i ett riktigt mejl) för att få ut de
    // riktiga token:erna — sedan navigerar vi webbläsaren till den LOKALA
    // dev-servern med samma hash, istället för att förlita oss på att
    // https://www.bokix.se faktiskt är den körande instansen just nu.
    // Vanlig fetch (inte page.request) med redirect:'manual' — enda
    // pålitliga sättet att läsa Location-headern på en 303 utan att
    // klienten själv följer den åt oss.
    const verifyRes = await fetch(data.properties.action_link, { redirect: 'manual' });
    const location = verifyRes.headers.get('location');
    expect(location).toBeTruthy();
    const hash = new URL(location).hash;
    expect(hash).toContain('type=recovery');
    expect(hash).not.toContain('error=');

    await page.goto(`/${hash}`);

    await expect(page.getByRole('heading', { name: 'Skapa nytt lösenord' })).toBeVisible({ timeout: 10_000 });

    const newPassword = `e2e-reset-${Date.now()}`;
    await page.getByPlaceholder('Nytt lösenord (minst 8 tecken)').fill(newPassword);
    await page.getByPlaceholder('Upprepa nytt lösenord').fill(newPassword);
    await page.getByRole('button', { name: 'Uppdatera lösenord' }).click();

    // Lyckad uppdatering tar bort PasswordRecoveryScreen och fortsätter in
    // i appen (fetchUserData) — det avgörande är att felskärmen/den gamla
    // rutan INTE längre visas, inte att en specifik ny sida hinner ladda
    // klart (företagsdata etc. varierar per testkonto).
    await expect(page.getByRole('heading', { name: 'Skapa nytt lösenord' })).not.toBeVisible({ timeout: 10_000 });
  });
});
