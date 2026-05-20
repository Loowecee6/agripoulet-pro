// src/components/common/ToastContainer.tsx
import React from 'react';
import { ToastMessage } from '../../types';

const bgMap: Record<string, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
  warning: 'bg-yellow-600',
};

const iconMap: Record<string, React.ReactElement> = {
  success: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>,
  error: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>,
  info: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01"/></svg>,
  warning: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01"/></svg>,
};

export const ToastContainer: React.FC<{ toasts: ToastMessage[] }> = ({ toasts }) => (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 space-y-2 w-full max-w-md pointer-events-none">
    {toasts.map(t => (
      <div key={t.id}
        className={`flex items-center gap-2 px-4 py-2 text-white rounded-xl shadow-lg animate-fade-in ${bgMap[t.type]}`}
      >
        {iconMap[t.type]}
        <span className="font-medium text-sm">{t.text}</span>
      </div>
    ))}
  </div>
);
