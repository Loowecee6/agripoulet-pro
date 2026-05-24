import React from 'react';
import { LayoutDashboard, ClipboardList, Box, Users, ShoppingCart, BarChart3, CalendarDays, Timer } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const navItems = [
    { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
    { id: 'production', label: 'Prod.', icon: ClipboardList },
    { id: 'stock', label: 'Stock', icon: Box },
    { id: 'clients', label: 'Client', icon: Users },
    { id: 'ventes', label: 'Ventes', icon: ShoppingCart },
    { id: 'echeances', label: 'Échéanc.', icon: Timer },
    { id: 'reservations', label: 'Réserv.', icon: CalendarDays },
    { id: 'rapport', label: 'Bilan', icon: BarChart3 },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 pb-safe z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => (
        <button
          key={item.id}
          data-tab={item.id}
          onClick={() => onTabChange(item.id)}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === item.id ? 'text-orange-600' : 'text-gray-400'}`}
        >
          <item.icon className={`w-6 h-6 ${activeTab === item.id ? 'scale-110' : ''}`} />
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};
