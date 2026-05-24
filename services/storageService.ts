// services/storageService.ts
// Offline-first storage: IndexedDB local cache + Firestore cloud sync

import { AppData } from '../types';
import { db } from './firebaseConfig';
import { doc, setDoc, getDoc, collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { offlineService } from './offlineService';

const getDefaultData = (): AppData => ({
  productionBatches: [{
    id: 'prod-1',
    nom: 'Bande Test A',
    dateMisePlace: '2026-05-01',
    nbPoussinsInitial: 100,
    prixAchatPoussin: 500,
    suiviQuotidien: [
      { date: '2026-05-01', jourDeBande: 1, mort: 2, conso: 1000, quantite: 0.5, poidsReel: 55, sampleCount: 10, sampleTotalWeight: 550 },
      { date: '2026-05-05', jourDeBande: 5, mort: 1, conso: 3000, quantite: 1.5, poidsReel: 138, sampleCount: 10, sampleTotalWeight: 1380 },
      { date: '2026-05-10', jourDeBande: 10, mort: 0, conso: 5000, quantite: 3.0, poidsReel: 330, sampleCount: 10, sampleTotalWeight: 3300 },
      { date: '2026-05-15', jourDeBande: 15, mort: 1, conso: 8000, quantite: 4.5, poidsReel: 570, sampleCount: 10, sampleTotalWeight: 5700 },
      { date: '2026-05-21', jourDeBande: 21, mort: 0, conso: 10000, quantite: 6.0, poidsReel: 900, sampleCount: 10, sampleTotalWeight: 9000 },
    ],
    depenses: [],
    vaccinations: [],
    statut: 'active',
  }],
  stockBatches: [{
    id: 'stock-1',
    typeOrigine: 'PR',
    lettre: 'A',
    nom: 'Stock A',
    prixKg: 2000,
    coutInitial: 50000,
    poulets: [
      { id: 'p1', numero: 'A001', poids: 2.5, prix: 4000, vendu: true },
      { id: 'p2', numero: 'A002', poids: 2.8, prix: 4500, vendu: true },
      { id: 'p3', numero: 'A003', poids: 2.3, prix: 3500, vendu: true },
      { id: 'p4', numero: 'A004', poids: 2.6, prix: 4000, vendu: true },
      { id: 'p5', numero: 'A005', poids: 2.4, prix: 4200, vendu: false },
      { id: 'p6', numero: 'A006', poids: 2.7, prix: 4500, vendu: false },
      { id: 'p7', numero: 'A007', poids: 2.2, prix: 3800, vendu: false },
    ],
    isFinalized: true,
  }],
  clients: [
    { id: 'client-1', nom: 'Kouamé Jean', adresse: 'Abidjan Cocody', tel: '0102030405' },
    { id: 'client-2', nom: 'Diallo Fatou', adresse: 'Abidjan Treichville', tel: '0504030201' },
  ],
  reservations: [
    {
      id: 'res-1',
      clientId: 'client-1',
      clientNom: 'Kouamé Jean',
      pouletIds: ['p5'],
      dateReserve: '2026-05-28',
      statut: 'confirmed',
      notes: 'Pour une fête de famille',
      createdAt: '2026-05-21T10:00:00.000Z',
      acompte: 2000,
    },
    {
      id: 'res-2',
      clientId: 'client-2',
      clientNom: 'Diallo Fatou',
      pouletIds: ['p6', 'p7'],
      dateReserve: '2026-06-01',
      statut: 'pending',
      createdAt: '2026-05-21T16:00:00.000Z',
    },
  ],
  sales: [
    {
      id: 'sale-1',
      clientId: 'client-1',
      clientNom: 'Kouamé Jean',
      pouletIds: ['p1', 'p2'],
      total: 8500,
      isCredit: true,
      dueDate: '2026-05-16', // 5j de retard pour tester les alertes
      isPaid: false,
      dateVente: '2026-05-21T10:00:00.000Z',
      payments: [
        { id: 'pay-1', montant: 3000, date: '2026-05-21T10:30:00.000Z', methode: 'especes', note: 'Avance' },
        { id: 'pay-2', montant: 2000, date: '2026-05-28T14:00:00.000Z', methode: 'orange_money', note: 'Deuxième versement' },
      ],
    },
    {
      id: 'sale-2',
      clientId: 'client-1',
      clientNom: 'Kouamé Jean',
      pouletIds: ['p3'],
      total: 4000,
      isCredit: true,
      dueDate: '2026-05-23', // Dans 2j pour tester les échéances proches
      isPaid: false,
      dateVente: '2026-05-21T16:00:00.000Z',
    },
    {
      id: 'sale-3',
      clientId: 'client-2',
      clientNom: 'Diallo Fatou',
      pouletIds: ['p4'],
      total: 4000,
      isCredit: false,
      isPaid: true,
      dateVente: '2026-05-20T15:00:00.000Z',
    },
  ],
  settings: {
    // Le hash ci-dessous correspond à 'admin' via SHA-256.
    // Changez-le dans l'onglet Bilan après la première connexion.
    adminPasswordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    notifications: {
      enabled: true,
      vaccinationReminders: true,
      mortalityAlerts: true,
      creditDeadlines: true,
    },
  },
});

const getUserDocRef = (userId: string) => doc(db, 'users', userId, 'appData', 'singleton');
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

    // 2. Try to sync to Firestore
    try {
      const docRef = getUserDocRef(userId);
      console.log('[storageService] Saving data to Firestore for user:', userId, 'Batches:', data.productionBatches.length);

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
    } catch (e) {
      // If Firestore fails (offline), queue for later sync
      console.warn('[storageService] Firestore sync failed, queuing for later:', e);
      await offlineService.addToSyncQueue(userId, data);
    }
  },

  /**
   * Load data: try Firestore first, fallback to IndexedDB cache.
   */
  async loadData(userId: string): Promise<AppData> {
    if (!userId) {
      console.error('[storageService] Cannot load data: no authenticated user');
      return getDefaultData();
    }

    try {
      // Try Firestore first
      const docRef = getUserDocRef(userId);
      console.log('[storageService] Loading data from Firestore for user:', userId);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const d = snap.data() as AppData;
        console.log('[storageService] Data loaded from Firestore. Batches:', d.productionBatches?.length || 0);

        // Ensure all required arrays exist (migration safety)
        const safe = ensureAppData(d);

        // Cache locally for offline use
        await offlineService.saveLocalData(userId, safe);

        return safe;
      }
      console.log('[storageService] No data found in Firestore');
    } catch (e) {
      // If Firestore fails (offline), try local cache
      console.warn('[storageService] Firestore load failed, trying local cache:', e);
      const localData = await offlineService.getLocalData(userId);
      if (localData) {
        console.log('[storageService] Data loaded from local cache. Batches:', localData.productionBatches?.length || 0);
        return ensureAppData(localData);
      }
    }

    // Try local cache as final fallback
    const localData = await offlineService.getLocalData(userId);
    if (localData) {
      console.log('[storageService] Data loaded from local cache (fallback). Batches:', localData.productionBatches?.length || 0);
      return ensureAppData(localData);
    }

    console.log('[storageService] No data found anywhere, returning defaults');
    return getDefaultData();
  },

  /**
   * Force a full sync: push local data to Firestore
   */
  async forceSync(userId: string, data: AppData): Promise<boolean> {
    try {
      const docRef = getUserDocRef(userId);
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
