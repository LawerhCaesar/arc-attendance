'use client';
import { useCallback, useEffect, useState } from 'react';

export default function useFellowshipData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(url, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load fellowship data.');
      if (!controller.signal.aborted) setData(body);
    }).catch(error => {
      if (!controller.signal.aborted) { setData(null); setError(error instanceof Error ? error.message : 'Unable to load fellowship data.'); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [url, version]);
  return { data, error, loading, reload };
}
