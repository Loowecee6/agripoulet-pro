
import { AppData } from '../types';
import { db } from './firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const STORAGE_DOC = doc(db, 'appData', 'singleton');

export const storageService = {
  async saveData(data: AppData): Promise<void> {
    try {
      await setDoc(STORAGE_DOC, data);
    } catch (e) {
      console.error('Error saving data to Firestore', e);
    }
  },

  async loadData(): Promise<AppData> {
    try {
      const snap = await getDoc(STORAGE_DOC);
      if (snap.exists()) {
        return snap.data() as AppData;
      }
    } catch (e) {
      console.error('Error loading data from Firestore', e);
    }
    // Fallback default data structure
    return {
      productionBatches: [],
      stockBatches: [],
      clients: [],
      sales: [],
      settings: { adminPasswordHash: '1234' },
    };
  },
};
