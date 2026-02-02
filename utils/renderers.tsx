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

export const renderContent = (text: string, navigate: (view: View, params?: any) => void) => {
  // Regex modified to capture both #hashtags and @mentions
  const parts = text.split(/((?:#|@)[\wñÑáéíóúÁÉÍÓÚ]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('#')) {
      return (
        <span
          key={i}
          className="text-primary font-bold cursor-pointer hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            navigate(View.HASHTAG, { tag: part });
          }}
        >
          {part}
        </span>
      );
    }
    if (part.startsWith('@')) {
      const username = part.slice(1);
      return (
        <span
          key={i}
          className="text-primary font-bold cursor-pointer hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            // Look for user by name (mock logic since we don't have handles yet)
            const user = USERS.find(u => u.name.toLowerCase().replace(/\s/g, '') === username.toLowerCase());
            if (user) {
              navigate(View.PROFILE, { userId: user.id });
            }
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
};
