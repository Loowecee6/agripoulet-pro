import React from 'react';
import { LayoutDashboard, ClipboardList, Box, Users, ShoppingCart, BarChart3, CalendarDays, Timer } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  permissions: string[];
}

export const BottomNav = ({ activeTab, onTabChange, permissions }: BottomNavProps) => {
  const allNavItems = [
    { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard, permission: null },
    { id: 'production', label: 'Prod.', icon: ClipboardList, permission: 'production.view' },
    { id: 'stock', label: 'Stock', icon: Box, permission: 'stock.view' },
    { id: 'clients', label: 'Client', icon: Users, permission: 'clients.view' },
    { id: 'ventes', label: 'Ventes', icon: ShoppingCart, permission: 'ventes.view' },
    { id: 'echeances', label: 'Échéanc.', icon: Timer, permission: 'ventes.view' },
    { id: 'reservations', label: 'Réserv.', icon: CalendarDays, permission: 'reservations.create' },
    { id: 'rapport', label: 'Bilan', icon: BarChart3, permission: 'rapports.view' },
  ];

  const navItems = allNavItems.filter(
    item => !item.permission || permissions.includes(item.permission)
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex overflow-x-auto gap-2 px-2 py-2 pb-safe z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] scroll-smooth snap-x">
      {navItems.map((item) => (
        <button
          key={item.id}
          data-tab={item.id}
          onClick={() => onTabChange(item.id)}
          className={`flex-shrink-0 flex flex-col items-center justify-center gap-1 p-2 min-w-[70px] rounded-xl transition-all snap-start ${activeTab === item.id ? 'text-orange-600 bg-orange-50' : 'text-gray-400'}`}
        >
          <item.icon className={`w-6 h-6 ${activeTab === item.id ? 'scale-110' : ''}`} />
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};
