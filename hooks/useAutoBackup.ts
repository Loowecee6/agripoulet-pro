// hooks/useAutoBackup.ts
// Auto-backup when production batches change
import { useEffect, useRef } from 'react';
import { AppData } from '../types';
import { storageService } from '../services/storageService';

export function useAutoBackup(
  data: AppData | null,
  user: { uid: string } | null,
  isInitialLoading: boolean
) {
  const prevBatchCount = useRef(0);
  const lastAutoBackup = useRef<string>('');

  useEffect(() => {
    if (!data || !user || isInitialLoading) return;

    const currentBatchCount = data.productionBatches.length;
    const dataKey = JSON.stringify({
      batches: currentBatchCount,
      clients: data.clients.length,
      sales: data.sales.length,
    });

    if (dataKey !== lastAutoBackup.current) {
      lastAutoBackup.current = dataKey;
      if (currentBatchCount !== prevBatchCount.current) {
        const label = `Auto-backup ${new Date().toLocaleString('fr-FR')}`;
        storageService.createBackup(user.uid, data, label).catch(() => {});
        prevBatchCount.current = currentBatchCount;
      }
    }
  }, [data, user, isInitialLoading]);

  return { prevBatchCount };
}
