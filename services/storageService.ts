
import { AppData } from '../types';
import { db } from './firebaseConfig';
import { doc, setDoc, getDoc, collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, serverTimestamp } from 'firebase/firestore';

const getDefaultData = (): AppData => ({
  productionBatches: [],
  stockBatches: [],
  clients: [],
  sales: [],
  settings: { adminPasswordHash: '1234' },
});

const getUserDocRef = (userId: string) => doc(db, 'users', userId, 'appData', 'singleton');
const getBackupsRef = (userId: string) => collection(db, 'users', userId, 'backups');

export const storageService = {
  async saveData(userId: string, data: AppData): Promise<void> {
    if (!userId) {
      console.error('[storageService] Cannot save data: no authenticated user');
      return;
    }
    try {
      const docRef = getUserDocRef(userId);
      console.log('[storageService] Saving data for user:', userId, 'Batches:', data.productionBatches.length);
      await setDoc(docRef, data);
      console.log('[storageService] Data saved successfully');
    } catch (e) {
      console.error('[storageService] Error saving data to Firestore:', e);
      throw e;
    }
  },

  async loadData(userId: string): Promise<AppData> {
    if (!userId) {
      console.error('[storageService] Cannot load data: no authenticated user');
      return getDefaultData();
    }
    try {
      const docRef = getUserDocRef(userId);
      console.log('[storageService] Loading data for user:', userId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const d = snap.data() as AppData;
        console.log('[storageService] Data loaded. Batches:', d.productionBatches?.length || 0);
        return d;
      }
      console.log('[storageService] No data found in Firestore, returning defaults');
    } catch (e) {
      console.error('[storageService] Error loading data from Firestore:', e);
    }
    return getDefaultData();
  },

  async createBackup(userId: string, data: AppData, label?: string): Promise<string> {
    if (!userId) throw new Error('No user');
    const backupRef = getBackupsRef(userId);
    const docRef = await addDoc(backupRef, {
      data,
      label: label || `Backup ${new Date().toLocaleString('fr-FR')}`,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  },

  async listBackups(userId: string): Promise<{ id: string; label: string; createdAt: string; data: AppData }[]> {
    if (!userId) return [];
    const backupRef = getBackupsRef(userId);
    const q = query(backupRef, orderBy('createdAt', 'desc'), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as { id: string; label: string; createdAt: string; data: AppData }[];
  },

  async restoreBackup(userId: string, backupId: string): Promise<AppData> {
    if (!userId) throw new Error('No user');
    const backupRef = doc(db, 'users', userId, 'backups', backupId);
    const snap = await getDoc(backupRef);
    if (!snap.exists()) throw new Error('Backup not found');
    const backup = snap.data();
    // Save restored data to main doc
    await this.saveData(userId, backup.data);
    return backup.data;
  },

  async deleteBackup(userId: string, backupId: string): Promise<void> {
    if (!userId) return;
    const backupRef = doc(db, 'users', userId, 'backups', backupId);
    await deleteDoc(backupRef);
  },
};
