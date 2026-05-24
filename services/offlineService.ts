// services/offlineService.ts
// IndexedDB storage for offline-first data persistence
import { openDB, IDBPDatabase } from 'idb';
import { AppData } from '../types';

const DB_NAME = 'agripoulet-pro';
const DB_VERSION = 2;

interface SyncOperation {
  id?: number;
  userId: string;
  type: 'saveData' | 'createBackup';
  data: AppData;
  label?: string;
  timestamp: number;
}

interface OfflineDB {
  appData: {
    key: string; // userId
    data: AppData;
    updatedAt: number;
  };
  syncQueue: SyncOperation;
}

let dbInstance: IDBPDatabase<OfflineDB> | null = null;

async function getDB(): Promise<IDBPDatabase<OfflineDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<OfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('appData', { keyPath: 'key' });
      }
      if (oldVersion < 2) {
        db.createObjectStore('syncQueue', {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    },
  });

  return dbInstance;
}

export const offlineService = {
  /**
   * Save data locally to IndexedDB
   */
  async saveLocalData(userId: string, data: AppData): Promise<void> {
    try {
      const db = await getDB();
      await db.put('appData', {
        key: userId,
        data,
        updatedAt: Date.now(),
      });
      console.log('[offlineService] Data saved locally');
    } catch (e) {
      console.error('[offlineService] Error saving locally:', e);
    }
  },

  /**
   * Load data from IndexedDB (fast, no network)
   */
  async getLocalData(userId: string): Promise<AppData | null> {
    try {
      const db = await getDB();
      const entry = await db.get('appData', userId);
      if (entry) {
        console.log('[offlineService] Local data loaded');
        return entry.data;
      }
      console.log('[offlineService] No local data found');
      return null;
    } catch (e) {
      console.error('[offlineService] Error loading locally:', e);
      return null;
    }
  },

  /**
   * Clear local data for a user
   */
  async clearLocalData(userId: string): Promise<void> {
    try {
      const db = await getDB();
      await db.delete('appData', userId);
      console.log('[offlineService] Local data cleared');
    } catch (e) {
      console.error('[offlineService] Error clearing local data:', e);
    }
  },

  /**
   * Queue a save operation to be synced when back online
   */
  async addToSyncQueue(userId: string, data: AppData, label?: string): Promise<void> {
    try {
      const db = await getDB();
      await db.add('syncQueue', {
        userId,
        type: 'saveData' as const,
        data,
        label,
        timestamp: Date.now(),
      });
      console.log('[offlineService] Operation queued for sync');
    } catch (e) {
      console.error('[offlineService] Error queuing operation:', e);
    }
  },

  /**
   * Get all pending sync operations
   */
  async getSyncQueue(): Promise<SyncOperation[]> {
    try {
      const db = await getDB();
      const all = await db.getAll('syncQueue');
      // Sort by timestamp ascending (FIFO)
      all.sort((a, b) => a.timestamp - b.timestamp);
      return all;
    } catch (e) {
      console.error('[offlineService] Error reading sync queue:', e);
      return [];
    }
  },

  /**
   * Remove a completed sync operation from the queue
   */
  async removeFromSyncQueue(id: number): Promise<void> {
    try {
      const db = await getDB();
      await db.delete('syncQueue', id);
    } catch (e) {
      console.error('[offlineService] Error removing from sync queue:', e);
    }
  },

  /**
   * Clear all pending sync operations
   */
  async clearSyncQueue(): Promise<void> {
    try {
      const db = await getDB();
      await db.clear('syncQueue');
      console.log('[offlineService] Sync queue cleared');
    } catch (e) {
      console.error('[offlineService] Error clearing sync queue:', e);
    }
  },

  /**
   * Get the timestamp of the last local save
   */
  async getLastSyncTime(userId: string): Promise<number | null> {
    try {
      const db = await getDB();
      const entry = await db.get('appData', userId);
      return entry?.updatedAt ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Check if there are pending sync operations
   */
  async hasPendingSync(): Promise<boolean> {
    try {
      const queue = await this.getSyncQueue();
      return queue.length > 0;
    } catch {
      return false;
    }
  },
};
