// hooks/useSyncManager.ts
// Gestion de la synchronisation Firestore, file d'attente offline et debounce
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppData } from '../types';
import { storageService } from '../services/storageService';
import { offlineService } from '../services/offlineService';

interface UseSyncManagerOptions {
  user: { uid: string } | null;
  data: AppData | null;
  isInitialLoading: boolean;
  isOnline: boolean;
  isAdmin: boolean;
}

interface SyncManagerResult {
  isSyncing: boolean;
  syncError: string | null;
  hasPendingSync: boolean;
  pendingSyncCount: number;
  isDirtyRef: React.MutableRefObject<boolean>;
  refreshPendingSync: () => Promise<void>;
}

export function useSyncManager({
  user,
  data,
  isInitialLoading,
  isOnline,
  isAdmin,
}: UseSyncManagerOptions): SyncManagerResult {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);
  const latestDataRef = useRef<AppData | null>(null);
  const latestUserRef = useRef<{ uid: string } | null>(null);
  const prevOnlineRef = useRef(true);

  // Keep latest references
  useEffect(() => {
    latestDataRef.current = data;
    if (data && !isInitialLoading) {
      isDirtyRef.current = true;
    }
  }, [data, isInitialLoading]);

  useEffect(() => {
    latestUserRef.current = user;
  }, [user]);

  // Refresh pending sync count
  const refreshPendingSync = useCallback(async () => {
    const count = await offlineService.getSyncQueue().then(q => q.length);
    setPendingSyncCount(count);
    setHasPendingSync(count > 0);
  }, []);

  // Process pending sync queue when coming back online
  const processSyncQueue = useCallback(async () => {
    if (!user) return;
    const queue = await offlineService.getSyncQueue();
    if (queue.length === 0) return;

    console.log('[App] Processing sync queue:', queue.length, 'operations');
    setIsSyncing(true);

    // Deduplicate: only process the latest snapshot
    const latestOp = queue[queue.length - 1];

    try {
      if (latestOp.type === 'saveData') {
        if (isAdmin) {
          await storageService.forceSync(user.uid, latestOp.data);
        }
        // Non-admin : les données sont déjà en local, on vide juste la queue
      }
      // Ne supprimer que l'opération traitée (pas tout le lot)
      for (const op of queue) {
        if (op.id) {
          await offlineService.removeFromSyncQueue(op.id);
        }
      }
      setSyncError(null);
    } catch (e) {
      console.error('[App] Sync failed:', e);
      setSyncError("Synchronisation cloud échouée. Les données sont dans la file d'attente locale.");
    }

    setIsSyncing(false);
    await refreshPendingSync();
  }, [user, isAdmin, refreshPendingSync]);

  // Process queue when coming back online
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current && user) {
      processSyncQueue();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, user, processSyncQueue]);

  // Auto-refresh pending sync count
  useEffect(() => {
    refreshPendingSync();
  }, [data, refreshPendingSync]);

  // Debounced save to Firestore
  useEffect(() => {
    if (!data || !user || isInitialLoading) return;

    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
    }

    pendingSaveRef.current = setTimeout(async () => {
      setIsSyncing(true);
      try {
        if (isAdmin) {
          await storageService.saveData(user.uid, data);
        } else {
          await offlineService.saveLocalData(user.uid, data);
        }
        isDirtyRef.current = false;
        setSyncError(null);
      } catch (e) {
        console.error('Failed to sync data:', e);
        setSyncError('Synchronisation cloud échouée. Les données sont sauvegardées localement uniquement.');
      } finally {
        setIsSyncing(false);
      }
    }, 1500); // 1.5s debounce

    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
      }
    };
  }, [data, user, isInitialLoading, isAdmin]);

  // Flush unsaved changes on unmount
  useEffect(() => {
    return () => {
      const u = latestUserRef.current;
      const d = latestDataRef.current;
      if (u && d && isDirtyRef.current) {
        storageService.saveData(u.uid, d).catch((err) =>
          console.error('Failed to sync data on unmount/logout:', err)
        );
      }
    };
  }, []);

  return {
    isSyncing,
    syncError,
    hasPendingSync,
    pendingSyncCount,
    isDirtyRef,
    refreshPendingSync,
  };
}
