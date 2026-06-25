import React from 'react';
import { Plus } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-gray-800/80">
          <h2 className="text-lg font-bold dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <div className="p-4 pb-24 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};
