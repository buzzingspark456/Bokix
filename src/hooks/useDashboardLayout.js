import { useEffect, useState } from 'react';

// Startsidans layout (2026-11-10). Har användaren valt under Utseende gäller
// valet. Annars: en kolumn på laptop (smalare än 1680 px), där två kolumner
// blir trånga, och två kolumner på en stor datorskärm.
const LAPTOP_QUERY = '(max-width: 1679px)';

function useLaptopWidth() {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const [laptop, setLaptop] = useState(() => supported && window.matchMedia(LAPTOP_QUERY).matches);
  useEffect(() => {
    if (!supported) return undefined;
    const mq = window.matchMedia(LAPTOP_QUERY);
    const onChange = (e) => setLaptop(e.matches);
    setLaptop(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange); else mq.addListener(onChange);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', onChange); else mq.removeListener(onChange); };
  }, [supported]);
  return laptop;
}

export function useDashboardLayout(user) {
  const laptop = useLaptopWidth();
  const chosen = user?.user_metadata?.dashboard_layout;
  if (chosen === 'stack' || chosen === 'columns') return chosen;
  return laptop ? 'stack' : 'columns';
}
