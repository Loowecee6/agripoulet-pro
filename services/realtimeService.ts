import { AppData, AppSettings, ProductionBatch, StockBatch, Client, Sale, Reservation, ActivityLogEntry } from '../types';
import { db } from './firebaseConfig';
import { doc, setDoc, getDoc, collection, getDocs, onSnapshot, deleteDoc, writeBatch, Unsubscribe } from 'firebase/firestore';
import { getDefaultData, sanitize } from './storageService';

type CollectionName = 'productionBatches' | 'stockBatches' | 'clients' | 'sales' | 'reservations';

const COLLECTION_NAMES: CollectionName[] = ['productionBatches', 'stockBatches', 'clients', 'sales', 'reservations'];

export function subscribeToAllCollections(
  onData: (data: AppData) => void,
  onError: (err: Error) => void
): () => void {
  const data: AppData = getDefaultData();
  let loaded = 0;
  const total = COLLECTION_NAMES.length + 1;
  let unsubscribed = false;

  const tryEmit = () => {
    if (!unsubscribed && loaded >= total) {
      onData({ ...data });
    }
  };

  const unsubs: Unsubscribe[] = [];

  for (const name of COLLECTION_NAMES) {
    const col = collection(db, name);
    unsubs.push(
      onSnapshot(col, (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        (data as any)[name] = docs;
        if (loaded < total) loaded++;
        tryEmit();
      }, (err) => {
        if (loaded < total) loaded++;
        onError(err);
      })
    );
  }

  unsubs.push(
    onSnapshot(doc(db, 'settings', 'singleton'), (snap) => {
      if (snap.exists()) {
        data.settings = snap.data() as AppSettings;
      }
      if (loaded < total) loaded++;
      tryEmit();
    }, (err) => {
      if (loaded < total) loaded++;
      onError(err);
    })
  );

  return () => {
    unsubscribed = true;
    for (const u of unsubs) u();
  };
}

export function writeChanges(oldData: AppData | null, newData: AppData): void {
  if (!oldData) return;

  const batch = writeBatch(db);
  let ops = 0;

  const addSet = (ref: any, data: any) => {
    if (ops < 500) { batch.set(ref, sanitize(data)); ops++; }
  };
  const addDelete = (ref: any) => {
    if (ops < 500) { batch.delete(ref); ops++; }
  };

  for (const name of COLLECTION_NAMES) {
    const oldArr: any[] = (oldData as any)[name] || [];
    const newArr: any[] = (newData as any)[name] || [];

    const oldMap = new Map(oldArr.map((e: any) => [e.id, e]));
    const newMap = new Map(newArr.map((e: any) => [e.id, e]));

    for (const entity of newArr) {
      const old = oldMap.get(entity.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(entity)) {
        addSet(doc(db, name, entity.id), entity);
      }
    }

    for (const [id] of oldMap) {
      if (!newMap.has(id)) {
        addDelete(doc(db, name, id));
      }
    }
  }

  if (JSON.stringify(oldData.settings) !== JSON.stringify(newData.settings)) {
    addSet(doc(db, 'settings', 'singleton'), newData.settings);
  }

  const oldLog = oldData.activityLog || [];
  const newLog = newData.activityLog || [];
  for (let i = oldLog.length; i < newLog.length; i++) {
    addSet(doc(db, 'activityLog', newLog[i].id), newLog[i]);
  }

  if (JSON.stringify(oldData.userPermissions) !== JSON.stringify(newData.userPermissions)) {
    addSet(doc(db, 'userPermissions', 'index'), newData.userPermissions || {});
  }

  if (JSON.stringify(oldData.fcmToken) !== JSON.stringify(newData.fcmToken) ||
      JSON.stringify(oldData.fcmPushFunctionUrl) !== JSON.stringify(newData.fcmPushFunctionUrl)) {
    addSet(doc(db, 'fcm', 'config'), {
      token: newData.fcmToken || '',
      pushFunctionUrl: newData.fcmPushFunctionUrl || '',
    });
  }

  if (ops > 0) {
    batch.commit().catch(err => {
      console.error('[realtime] Batch write failed:', err);
      // Afficher l'erreur à l'utilisateur pour le débogage
      const msg = err?.message || String(err || 'Erreur inconnue');
      alert('❌ Écriture Firestore échouée:\n' + msg);
    });
  }
}
