import { useEffect } from 'react';

const SITE_URL = 'https://www.bokix.se';
// Ingen dedikerad 1200x630 OG-bild finns än — appikonen duger som en
// generisk delningsbild tills en riktig social-bild tas fram, bättre än
// att lämna og:image helt tomt (då genererar de flesta plattformar ingen
// förhandsvisning alls).
const DEFAULT_OG_IMAGE = `${SITE_URL}/icon-512.png`;

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Sätter <title>, <meta name="description"> och grundläggande Open
 * Graph/Twitter-taggar för den monterade sidan.
 *
 * Bugfix: index.html har bara EN statisk uppsättning av de här taggarna
 * (startsidans). Bokix är en SPA (React Router byter bara innehållet i
 * <div id="root">, aldrig <head>), så utan det här visade /priser,
 * /funktioner, /om-oss, /kontakt m.fl. ALLA startsidans titel och
 * beskrivning — fel resultat i Google-sökträffar, och identiska/
 * missvisande förhandsvisningskort när en länk till t.ex. /priser delas i
 * Slack, X eller LinkedIn.
 *
 * Sätter inget tillbaka vid unmount — nästa sida monteras direkt och
 * skriver över taggarna med sina egna, det finns aldrig ett tomt mellanläge
 * en crawler eller delning skulle hinna se. */
export function useDocumentMeta({ title, description, path = '/' }) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) upsertMeta('name', 'description', description);

    const url = `${SITE_URL}${path}`;
    upsertCanonical(url);
    if (title) upsertMeta('property', 'og:title', title);
    if (description) upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:image', DEFAULT_OG_IMAGE);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('name', 'twitter:card', 'summary');
    if (title) upsertMeta('name', 'twitter:title', title);
    if (description) upsertMeta('name', 'twitter:description', description);
  }, [title, description, path]);
}
