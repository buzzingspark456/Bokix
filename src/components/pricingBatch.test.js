import { describe, it, expect } from 'vitest';
import { parseBatch } from './PricingTool';

describe('Flera på en gång', () => {
  it('läser benämning och pris från Excel, bara priser och decimalkomma', () => {
    expect(parseBatch('Sunbrella kapellväv\t161\nTaggblixtlås 10 mm\t49,50\n120\n\n1 250 kr\nOgiltig rad')).toEqual([
      { label: 'Sunbrella kapellväv', cost: 161 },
      { label: 'Taggblixtlås 10 mm', cost: 49.5 },
      { label: '', cost: 120 },
      { label: '', cost: 1250 },
    ]);
  });
});
