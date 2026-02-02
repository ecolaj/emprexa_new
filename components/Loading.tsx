
import React from 'react';

export const Loading: React.FC = () => (
  <div className="flex items-center justify-center h-full w-full bg-slate-50">
    <div className="flex flex-col items-center gap-4">
      <div className="relative size-12">
        <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
      <p className="text-slate-400 text-sm font-bold animate-pulse">Cargando...</p>
    </div>
  </div>
);
