import React from 'react';
import { getSdgInfo } from '../utils/sdgUtils';
import { View } from '../types';

interface SdgBadgeProps {
    sdgId: number;
    navigate: (view: View, params?: any) => void;
}

export const SdgBadge: React.FC<SdgBadgeProps> = ({ sdgId, navigate }) => {
    const sdg = getSdgInfo(sdgId);
    if (!sdg) return null;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(View.SDG_FEED, { id: sdg.id });
    };

    const handleTouch = (e: React.TouchEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(View.SDG_FEED, { id: sdg.id });
    };

    return (
        <button
            type="button"
            className="px-3 py-1 text-[10px] font-bold rounded-full border uppercase inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
            style={{
                backgroundColor: `${sdg.color}15`,
                color: sdg.color,
                borderColor: `${sdg.color}30`,
                WebkitTapHighlightColor: 'transparent'
            }}
            onClick={handleClick}
            onTouchStart={handleTouch}
        >
            <span className="material-symbols-outlined text-[14px]">{sdg.icon}</span> ODS {sdg.id}
        </button>
    );
};
