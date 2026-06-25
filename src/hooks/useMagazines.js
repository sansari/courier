import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

const isTauri = () => Boolean(window.__TAURI_INTERNALS__);

export function useMagazines() {
  const [magazines, setMagazines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const refreshing = useRef(false);

  const refresh = async (force = false) => {
    if (!isTauri() || refreshing.current) return;
    refreshing.current = true;
    setLoading(true);
    setError(null);

    console.log(force ? '[Courier] Starting force refresh...' : '[Courier] Starting refresh...');

    try {
      const data = await invoke('refresh_magazines', { force });
      console.log('[Courier] Refresh successful, loaded', data.length, 'magazines');
      setMagazines(data);
    } catch (err) {
      console.error('[Courier] Refresh failed:', err);
      console.error('[Courier] Error details:', JSON.stringify(err, null, 2));
      setError(err.toString());
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  };

  const load = async () => {
    if (!isTauri()) return;
    try {
      const data = await invoke('load_magazines');
      setMagazines(data);
    } catch (err) {
      console.error('[Courier] Load failed:', err);
    }
  };

  useEffect(() => {
    if (isTauri()) {
      // Show cached data immediately; refresh in the background.
      console.log('[Courier] App mounted, loading cached data then refreshing...');
      load().then(() => refresh());
    } else {
      setLoading(true);
      fetch(import.meta.env.BASE_URL + 'magazines.json')
        .then(r => r.json())
        .then(data => setMagazines(data))
        .catch(err => setError(err.toString()))
        .finally(() => setLoading(false));
    }
  }, []);

  // Poll for external refresh trigger (Tauri only)
  useEffect(() => {
    if (!isTauri()) return;
    const interval = setInterval(async () => {
      try {
        const triggered = await invoke('check_refresh_trigger');
        if (triggered) {
          console.log('[Courier] External refresh triggered');
          refresh();
        }
      } catch (_) {}
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return { magazines, loading, error, refresh, load };
}
