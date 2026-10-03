import { useCallback, useEffect, useRef, useState } from 'react';
import { adminGet } from './adminApi';

// Hämtar en flik i /internal och håller den färsk: var 30:e sekund medan
// fliken syns, direkt när man kommer tillbaka till webbläsarfliken, och när
// man trycker Uppdatera. Tidigare hämtades varje flik bara en gång, så
// Systemstatus och Säkerhet visade samma sak tills sidan laddades om.
const REFRESH_MS = 30_000;

export function useAdminData(params, { map = (d) => d, intervalMs = REFRESH_MS } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const key = JSON.stringify(params);
  const mapRef = useRef(map);
  mapRef.current = map;

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const d = await adminGet(JSON.parse(key));
      setData(mapRef.current(d));
      setError('');
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, [key]);

  useEffect(() => {
    reload();
    const tick = () => { if (document.visibilityState === 'visible') reload(); };
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [reload, intervalMs]);

  return { data, setData, error, updatedAt, refreshing, reload };
}
