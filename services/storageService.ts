// services/storageService.ts
// Offline-first storage: IndexedDB local cache + Firestore cloud sync

import { AppData } from '../types';
import { db } from './firebaseConfig';
import { doc, setDoc, getDoc, collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { offlineService } from './offlineService';

const getDefaultData = (): AppData => ({
  productionBatches: [],
  stockBatches: [],
  clients: [],
  reservations: [],
  sales: [],
  settings: {
    adminPasswordHash: '',
    notifications: {
      enabled: true,
      vaccinationReminders: true,
      mortalityAlerts: true,
      creditDeadlines: true,
    },
  },
});

const getSharedDataRef = () => doc(db, 'sharedData', 'singleton');
const getBackupsRef = (userId: string) => collection(db, 'users', userId, 'backups');

function ensureAppData(d: Partial<AppData>): AppData {
  return {
    productionBatches: d.productionBatches ?? [],
    stockBatches: d.stockBatches ?? [],
    clients: d.clients ?? [],
    sales: d.sales ?? [],
    reservations: d.reservations ?? [],
    settings: d.settings ?? { adminPasswordHash: '' },
  };
}

export const storageService = {
  /**
   * Save data: write to IndexedDB instantly, then sync to Firestore.
   * If offline, data is queued for automatic sync when connection returns.
   */
  async saveData(userId: string, data: AppData): Promise<void> {
    if (!userId) {
      console.error('[storageService] Cannot save data: no authenticated user');
      return;
    }

    // 1. Always save locally first (fast, works offline)
    await offlineService.saveLocalData(userId, data);

    // 2. Try to sync to Firestore (shared document for all users)
    try {
      const docRef = getSharedDataRef();
      console.log('[storageService] Saving data to shared Firestore document. Batches:', data.productionBatches.length);

      // Remove any undefined values recursively (Firestore rejects them)
      const sanitize = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(item => {
            const cleaned = sanitize(item);
            return cleaned === undefined ? null : cleaned;
          });
        }
        if (obj && typeof obj === 'object') {
          const cleaned: any = {};
          for (const [k, v] of Object.entries(obj)) {
            if (v !== undefined) {
              const val = sanitize(v);
              if (val !== undefined) {
                cleaned[k] = val;
              }
            }
          }
          return cleaned;
        }
        return obj;
      };

      const cleanData = sanitize(data);
      await setDoc(docRef, cleanData);
      console.log('[storageService] Data synced to Firestore successfully');
      await offlineService.clearSyncQueue();
    } catch (e) {
      // If Firestore fails (offline), queue for later sync
      console.warn('[storageService] Firestore sync failed, queuing for later:', e);
      await offlineService.addToSyncQueue(userId, data);
    }
  },

  /**
   * Load data: try Firestore first, fallback to IndexedDB cache.
   * Priorité : shared doc > cache local > doc personnel (migration) > défaut
   */
  async loadData(userId: string): Promise<AppData> {
    if (!userId) {
      console.error('[storageService] Cannot load data: no authenticated user');
      return getDefaultData();
    }

    // 1. Shared document (source de vérité)
    try {
      const sharedRef = getSharedDataRef();
      console.log('[storageService] Loading data from shared Firestore document.');
      const sharedSnap = await getDoc(sharedRef);
      if (sharedSnap.exists()) {
        const d = sharedSnap.data() as AppData;
        console.log('[storageService] Data loaded from shared Firestore. Batches:', d.productionBatches?.length || 0);
        const safe = ensureAppData(d);
        await offlineService.saveLocalData(userId, safe);
        return safe;
      }
    } catch (e) {
      console.warn('[storageService] Failed to read shared doc:', e);
    }

    // 2. Cache local (contient les données les plus récentes, ex: restauration de backup)
    try {
      const localData = await offlineService.getLocalData(userId);
      if (localData && (localData.productionBatches?.length || localData.stockBatches?.length)) {
        console.log('[storageService] Data loaded from local cache. Batches:', localData.productionBatches?.length || 0);
        const safe = ensureAppData(localData);
        // Pousser vers le document partagé
        try {
          await setDoc(getSharedDataRef(), safe);
          console.log('[storageService] Local data pushed to shared document.');
          await offlineService.clearSyncQueue();
        } catch (writeErr) {
          console.warn('[storageService] Could not write local cache to shared doc:', writeErr);
        }
        return safe;
      }
    } catch (e) {
      console.warn('[storageService] Failed to read local cache:', e);
    }

    // 3. Document personnel Firestore (migration depuis l'ancien stockage individuel)
    try {
      console.log('[storageService] No shared data or local cache, checking personal data...');
      const personalRef = doc(db, 'users', userId, 'appData', 'singleton');
      const personalSnap = await getDoc(personalRef);
      if (personalSnap.exists()) {
        const personalData = personalSnap.data() as AppData;
        const safe = ensureAppData(personalData);
        console.log('[storageService] Migrating personal data to shared document. Batches:', safe.productionBatches.length);
        await setDoc(getSharedDataRef(), safe);
        await offlineService.clearSyncQueue();
        // Ne pas écraser le cache local (sera mis à jour à la prochaine sauvegarde)
        return safe;
      }
    } catch (e) {
      console.warn('[storageService] Failed to read personal doc:', e);
    }

    // 4. Dernier recours : cache local même vide
    try {
      const localData = await offlineService.getLocalData(userId);
      if (localData) {
        console.log('[storageService] Data loaded from local cache (fallback). Batches:', localData.productionBatches?.length || 0);
        return ensureAppData(localData);
      }
    } catch (_) {}

    console.log('[storageService] No data found anywhere, returning defaults');
    return getDefaultData();
  },

  /**
   * Force a full sync: push local data to Firestore
   */
  async forceSync(userId: string, data: AppData): Promise<boolean> {
    try {
      const docRef = getSharedDataRef();
      const sanitize = (obj: any): any => {
        if (Array.isArray(obj)) return obj.map(i => sanitize(i) ?? null);
        if (obj && typeof obj === 'object') {
          const c: any = {};
          for (const [k, v] of Object.entries(obj)) {
            if (v !== undefined) { const val = sanitize(v); if (val !== undefined) c[k] = val; }
          }
          return c;
        }
        return obj;
      };
      await setDoc(docRef, sanitize(data));
      // Clear stale pending sync operations (they contain older data)
      await offlineService.clearSyncQueue();
      console.log('[storageService] Force sync successful');
      return true;
    } catch (e) {
      console.error('[storageService] Force sync failed:', e);
      return false;
    }
  },

  async createBackup(userId: string, data: AppData, label?: string): Promise<string> {
    if (!userId) throw new Error('No user');

    // Save locally too for offline
    await offlineService.saveLocalData(userId, data);

    try {
      const backupRef = getBackupsRef(userId);
      const docRef = await addDoc(backupRef, {
        data,
        label: label || `Backup ${new Date().toLocaleString('fr-FR')}`,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      });
      return docRef.id;
    } catch (e) {
      // If offline, queue backup
      console.warn('[storageService] Backup creation failed (offline), queuing');
      await offlineService.addToSyncQueue(userId, data, label);
      throw new Error('Impossible de créer la sauvegarde hors-ligne. Réessayez quand la connexion sera rétablie.');
    }
  },

  async restoreBackup(userId: string, backupId: string): Promise<AppData> {
    if (!userId) throw new Error('No user');
    if (!navigator.onLine) throw new Error('La restauration nécessite une connexion Internet.');

    const backupRef = doc(db, 'users', userId, 'backups', backupId);
    const snap = await getDoc(backupRef);
    if (!snap.exists()) throw new Error('Backup not found');
    const backup = snap.data();
    // Save restored data to main doc and local cache
    await this.forceSync(userId, backup.data);
    await offlineService.saveLocalData(userId, backup.data);
    // Clear any stale pending sync operations (they contain pre-restore data)
    await offlineService.clearSyncQueue();
    return backup.data;
  },

  async deleteBackup(userId: string, backupId: string): Promise<void> {
    if (!userId) return;
    try {
      // Soft-delete : marquer comme archivé au lieu de supprimer définitivement
      const backupRef = doc(db, 'users', userId, 'backups', backupId);
      await setDoc(backupRef, { archived: true, archivedAt: serverTimestamp() }, { merge: true });
      console.log('[storageService] Backup soft-deleted (archived):', backupId);
    } catch (e) {
      console.warn('[storageService] Failed to archive backup:', e);
    }
  },

  /**
   * Purge les sauvegardes archivées de plus de 90 jours
   */
  async purgeOldArchivedBackups(userId: string): Promise<number> {
    if (!userId) return 0;
    try {
      const backupRef = getBackupsRef(userId);
      const snap = await getDocs(backupRef);
      const cutoff = new Date(Date.now() - 90 * 86400000);
      let purged = 0;
      for (const doc of snap.docs) {
        const data = doc.data();
        if (data.archived && data.archivedAt?.toDate?.() < cutoff) {
          await deleteDoc(doc.ref);
          purged++;
        }
      }
      if (purged > 0) {
        console.log('[storageService] Purged', purged, 'old archived backups');
      }
      return purged;
    } catch (e) {
      console.warn('[storageService] Failed to purge archived backups:', e);
      return 0;
    }
  },

  /**
   * Liste les sauvegardes non-archivées (celles visibles dans l'UI)
   */
  async listBackups(userId: string): Promise<{ id: string; label: string; createdAt: string; data: AppData }[]> {
    if (!userId) return [];
    try {
      const backupRef = getBackupsRef(userId);
      const q = query(backupRef, orderBy('createdAt', 'desc'), limit(20));
      const snap = await getDocs(q);
      return snap.docs
        .filter(d => !d.data().archived)
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as { id: string; label: string; createdAt: string; data: AppData }[];
    } catch (e) {
      console.warn('[storageService] Failed to list backups:', e);
      return [];
    }
  },

  /**
   * Get pending sync queue count
   */
  async getPendingSyncCount(): Promise<number> {
    const queue = await offlineService.getSyncQueue();
    return queue.length;
  },
};
