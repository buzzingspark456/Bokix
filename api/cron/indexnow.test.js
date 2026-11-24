import { describe, it, expect } from 'vitest';
import { changedSince } from './indexnow.js';

const xml = `<urlset>
  <url><loc>https://www.bokix.se/</loc><lastmod>2026-11-24</lastmod></url>
  <url><loc>https://www.bokix.se/priser</loc><lastmod>2026-11-23</lastmod><image:image><image:loc>https://www.bokix.se/og/priser.jpg?v=1</image:loc></image:image></url>
  <url><loc>https://www.bokix.se/lon</loc><lastmod>2026-10-13</lastmod></url>
  <url><loc>https://www.bokix.se/blogg</loc></url>
  <url><loc>https://evil.example/x</loc><lastmod>2026-11-24</lastmod></url>
</urlset>`;

describe('IndexNow', () => {
  it('skickar bara sidor ändrade sedan i går, på egna värden', () => {
    expect(changedSince(xml, '2026-11-23')).toEqual(['https://www.bokix.se/', 'https://www.bokix.se/priser']);
    expect(changedSince(xml, '2026-11-25')).toEqual([]);
  });
});
