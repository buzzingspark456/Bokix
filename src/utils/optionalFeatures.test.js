import { describe, it, expect } from 'vitest';
import { isFeatureOn, hiddenFeatureNavIds } from './optionalFeatures';

describe('optionalFeatures', () => {
  it('göms för ett nytt företag utan data', () => {
    expect(hiddenFeatureNavIds({ company: {} })).toEqual(['articles', 'projects', 'time']);
  });
  it('syns om det redan finns data, så att ingen tappar något', () => {
    expect(isFeatureOn({ company: {}, articles: [{ id: 1 }] }, 'articles')).toBe(true);
    expect(isFeatureOn({ company: {}, billableTimeEntries: [{ id: 1 }] }, 'projects')).toBe(true);
  });
  it('eget val vinner över data', () => {
    expect(isFeatureOn({ company: { features: { articles: false } }, articles: [{ id: 1 }] }, 'articles')).toBe(false);
    expect(isFeatureOn({ company: { features: { projects: true } } }, 'projects')).toBe(true);
  });
});
