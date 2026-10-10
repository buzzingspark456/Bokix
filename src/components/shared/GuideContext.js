import { createContext } from 'react';

// Sätts av App.jsx för sidan man står på: { guides, open }. Läses av
// ListPageHeader.jsx, som då visar "Se hur" bredvid rubriken.
export const GuideContext = createContext(null);
