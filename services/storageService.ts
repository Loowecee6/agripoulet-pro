
import { AppData } from '../types';

const STORAGE_KEY = 'agripoulet_pro_cloud_v1';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const storageService = {
  async saveData(data: AppData): Promise<void> {
    await delay(300); 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  async loadData(): Promise<AppData> {
    await delay(500);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration : s'assurer que les settings existent
        if (!parsed.settings) {
          parsed.settings = { adminPasswordHash: '1234' };
        }
        return parsed;
      } catch (e) {
        console.error("Erreur de parsing", e);
      }
    }
    return {
      productionBatches: [],
      stockBatches: [],
      clients: [],
      sales: [],
      settings: { adminPasswordHash: '1234' }
    };
  }
};
