import { useState, useEffect, useRef, useCallback } from 'react';
import { AppData } from '../types';
import { subscribeToAllCollections, writeChanges } from '../services/realtimeService';

export function useRealtimeData(user: { uid: string } | null) {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const prevDataRef = useRef<AppData | null>(null);

  useEffect(() => {
    if (!user) {
      setData(null);
      setIsLoading(false);
      setError(null);
      prevDataRef.current = null;
      return;
    }

    const isSandbox = localStorage.getItem('sandbox_mode') === 'true';
    if (isSandbox) {
      import('../utils/testData').then(({ getTestData }) => {
        const td = getTestData();
        setData(td);
        prevDataRef.current = td;
        setIsLoading(false);
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsub = subscribeToAllCollections(
      (freshData) => {
        setData(freshData);
        prevDataRef.current = freshData;
        setIsLoading(false);
      },
      (err) => {
        console.error('[realtime] Subscription error:', err);
        setError('Erreur de connexion aux données');
        setIsLoading(false);
      }
    );

    return () => {
      unsub();
      prevDataRef.current = null;
    };
  }, [user]);

  const updateData = useCallback((newData: AppData) => {
    const isSandbox = localStorage.getItem('sandbox_mode') === 'true';
    if (isSandbox) {
      setData(newData);
      prevDataRef.current = newData;
      return;
    }
    const oldData = prevDataRef.current;
    if (oldData) {
      prevDataRef.current = newData;
      setData(newData);
      writeChanges(oldData, newData);
    } else {
      setData(newData);
      prevDataRef.current = newData;
    }
  }, []);

  return { data, isLoading, error, updateData };
}
