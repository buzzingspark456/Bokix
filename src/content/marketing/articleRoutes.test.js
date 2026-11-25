import { it, expect } from 'vitest';
import { ARTICLE_ROUTES } from './articleRoutes';
import { ALL_ARTICLES } from './news';

it('adresslistan stämmer med artiklarna (lägg till nya artiklar i articleRoutes.js)', () => {
  const expected = ALL_ARTICLES.filter(p => p.body).map(p => ({ slug: p.slug, path: p.path }));
  expect(ARTICLE_ROUTES).toEqual(expected);
});
