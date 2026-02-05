import React from 'react';
import { View } from '../types';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpgrade: () => void;
    title: string;
    description: string;
    planName?: string;
    icon?: string;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
    isOpen,
    onClose,
    onUpgrade,
    title,
    description,
    planName = "Premium",
    icon = "lock"
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fade-in_0.3s_ease-out]"
                onClick={onClose}
            ></div>

            {/* Modal Card */}
            <div className="relative bg-white w-full max-w-md rounded-[48px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500 border border-slate-100">
                <div className="absolute top-0 right-0 size-48 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[60px]"></div>

                <div className="p-10 text-center relative z-10">
                    <div className="size-20 bg-blue-50 text-blue-500 rounded-[28px] flex items-center justify-center mx-auto mb-8 shadow-inner rotate-6 group hover:rotate-0 transition-transform duration-500">
                        <span className="material-symbols-outlined text-4xl filled">{icon}</span>
                    </div>

                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-4">{title}</h3>
                    <p className="text-slate-500 mb-10 text-lg leading-relaxed">
                        {description}
                    </p>

                    <div className="space-y-4">
                        <button
                            onClick={() => {
                                onUpgrade();
                                onClose();
                            }}
                            className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black shadow-2xl hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all text-lg flex items-center justify-center gap-3"
                        >
                            <span className="material-symbols-outlined font-black">upgrade</span>
                            Subir a {planName}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors text-sm uppercase tracking-widest"
                        >
                            Tal vez luego
                        </button>
                    </div>
                </div>

                {/* Decorative element */}
                <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500"></div>
            </div>
        </div>
    );
};
