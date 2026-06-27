// services/storageService.ts
// Offline-first storage: IndexedDB local cache + Firestore sub-collections per entity type
// Migration depuis l'ancien singleton sharedData/singleton vers des collections dédiées

import { AppData, AppSettings, ProductionBatch, StockBatch, Client, Sale, Reservation, ActivityLogEntry } from '../types';
import { db } from './firebaseConfig';
import { doc, setDoc, getDoc, collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { offlineService } from './offlineService';

export const getDefaultData = (): AppData => ({
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

const getBackupsRef = (userId: string) => collection(db, 'users', userId, 'backups');

export function ensureAppData(d: Partial<AppData>): AppData {
  return {
    productionBatches: d.productionBatches ?? [],
    stockBatches: d.stockBatches ?? [],
    clients: d.clients ?? [],
    sales: d.sales ?? [],
    reservations: d.reservations ?? [],
    settings: d.settings ?? { adminPasswordHash: '' },
    activityLog: d.activityLog ?? undefined,
    userPermissions: d.userPermissions ?? undefined,
    fcmToken: d.fcmToken ?? undefined,
    fcmPushFunctionUrl: d.fcmPushFunctionUrl ?? undefined,
  };
}

// ── Nouvelles collections Firestore (une par type d'entité) ──

const COLLECTIONS = {
  productionBatches: () => collection(db, 'productionBatches'),
  stockBatches: () => collection(db, 'stockBatches'),
  clients: () => collection(db, 'clients'),
  sales: () => collection(db, 'sales'),
  reservations: () => collection(db, 'reservations'),
  settings: () => doc(db, 'settings', 'singleton'),
  activityLog: () => collection(db, 'activityLog'),
  userPermissions: () => doc(db, 'userPermissions', 'index'),
  fcmConfig: () => doc(db, 'fcm', 'config'),
};

// Supprime les valeurs undefined (Firestore les rejette)
export function sanitize(obj: any): any {
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
}

// ── Cache mémoire des IDs connus (évite 5 getDocs à chaque saveData) ──
// Initialisé au premier appel de writeEntities, mis à jour après chaque writeBatch réussi
export const knownIdsCache: Record<string, Set<string> | null> = {
  productionBatches: null,
  stockBatches: null,
  clients: null,
  sales: null,
  reservations: null,
};

type CacheKey = keyof typeof knownIdsCache;

// Correspondance cache → collection Firestore
const CACHE_TO_COLLECTION: Record<CacheKey, () => ReturnType<typeof collection>> = {
  productionBatches: () => COLLECTIONS.productionBatches(),
  stockBatches: () => COLLECTIONS.stockBatches(),
  clients: () => COLLECTIONS.clients(),
  sales: () => COLLECTIONS.sales(),
  reservations: () => COLLECTIONS.reservations(),
};

/**
 * Calcule les IDs supprimés en utilisant le cache mémoire.
 * Au premier appel, lit Firestore et initialise le cache.
 * Appels suivants : diff local sans lecture Firestore.
 */
export async function getDeletedIdsCached(
  key: CacheKey,
  currentIds: Set<string>
): Promise<string[]> {
  try {
    if (knownIdsCache[key] === null) {
      // Première initialisation : lire depuis Firestore
      const snap = await getDocs(CACHE_TO_COLLECTION[key]());
      knownIdsCache[key] = new Set(snap.docs.map(d => d.id));
    }
    // Diff local : IDs dans le cache mais pas dans les nouvelles données = supprimés
    return [...knownIdsCache[key]!].filter(id => !currentIds.has(id));
  } catch {
    return [];
  }
}

/**
 * Met à jour le cache après une écriture réussie.
 */
export function updateCache(key: CacheKey, currentIds: Set<string>): void {
  knownIdsCache[key] = currentIds;
}

/**
 * Réinitialise le cache (utile après rechargement complet des données).
 */
export function resetCache(): void {
  for (const key of Object.keys(knownIdsCache) as CacheKey[]) {
    knownIdsCache[key] = null;
  }
}

export const storageService = {
  /**
   * Construit un writeBatch avec toutes les opérations d'écriture et suppression.
   * Garantit l'atomicité : soit toutes les opérations réussissent, soit aucune.
   */
  // Interne : écriture atomique dans toutes les collections via writeBatch
  async writeEntities(data: AppData): Promise<void> {
    // Détection des suppressions via le cache mémoire (pas de getDocs au 1er appel)
    const [delPBIds, delSBIds, delClIds, delSaleIds, delResIds] = await Promise.all([
      getDeletedIdsCached('productionBatches', new Set(data.productionBatches.map(b => b.id))),
      getDeletedIdsCached('stockBatches', new Set(data.stockBatches.map(b => b.id))),
      getDeletedIdsCached('clients', new Set(data.clients.map(c => c.id))),
      getDeletedIdsCached('sales', new Set(data.sales.map(s => s.id))),
      getDeletedIdsCached('reservations', new Set(data.reservations.map(r => r.id))),
    ]);

    const batch = writeBatch(db);
    let ops = 0;

    // Helper pour ajouter une opération au batch
    const addSet = (ref: any, data: any) => {
      if (ops < 500) { batch.set(ref, sanitize(data)); ops++; }
    };
    const addDelete = (ref: any) => {
      if (ops < 500) { batch.delete(ref); ops++; }
    };

    if (data.productionBatches.length + data.stockBatches.length + data.clients.length + data.sales.length + data.reservations.length > 450) {
      console.warn('[storageService] Large write batch approaching 500-op limit:', {
        productionBatches: data.productionBatches.length,
        stockBatches: data.stockBatches.length,
        clients: data.clients.length,
        sales: data.sales.length,
        reservations: data.reservations.length,
        deletions: delPBIds.length + delSBIds.length + delClIds.length + delSaleIds.length + delResIds.length,
      });
    }

    // Production batches
    for (const pb of data.productionBatches) addSet(doc(db, 'productionBatches', pb.id), pb);
    for (const id of delPBIds) addDelete(doc(db, 'productionBatches', id));

    // Stock batches
    for (const sb of data.stockBatches) addSet(doc(db, 'stockBatches', sb.id), sb);
    for (const id of delSBIds) addDelete(doc(db, 'stockBatches', id));

    // Clients
    for (const c of data.clients) addSet(doc(db, 'clients', c.id), c);
    for (const id of delClIds) addDelete(doc(db, 'clients', id));

    // Sales
    for (const s of data.sales) addSet(doc(db, 'sales', s.id), s);
    for (const id of delSaleIds) addDelete(doc(db, 'sales', id));

    // Reservations
    for (const r of data.reservations) addSet(doc(db, 'reservations', r.id), r);
    for (const id of delResIds) addDelete(doc(db, 'reservations', id));

    // Settings
    addSet(COLLECTIONS.settings(), data.settings);

    // Activity log (max 500 entrées)
    if (data.activityLog?.length) {
      for (const entry of data.activityLog.slice(0, 500)) {
        addSet(doc(db, 'activityLog', entry.id), entry);
      }
    }

    // User permissions
    if (data.userPermissions) {
      addSet(COLLECTIONS.userPermissions(), data.userPermissions);
    }

    // FCM config
    if (data.fcmToken) {
      addSet(COLLECTIONS.fcmConfig(), { token: data.fcmToken, pushFunctionUrl: data.fcmPushFunctionUrl || '' });
    }

    if (ops > 0) {
      await batch.commit();

      // Mise à jour du cache après écriture réussie (indispensable pour la cohérence)
      updateCache('productionBatches', new Set(data.productionBatches.map(b => b.id)));
      updateCache('stockBatches', new Set(data.stockBatches.map(b => b.id)));
      updateCache('clients', new Set(data.clients.map(c => c.id)));
      updateCache('sales', new Set(data.sales.map(s => s.id)));
      updateCache('reservations', new Set(data.reservations.map(r => r.id)));
    }
  },

  /**
   * Sauvegarde les données : écriture locale immédiate (IndexedDB), puis sync Firestore atomique.
   * Chaque entité est écrite dans sa propre collection Firestore via writeBatch.
   * Les entités supprimées sont automatiquement nettoyées.
   */
  async saveData(userId: string, data: AppData): Promise<void> {
    if (!userId) {
      console.error('[storageService] Cannot save data: no authenticated user');
      return;
    }

    // 1. Toujours en local d'abord (rapide, fonctionne hors-ligne)
    await offlineService.saveLocalData(userId, data);

    // 2. Sync atomique vers Firestore
    try {
      await this.writeEntities(data);
      await offlineService.clearSyncQueue();
      console.log('[storageService] Data synced atomically to Firestore sub-collections.');
    } catch (e) {
      console.warn('[storageService] Firestore sync failed, queuing for later:', e);
      await offlineService.addToSyncQueue(userId, data);
    }
  },

  /**
   * Chargement des données : essaie d'abord les nouvelles collections Firestore,
   * puis l'ancien singleton (migration automatique), puis le cache local,
   * puis l'ancien doc personnel, et enfin les valeurs par défaut.
   */
  async loadData(userId: string): Promise<AppData> {
    if (!userId) {
      console.error('[storageService] Cannot load data: no authenticated user');
      return getDefaultData();
    }

    // Réinitialiser le cache pour éviter des suppressions incorrectes
    // dues à des IDs d'un précédent utilisateur ou d'une session antérieure
    resetCache();

    // ── 1. Nouvelles collections Firestore (source de vérité) ──
    try {
      const [pbSnap, sbSnap, clSnap, saSnap, reSnap, settingsSnap, alSnap, upSnap, fcmSnap] = await Promise.all([
        getDocs(COLLECTIONS.productionBatches()),
        getDocs(COLLECTIONS.stockBatches()),
        getDocs(COLLECTIONS.clients()),
        getDocs(COLLECTIONS.sales()),
        getDocs(COLLECTIONS.reservations()),
        getDoc(COLLECTIONS.settings()),
        getDocs(COLLECTIONS.activityLog()),
        getDoc(COLLECTIONS.userPermissions()),
        getDoc(COLLECTIONS.fcmConfig()),
      ]);

      if (pbSnap.docs.length > 0 || sbSnap.docs.length > 0) {
        const data: AppData = {
          productionBatches: pbSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionBatch)),
          stockBatches: sbSnap.docs.map(d => ({ id: d.id, ...d.data() } as StockBatch)),
          clients: clSnap.docs.map(d => ({ id: d.id, ...d.data() } as Client)),
          sales: saSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sale)),
          reservations: reSnap.docs.map(d => ({ id: d.id, ...d.data() } as Reservation)),
          settings: settingsSnap.exists() ? (settingsSnap.data() as AppSettings) : getDefaultData().settings,
          activityLog: alSnap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLogEntry)).slice(-500),
          userPermissions: upSnap.exists() ? (upSnap.data() as Record<string, string[]>) : undefined,
          fcmToken: fcmSnap.exists() ? (fcmSnap.data() as any).token : undefined,
          fcmPushFunctionUrl: fcmSnap.exists() ? (fcmSnap.data() as any).pushFunctionUrl : undefined,
        };
        const safe = ensureAppData(data);
        await offlineService.saveLocalData(userId, safe);
        console.log('[storageService] Loaded from Firestore collections. Batches:', safe.productionBatches.length);
        return safe;
      }
    } catch (e) {
      console.warn('[storageService] Failed to read collections:', e);
    }

    // ── 2. Ancien sharedData/singleton → migration automatique ──
    try {
      const oldRef = doc(db, 'sharedData', 'singleton');
      const oldSnap = await getDoc(oldRef);
      if (oldSnap.exists()) {
        const oldData = oldSnap.data() as AppData;
        const safe = ensureAppData(oldData);
        console.log('[storageService] Migrating old singleton → collections. Batches:', safe.productionBatches.length);

        // Écrire dans les nouvelles collections (peut échouer sans affecter le singleton)
        try {
          if (safe.productionBatches.length > 0 || safe.stockBatches.length > 0) {
            await this.writeEntities(safe);
            // Ne supprimer l'ancien singleton qu'après écriture réussie
            await deleteDoc(oldRef);
            await offlineService.clearSyncQueue();
            console.log('[storageService] Migration complete, old singleton deleted.');
          }
        } catch (writeErr) {
          console.warn('[storageService] Migration write failed (singleton preserved for retry):', writeErr);
        }

        await offlineService.saveLocalData(userId, safe);
        return safe;
      }
    } catch (e) {
      console.warn('[storageService] Failed to read old singleton:', e);
    }

    // ── 3. Cache local IndexedDB ──
    try {
      const localData = await offlineService.getLocalData(userId);
      if (localData && (localData.productionBatches?.length || localData.stockBatches?.length)) {
        console.log('[storageService] Loaded from local cache. Batches:', localData.productionBatches?.length || 0);
        const safe = ensureAppData(localData);
        // Pousser vers les nouvelles collections
        try {
          await this.writeEntities(safe);
          await offlineService.clearSyncQueue();
        } catch (writeErr) {
          console.warn('[storageService] Could not write local cache to Firestore:', writeErr);
        }
        return safe;
      }
    } catch (e) {
      console.warn('[storageService] Failed to read local cache:', e);
    }

    // ── 4. Ancien doc personnel Firestore (migration) ──
    try {
      console.log('[storageService] No shared data, checking personal doc...');
      const personalRef = doc(db, 'users', userId, 'appData', 'singleton');
      const personalSnap = await getDoc(personalRef);
      if (personalSnap.exists()) {
        const personalData = personalSnap.data() as AppData;
        const safe = ensureAppData(personalData);
        console.log('[storageService] Migrating personal data → collections. Batches:', safe.productionBatches.length);
        try {
          await this.writeEntities(safe);
          await offlineService.clearSyncQueue();
        } catch (writeErr) {
          console.warn('[storageService] Personal migration write failed:', writeErr);
        }
        await offlineService.saveLocalData(userId, safe);
        return safe;
      }
    } catch (e) {
      console.warn('[storageService] Failed to read personal doc:', e);
    }

    // ── 5. Dernier recours : cache local même vide ──
    try {
      const localData = await offlineService.getLocalData(userId);
      if (localData) {
        console.log('[storageService] Loaded from local cache (fallback).');
        return ensureAppData(localData);
      }
    } catch (_) {}

    console.log('[storageService] No data found, returning defaults');
    return getDefaultData();
  },

  /**
   * Sync forcée : pousse les données locales vers Firestore
   */
  async forceSync(userId: string, data: AppData): Promise<boolean> {
    try {
      await this.saveData(userId, data);
      return true;
    } catch (e) {
      console.error('[storageService] Force sync failed:', e);
      return false;
    }
  },

  // ── Backups (inchangés, sous users/{userId}/backups/) ──

  async createBackup(userId: string, data: AppData, label?: string): Promise<string> {
    if (!userId) throw new Error('No user');

    // Sauvegarde locale
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
    // Restaure les données dans les collections Firestore
    await this.forceSync(userId, backup.data);
    await offlineService.saveLocalData(userId, backup.data);
    await offlineService.clearSyncQueue();
    return backup.data;
  },

  async deleteBackup(userId: string, backupId: string): Promise<void> {
    if (!userId) return;
    try {
      const backupRef = doc(db, 'users', userId, 'backups', backupId);
      await setDoc(backupRef, { archived: true, archivedAt: serverTimestamp() }, { merge: true });
      console.log('[storageService] Backup soft-deleted (archived):', backupId);
    } catch (e) {
      console.warn('[storageService] Failed to archive backup:', e);
    }
  },

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
      if (purged > 0) console.log('[storageService] Purged', purged, 'old archived backups');
      return purged;
    } catch (e) {
      console.warn('[storageService] Failed to purge archived backups:', e);
      return 0;
    }
  },

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

  async getPendingSyncCount(): Promise<number> {
    const queue = await offlineService.getSyncQueue();
    return queue.length;
  },

  /**
   * Réinitialise le cache mémoire des IDs connus.
   * À appeler lors d'un changement d'utilisateur ou d'un rechargement complet.
   */
  resetCache,
};
