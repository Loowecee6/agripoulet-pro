// src/components/common/QuickAddGrid.tsx
import React from 'react';

interface QuickAddGridProps {
  options: number[]; // price options in Francs
  onSelect: (price: number) => void;
}

export const QuickAddGrid: React.FC<QuickAddGridProps> = ({ options, onSelect }) => (
  <div className="grid grid-cols-3 gap-2">
    {options.map(opt => (
      <button
        key={opt}
        type="button"
        onClick={() => onSelect(opt)}
        className="bg-orange-100 text-orange-800 py-2 rounded-xl text-sm font-medium hover:bg-orange-200 transition"
      >
        {opt} F
      </button>
    ))}
  </div>
);
