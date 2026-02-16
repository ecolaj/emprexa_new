import React from 'react';
import { View } from '../types';
import { USERS } from '../constants';

export const renderBadge = (plan: string) => {
  switch (plan) {
    case 'basic':
      return <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Basic</span>;
    case 'pro':
      return (
        <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
          <span className="material-symbols-outlined text-[10px] filled">verified</span> Pro
        </span>
      );
    case 'enterprise':
      return (
        <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
          <span className="material-symbols-outlined text-[10px] filled">verified_user</span> Enterprise
        </span>
      );
    default:
      return null;
  }
};

export const renderContent = (text: string, navigate: (view: View, params?: any) => void, isDarkBackground?: boolean) => {
  if (!text) return null;

  // Regex to capture URLs, #hashtags, and @mentions
  const parts = text.split(/((?:https?:\/\/[^\s]+|www\.[^\s]+)|(?:#|@)[\wñÑáéíóúÁÉÍÓÚ]+)/g);

  const linkClass = isDarkBackground
    ? "text-white font-black underline hover:opacity-80 transition-opacity cursor-pointer"
    : "text-primary hover:underline cursor-pointer";

  const boldClass = isDarkBackground
    ? "text-white font-black underline hover:opacity-80 transition-opacity cursor-pointer"
    : "text-primary font-bold hover:underline cursor-pointer";

  return parts.map((part, i) => {
    // URL Check
    if (part.startsWith('http://') || part.startsWith('https://') || part.startsWith('www.')) {
      const url = part.startsWith('www.') ? `https://${part}` : part;
      return (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }

    // Hashtag Check
    if (part.startsWith('#')) {
      return (
        <span
          key={i}
          className={boldClass}
          onClick={(e) => {
            e.stopPropagation();
            navigate(View.HASHTAG, { tag: part });
          }}
        >
          {part}
        </span>
      );
    }

    // Mention Check
    if (part.startsWith('@')) {
      const username = part.slice(1);
      return (
        <span
          key={i}
          className={boldClass}
          onClick={(e) => {
            e.stopPropagation();
            // NAVEGACIÓN DIRECTA AL PERFIL: Usar el username (handle)
            navigate(View.PROFILE, { username });
          }}
        >
          {part}
        </span>
      );
    }

    return part;
  });
};
