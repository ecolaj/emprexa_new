
import React from 'react';
import { useLanguage } from '../context/LanguageContext';

interface LogoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]">
            <div
                className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-[scale-in_0.2s_ease-out]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-8 text-center">
                    <div className="size-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-3xl">logout</span>
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 mb-2">{t('logoutModal.title')}</h2>
                    <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                        {t('logoutModal.subtitle')}
                    </p>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={onConfirm}
                            className="w-full py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                        >
                            {t('logoutModal.confirm')}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            {t('logoutModal.cancel')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
