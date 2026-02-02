import React, { useEffect, useState } from 'react';
import { User, ID } from '../types';
import { renderBadge } from '../utils/renderers';

interface MentionDropdownProps {
    suggestions: User[];
    onSelect: (user: User) => void;
    position: { top: number; left: number };
    activeIndex: number;
}

export const MentionDropdown: React.FC<MentionDropdownProps> = ({ suggestions, onSelect, position, activeIndex }) => {
    if (suggestions.length === 0) return null;

    return (
        <div
            className="fixed z-[100] bg-white border border-slate-200 rounded-xl shadow-2xl py-2 w-64 max-h-60 overflow-y-auto animate-[fade-in_0.1s_ease-out]"
            style={{
                top: position.top,
                left: Math.min(position.left, window.innerWidth - 280) // Prevent overflow right
            }}
        >
            <div className="px-3 py-1 mb-1 border-b border-slate-50">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sugerencias</span>
            </div>
            {suggestions.map((user, index) => (
                <div
                    key={user.id}
                    onClick={() => onSelect(user)}
                    className={`px-3 py-2 flex items-center gap-3 cursor-pointer transition-colors ${index === activeIndex ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                >
                    <div
                        className="size-8 rounded-full bg-cover bg-center border border-slate-100"
                        style={{ backgroundImage: `url("${user.avatar}")` }}
                    ></div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-xs truncate">{user.name}</p>
                            {renderBadge(user.plan || 'free')}
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">{user.role}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};
