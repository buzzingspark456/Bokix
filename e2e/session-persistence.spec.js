import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Kundönskemål: förbli inloggad så länge fliken/webbläsaren är öppen, men
// kräva ny inloggning nästa gång sajten öppnas efter att den STÄNGTS. Löst
// genom att byta Supabase-klientens session-storage från standardvalet
// localStorage till sessionStorage (src/supabaseClient.js) — webbläsaren
// rensar sessionStorage automatiskt när fliken stängs, ingen egen kod.
//
// sessionStorage är i webbläsaren skopat PER FLIK, inte delat mellan
// flikar ens inom samma webbläsarfönster/session — så en NY Playwright-
// `page` inom SAMMA context (som redan delar cookies/localStorage om
// något låg där) är ett giltigt, verkligt test av "stängde fliken, öppnade
// en ny": om sessionen ändå syns där har den läckt någonstans den inte
// borde (t.ex. om något av misstag fortfarande skriver till localStorage).
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRunLiveTest = Boolean(supabaseUrl && serviceRoleKey);

test.describe('Session förblir bara inloggad medan fliken är öppen', () => {
  test.skip(!canRunLiveTest, 'Kräver SUPABASE_SERVICE_ROLE_KEY lokalt.');

  const testEmail = `e2e-session-${Date.now()}@bokix-test.invalid`;
  const testPassword = `e2e-session-pw-${Date.now()}`;
  let admin;
  let userId;

  test.beforeAll(async () => {
    admin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  });

  test.afterAll(async () => {
    if (admin && userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  });

  test('överlever en sid-uppdatering, men syns inte i en ny flik', async ({ context }) => {
    // context.addCookies (inte page.addCookies, som inte finns) — gäller
    // för hela context:et, båda flikarna nedan ärver det.
    await context.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: 'http://localhost:5173' }]);

    const page1 = await context.newPage();
    await page1.goto('/');
    await page1.getByRole('button', { name: 'Logga in' }).first().click();
    await page1.getByPlaceholder('din@epost.se').fill(testEmail);
    await page1.getByPlaceholder('••••••••').fill(testPassword);
    await page1.locator('form').getByRole('button', { name: 'Logga in' }).click();

    // Inloggning lyckades — väntar på att Auth-skärmens formulär försvinner
    // (nästa vy beror på kontots skick: betalspärr, onboarding, dashboard —
    // spelar ingen roll här, bara att vi lämnat inloggningsformuläret).
    await expect(page1.getByPlaceholder('din@epost.se')).not.toBeVisible({ timeout: 15_000 });

    // Uppdatering i SAMMA flik — ska fortfarande vara inloggad
    // (sessionStorage överlever en vanlig reload, bara inte att fliken
    // stängs).
    await page1.reload();
    await expect(page1.getByPlaceholder('din@epost.se')).not.toBeVisible({ timeout: 15_000 });

    // En NY flik i samma context — sessionStorage är per-flik, ska INTE
    // se sessionen här. Detta är den faktiska verifieringen av
    // kundönskemålet: en ny flik (~ en återöppnad stängd flik) kräver
    // inloggning på nytt.
    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.getByRole('button', { name: 'Logga in' }).first().click();
    await expect(page2.getByPlaceholder('din@epost.se')).toBeVisible({ timeout: 10_000 });

    await page1.close();
    await page2.close();
  });
});
