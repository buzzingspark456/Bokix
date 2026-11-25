import { describe, it, expect } from 'vitest';
import { kommunSkattesats, KOMMUN_SKATTESATSER } from './kommunSkattesatser';

describe('kommunernas skattesatser', () => {
  it('alla 290 kommuner finns', () => {
    expect(Object.keys(KOMMUN_SKATTESATSER).length).toBe(290);
  });
  it('Stockholm och Skellefteå enligt Skatteverket 2026', () => {
    expect(kommunSkattesats('Stockholm')).toBe(30.62);
    expect(kommunSkattesats('skellefteå')).toBe(34.742);
    expect(kommunSkattesats('Finns inte')).toBeNull();
  });
});
