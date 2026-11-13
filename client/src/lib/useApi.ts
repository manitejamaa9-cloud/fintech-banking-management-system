import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from './api';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T = any>(url: string | null) {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: Boolean(url), error: null });
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!url) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));
    api
      .get<T>(url, { signal: controller.signal })
      .then((res) => {
        if (mounted.current) setState({ data: res.data, loading: false, error: null });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (mounted.current) setState({ data: null, loading: false, error: errorMessage(err) });
      });
    return () => controller.abort();
  }, [url, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
