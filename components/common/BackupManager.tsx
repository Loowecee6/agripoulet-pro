import React, { useState, useEffect } from 'react';
import { Database, RotateCcw, Trash2, Plus, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { AppData } from '../../types';
import { storageService } from '../../services/storageService';
import { useAuth } from './AuthProvider';

interface BackupManagerProps {
  currentData: AppData;
  onDataRestored: (data: AppData) => void;
}

export function BackupManager({ currentData, onDataRestored }: BackupManagerProps) {
  const { user } = useAuth();
  const [backups, setBackups] = useState<{ id: string; label: string; createdAt: string; data: AppData }[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'creating' | 'restoring' | 'deleting'>('idle');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadBackups = async () => {
    if (!user) return;
    setStatus('loading');
    try {
      const list = await storageService.listBackups(user.uid);
      setBackups(list);
    } catch (e) {
      console.error('Failed to load backups:', e);
    } finally {
      setStatus('idle');
    }
  };

  useEffect(() => {
    loadBackups();
  }, [user]);

  const handleCreateBackup = async () => {
    if (!user) return;
    setStatus('creating');
    try {
      const label = `Backup ${new Date().toLocaleString('fr-FR')}`;
      await storageService.createBackup(user.uid, currentData, label);
      await loadBackups();
      setMessage({ type: 'success', text: 'Sauvegarde créée !' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' });
    } finally {
      setStatus('idle');
    }
  };

  const handleRestore = async (backupId: string) => {
    if (!user || !confirm('Restaurer cette sauvegarde ? Les données actuelles seront remplacées.')) return;
    setStatus('restoring');
    try {
      const restored = await storageService.restoreBackup(user.uid, backupId);
      onDataRestored(restored);
      setMessage({ type: 'success', text: 'Données restaurées !' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur lors de la restauration' });
    } finally {
      setStatus('idle');
    }
  };

  const handleDelete = async (backupId: string) => {
    if (!user || !confirm('Supprimer cette sauvegarde ?')) return;
    setStatus('deleting');
    try {
      await storageService.deleteBackup(user.uid, backupId);
      await loadBackups();
    } catch (e) {
      console.error('Failed to delete backup:', e);
    } finally {
      setStatus('idle');
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-bold text-gray-900">Sauvegardes</h2>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={status === 'creating'}
          className="flex items-center gap-1 bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
        >
          {status === 'creating' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Sauvegarder
        </button>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg mb-3 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {status === 'loading' ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
        </div>
      ) : backups.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">Aucune sauvegarde. Créez-en une pour protéger vos données.</p>
      ) : (
        <div className="space-y-2">
          {backups.map(b => (
            <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{b.label}</p>
                <p className="text-xs text-gray-500">
                  {b.data.productionBatches?.length || 0} bandes · {b.data.clients?.length || 0} clients · {b.data.sales?.length || 0} ventes
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleRestore(b.id)}
                  disabled={status === 'restoring'}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Restaurer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(b.id)}
                  disabled={status === 'deleting'}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
