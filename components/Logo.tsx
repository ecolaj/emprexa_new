
import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'icon';
  color?: 'colored' | 'white';
}

export const Logo: React.FC<LogoProps> = ({ className = "h-10", variant = 'full', color = 'colored' }) => {
  // Usar la imagen del logo
  if (variant === 'icon') {
    return <img src="/logo.png" alt="Emprexa Icon" className={`object-contain ${className}`} />;
  }

  // Logo completo con texto
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src="/logo.png" alt="Emprexa Logo" className="h-full w-auto aspect-square" />
      <span
        className={`font-black tracking-tight leading-none ${color === 'white' ? 'text-white' : 'text-slate-900'}`}
        style={{ fontSize: '1.5em' }}
      >
        Emprexa
      </span>
    </div>
  );
};
