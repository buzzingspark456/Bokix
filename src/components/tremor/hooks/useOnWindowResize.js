// Ported from Tremor Raw (tremorlabs/tremor, MIT license) —
// useOnWindowResize [v0.0.2]. Unchanged from upstream, just JS instead of
// TS.
import { useEffect } from 'react';

export const useOnWindowResize = (handler) => {
  useEffect(() => {
    const handleResize = () => handler();
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handler]);
};
