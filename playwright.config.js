import { defineConfig, devices } from '@playwright/test';

// E2E-tester (riktig webbläsare, hela stacken) — separat från vitest
// (`npm test`), som bara kör enhetstester på ren JS-logik utan DOM/nätverk.
// `webServer` startar samma `npm run dev` som ni redan använder lokalt
// (vite + server.js via concurrently, se package.json) och väntar tills
// Vite svarar innan testerna kör — inget separat testbygge/serverkommando
// att hålla i synk med den riktiga dev-uppsättningen.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
