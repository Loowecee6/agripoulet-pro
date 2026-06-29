import { useState, useEffect, useRef, useCallback } from 'react';
import { AppData } from '../types';
import { subscribeToAllCollections, writeChanges } from '../services/realtimeService';

export function useRealtimeData(user: { uid: string } | null) {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const prevDataRef = useRef<AppData | null>(null);
  const isWritingRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setData(null);
      setIsLoading(false);
      setError(null);
      prevDataRef.current = null;
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsub = subscribeToAllCollections(
      (freshData) => {
        // Ne pas écraser l'état local pendant une écriture en cours
        // pour éviter que onSnapshot restaure des données stale
        if (!isWritingRef.current) {
          prevDataRef.current = freshData;
          setData(freshData);
        }
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

  const updateData = useCallback(async (newData: AppData) => {
    const oldData = prevDataRef.current;
    if (oldData) {
      prevDataRef.current = newData;
      setData(newData);
      isWritingRef.current = true;
      try {
        await writeChanges(oldData, newData);
      } catch (e) {
        console.error('[realtime] Write failed, reverting:', e);
        // En cas d'erreur, restaurer les données précédentes
        prevDataRef.current = oldData;
        setData(oldData);
      } finally {
        isWritingRef.current = false;
      }
    } else {
      setData(newData);
      prevDataRef.current = newData;
    }
  }, []);

  return { data, isLoading, error, updateData };
}
