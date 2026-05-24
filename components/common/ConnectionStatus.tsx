// components/common/ConnectionStatus.tsx
import React from 'react';
import { Wifi, WifiOff, RefreshCw, CloudOff } from 'lucide-react';

interface ConnectionStatusProps {
  isOnline: boolean;
  isSyncing: boolean;
  hasPendingSync: boolean;
  pendingCount: number;
}

export const ConnectionStatus = ({ isOnline, isSyncing, hasPendingSync, pendingCount }: ConnectionStatusProps) => {
  const [showTooltip, setShowTooltip] = React.useState(false);

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
        <RefreshCw className="w-3 h-3 animate-spin" />
        <span>Synchronisation...</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div
        className="relative flex items-center gap-1.5 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <WifiOff className="w-3 h-3" />
        <span>Hors-ligne</span>
        {showTooltip && (
          <div className="absolute top-full mt-2 right-0 bg-gray-900 text-white text-xs rounded-lg p-2 shadow-xl z-50 whitespace-nowrap">
            Les données sont sauvegardées localement.<br />
            Elles seront synchronisées automatiquement.
          </div>
        )}
      </div>
    );
  }

  if (hasPendingSync) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
        <CloudOff className="w-3 h-3" />
        <span>{pendingCount} en attente</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
      <Wifi className="w-3 h-3" />
      <span>En ligne</span>
    </div>
  );
};
