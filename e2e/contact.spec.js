import { test, expect } from '@playwright/test';

// Regressionstest för buggen vi just fixade: kontaktformuläret postade
// tidigare mot /api/email/send-invoice, en rutt som kräver inloggad
// session + company_id — en anonym besökare fick alltid 401 och
// "Något gick fel"-meddelandet, oavsett vad de skrev. Formuläret använder
// nu sin egen /api/contact-rutt istället (se api/contact.js).
//
// Mockar nätverkssvaret med page.route istället för att låta testet
// faktiskt anropa Resend — annars skickar varje testkörning ett riktigt
// mejl till support@bokix.se. Verifierar alltså klientens beteende
// (rätt body postas, rätt UI-state visas), inte serverns e-postlogik —
// den täcks separat (se den manuella curl-verifieringen i commit-loggen).

test.describe('Kontaktformulär (/kontakt)', () => {
  // Förifyller cookiesamtycket (se src/utils/consent.js) så cookiebannern
  // inte täcker formuläret — annars fångar dess klick-intercept varje
  // interaktion under den, samma sak en riktig återkommande besökare
  // aldrig skulle stöta på.
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: 'bokix_cookie_consent', value: 'denied', url: 'http://localhost:5173',
    }]);
  });

  test('skickar till /api/contact (inte send-invoice) och visar bekräftelse', async ({ page }) => {
    let capturedRequest = null;
    await page.route('**/api/contact', async (route) => {
      capturedRequest = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'test-id' }) });
    });
    // Om något i UI:t av misstag skulle regrediera tillbaka till den gamla
    // rutten ska testet fånga det explicit, inte bara timeouta tyst.
    await page.route('**/api/email/send-invoice', async (_route) => {
      throw new Error('Kontaktformuläret ska inte längre anropa /api/email/send-invoice');
    });

    await page.goto('/kontakt');

    await page.fill('#contact-name', 'Test Testsson');
    await page.fill('#contact-email', 'test@example.com');
    await page.getByRole('button', { name: 'Säkerhet & integritet' }).click();
    await page.fill('#contact-message', 'Det här är ett automatiserat Playwright-test.');
    await page.getByRole('button', { name: 'Skicka meddelande' }).click();

    await expect(page.getByText('Meddelandet är skickat')).toBeVisible();

    expect(capturedRequest).toMatchObject({
      name: 'Test Testsson',
      email: 'test@example.com',
      topic: 'Säkerhet & integritet',
      message: 'Det här är ett automatiserat Playwright-test.',
    });
    // Rutten litar aldrig på klienten för mottagare/HTML (öppet mejl-relä-
    // risken send-invoice hade) — de fälten ska alltså inte ens skickas.
    expect(capturedRequest).not.toHaveProperty('to');
    expect(capturedRequest).not.toHaveProperty('html');
  });

  test('visar felmeddelande från servern om utskicket misslyckas', async ({ page }) => {
    await page.route('**/api/contact', async (route) => {
      await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'För många försök. Vänta en stund och försök igen.' }) });
    });

    await page.goto('/kontakt');
    await page.fill('#contact-name', 'Test Testsson');
    await page.fill('#contact-email', 'test@example.com');
    await page.fill('#contact-message', 'Test.');
    await page.getByRole('button', { name: 'Skicka meddelande' }).click();

    await expect(page.getByText('För många försök. Vänta en stund och försök igen.')).toBeVisible();
  });
});
