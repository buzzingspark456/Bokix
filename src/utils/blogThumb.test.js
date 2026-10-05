import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { blogThumb } from './blogThumb';
import { BLOG_POSTS } from '../content/marketing/blog';
import { NEWS_POSTS } from '../content/marketing/news';

describe('blogThumb', () => {
  it('pekar på miniatyren', () => {
    expect(blogThumb('/blog/uf-hero.jpg')).toBe('/blog/thumb/uf-hero.webp');
  });
  it('varje blogg- och nyhetsbild har en miniatyr', () => {
    for (const p of [...BLOG_POSTS, ...NEWS_POSTS]) {
      const file = path.join(process.cwd(), 'public', blogThumb(p.image));
      expect(fs.existsSync(file), `${p.image} saknar miniatyr, se src/utils/blogThumb.js`).toBe(true);
    }
  });
});
