import React, { useState } from 'react';
import { ClipboardList, CloudSync, ShieldCheck, Bell, LogOut, X, RefreshCw } from 'lucide-react';
import { User, Sale } from '../../types';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  notifications: Sale[];
  isSyncing: boolean;
}

export const Header = ({ user, onLogout, notifications, isSyncing }: HeaderProps) => {
  const [showNotifs, setShowNotifs] = useState(false);
  return (
    <header className="bg-orange-600 text-white p-4 shadow-lg sticky top-0 z-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold leading-none">AgriPoulet Pro</h1>
              {isSyncing ? (
                <RefreshCw className="w-3 h-3 animate-spin text-orange-200" />
              ) : (
                <CloudSync className="w-3 h-3 text-green-300" />
              )}
            </div>
            <p className="text-orange-200 text-[10px] mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> {user.name} ({user.role === 'admin' ? 'Administrateur' : 'Employé'})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative p-2 hover:bg-white/10 rounded-full" onClick={() => setShowNotifs(!showNotifs)}>
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-[10px] flex items-center justify-center rounded-full font-bold">
                {notifications.length}
              </span>
            )}
          </button>
          <button onClick={onLogout} className="p-2 hover:bg-white/10 rounded-full"><LogOut className="w-5 h-5" /></button>
        </div>
      </div>
      {showNotifs && notifications.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white shadow-2xl z-50 p-4 animate-in slide-in-from-top duration-200">
           <div className="flex justify-between items-center mb-3">
             <h3 className="text-gray-900 font-bold text-sm">Échéances de crédit</h3>
             <button onClick={() => setShowNotifs(false)}><X className="w-4 h-4 text-gray-400" /></button>
           </div>
           <div className="space-y-2 max-h-60 overflow-y-auto">
             {notifications.map(n => (
               <div key={n.id} className="p-3 bg-red-50 border border-red-100 rounded-xl flex justify-between items-center">
                 <div className="text-xs">
                   <div className="font-bold text-red-900">{n.clientNom}</div>
                   <div className="text-red-700">Dû le: {n.dueDate ? new Date(n.dueDate).toLocaleDateString() : '?'}</div>
                 </div>
                 <div className="font-black text-red-900">{n.total} Frs</div>
               </div>
             ))}
           </div>
         </div>
      )}
    </header>
  );
};
