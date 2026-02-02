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

    return (
        <span
            className="px-3 py-1 text-[10px] font-bold rounded-full border uppercase flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
            style={{
                backgroundColor: `${sdg.color}15`,
                color: sdg.color,
                borderColor: `${sdg.color}30`
            }}
            onClick={(e) => {
                e.stopPropagation();
                navigate(View.SDG_FEED, { id: sdg.id });
            }}
        >
            <span className="material-symbols-outlined text-[14px]">{sdg.icon}</span> ODS {sdg.id}
        </span>
    );
};
