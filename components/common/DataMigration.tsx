import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Loader2, Upload, Database } from 'lucide-react';
import { AppData } from '../../types';
import { storageService } from '../../services/storageService';
import { useAuth } from './AuthProvider';

// Common localStorage keys that might contain old data
const POSSIBLE_KEYS = [
  'agripoulet-data',
  'agripoulet-pro-data',
  'agripoulet-data-v1',
  'app-data',
  'productionBatches',
  'stockBatches',
  'agripoulet',
  'agripoulet-pro',
  'agriPouletData',
  'data',
];

export function DataMigration() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'migrating' | 'success' | 'error'>('idle');
  const [foundData, setFoundData] = useState<AppData | null>(null);
  const [foundKey, setFoundKey] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [scannedKeys, setScannedKeys] = useState<string[]>([]);

  const searchLocalStorage = () => {
    setStatus('searching');
    setScannedKeys([]);
    setError('');
    setFoundData(null);

    // Scan possible keys
    for (const key of POSSIBLE_KEYS) {
      setScannedKeys(prev => [...prev, key]);
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Validate it looks like AppData
          if (parsed.productionBatches || parsed.stockBatches || parsed.clients || parsed.sales) {
            setFoundData(parsed as AppData);
            setFoundKey(key);
            setStatus('found');
            return;
          }
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    // Also scan all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !POSSIBLE_KEYS.includes(key)) {
        setScannedKeys(prev => [...prev, key]);
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.productionBatches || parsed.stockBatches || parsed.clients || parsed.sales) {
              setFoundData(parsed as AppData);
              setFoundKey(key);
              setStatus('found');
              return;
            }
          }
        } catch {
          // skip
        }
      }
    }

    setStatus('idle');
    setError('Aucune donnée locale trouvée.');
  };

  const migrateData = async () => {
    if (!foundData || !user) return;
    setStatus('migrating');
    setError('');

    try {
      // Merge with existing cloud data
      const existingData = await storageService.loadData(user.uid);
      const merged: AppData = {
        productionBatches: [...(existingData.productionBatches || []), ...(foundData.productionBatches || [])],
        stockBatches: [...(existingData.stockBatches || []), ...(foundData.stockBatches || [])],
        clients: [...(existingData.clients || []), ...(foundData.clients || [])],
        sales: [...(existingData.sales || []), ...(foundData.sales || [])],
        settings: foundData.settings || existingData.settings,
      };

      await storageService.saveData(user.uid, merged);

      // Optionally clear old data
      try {
        localStorage.removeItem(foundKey);
      } catch {
        // ignore
      }

      setStatus('success');
    } catch (e) {
      setError('Erreur lors de la migration: ' + (e as Error).message);
      setStatus('error');
    }
  };

  const reset = () => {
    setStatus('idle');
    setFoundData(null);
    setFoundKey('');
    setError('');
    setScannedKeys([]);
  };

  if (!user) return null;

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-5 h-5 text-orange-600" />
        <h2 className="text-lg font-bold text-gray-900">Récupération des données</h2>
      </div>

      {status === 'idle' && (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Cette fonction recherche d'anciennes données stockées localement sur ce dispositif et les transfère vers votre compte cloud.
          </p>
          <button
            onClick={searchLocalStorage}
            className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-orange-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Rechercher mes anciennes données
          </button>
        </div>
      )}

      {status === 'searching' && (
        <div className="flex flex-col items-center py-4">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin mb-3" />
          <p className="text-sm text-gray-600">Recherche en cours...</p>
          <div className="mt-2 text-xs text-gray-400 max-h-20 overflow-y-auto w-full">
            {scannedKeys.map(k => <div key={k}>→ {k}</div>)}
          </div>
        </div>
      )}

      {status === 'found' && foundData && (
        <div>
          <div className="flex items-center gap-2 mb-3 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Données trouvées !</span>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
            <p className="font-medium text-gray-700 mb-2">Contenu trouvé :</p>
            <ul className="space-y-1 text-gray-600">
              <li>🐣 Bandes : {foundData.productionBatches?.length || 0}</li>
              <li>📦 Lots stock : {foundData.stockBatches?.length || 0}</li>
              <li>👥 Clients : {foundData.clients?.length || 0}</li>
              <li>💰 Ventes : {foundData.sales?.length || 0}</li>
            </ul>
            <p className="text-xs text-gray-400 mt-2">Clé : {foundKey}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={migrateData}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Importer
            </button>
          </div>
        </div>
      )}

      {status === 'migrating' && (
        <div className="flex flex-col items-center py-4">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin mb-3" />
          <p className="text-sm text-gray-600">Migration en cours...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center py-4">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="font-semibold text-green-700 mb-1">Migration réussie !</p>
          <p className="text-sm text-gray-600 mb-4">Vos données ont été transférées vers le cloud.</p>
          <button
            onClick={reset}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
          >
            Fermer
          </button>
        </div>
      )}

      {(status === 'idle' || status === 'error') && error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg mb-3">
          <AlertTriangle className="w-4 h-4" />
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
