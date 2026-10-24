import { describe, it, expect, vi, beforeAll } from 'vitest';

const captured = [];
vi.mock('posthog-js', () => ({ default: { init: () => {}, capture: (name, props) => captured.push({ name, props }) } }));
vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
vi.stubGlobal('window', {});

const { ensurePosthogInit, captureEvent, setPosthogDemoActive } = await import('./posthog.js');
const flush = () => new Promise(r => setTimeout(r, 0));

describe('captureEvent', () => {
  beforeAll(async () => { await ensurePosthogInit(true); });

  it('skickar händelsen med sina egenskaper', async () => {
    captured.length = 0;
    captureEvent('kvitto_uppladdat', { filtyp: 'pdf' });
    await flush();
    expect(captured).toEqual([{ name: 'kvitto_uppladdat', props: { filtyp: 'pdf' } }]);
  });

  it('skickar ingenting medan demot är öppet', async () => {
    captured.length = 0;
    setPosthogDemoActive(true);
    captureEvent('faktura_skickad');
    setPosthogDemoActive(false);
    captureEvent('faktura_skickad');
    await flush();
    expect(captured.map(c => c.name)).toEqual(['faktura_skickad']);
  });
});
