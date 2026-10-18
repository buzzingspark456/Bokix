import { describe, it, expect } from 'vitest';
import { targetSize, shouldTryCompress, MAX_PIXELS, MIN_BYTES_TO_COMPRESS } from './imageCompress';

describe('targetSize', () => {
  it('lämnar små bilder orörda', () => {
    expect(targetSize(1600, 1200)).toBeNull();
  });

  it('krymper ett 12 MP-foto till pixelgränsen med samma proportioner', () => {
    const s = targetSize(4032, 3024);
    expect(s.width * s.height).toBeLessThanOrEqual(MAX_PIXELS + 5000);
    expect(s.width / s.height).toBeCloseTo(4032 / 3024, 2);
  });

  it('låter ett långt smalt kvitto behålla nästan hela bredden', () => {
    const s = targetSize(1000, 4000);
    expect(s.width).toBeGreaterThan(900);
  });

  it('tål trasiga mått', () => {
    expect(targetSize(0, 100)).toBeNull();
    expect(targetSize(undefined, undefined)).toBeNull();
  });
});

describe('shouldTryCompress', () => {
  const big = MIN_BYTES_TO_COMPRESS + 1;
  it('krymper stora foton men inte PDF:er eller små filer', () => {
    expect(shouldTryCompress({ type: 'image/jpeg', size: big })).toBe(true);
    expect(shouldTryCompress({ type: 'image/heic', size: big })).toBe(true);
    expect(shouldTryCompress({ type: 'application/pdf', size: big })).toBe(false);
    expect(shouldTryCompress({ type: 'image/jpeg', size: 1000 })).toBe(false);
    expect(shouldTryCompress(null)).toBe(false);
  });
});
