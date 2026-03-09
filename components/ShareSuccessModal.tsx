
import React from 'react';
import { useLanguage } from '../context/LanguageContext';

interface ShareSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    copiedUrl: string;
}

export const ShareSuccessModal: React.FC<ShareSuccessModalProps> = ({ isOpen, onClose, copiedUrl }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fade-in_0.3s_ease-out]"
                onClick={onClose}
            ></div>

            {/* Modal Card */}
            <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-[scale-in_0.2s_ease-out]">
                <div className="p-8 text-center">
                    {/* Icon */}
                    <div className="size-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-3xl filled">check_circle</span>
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 mb-2">{t('feed.linkCopied')}</h2>

                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                        {t('feed.linkCopiedDesc')}
                    </p>

                    {/* URL Preview */}
                    {copiedUrl && (
                        <div className="bg-slate-50 rounded-xl p-3 mb-6 text-left border border-slate-100">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">{t('feed.link')}</p>
                            <p className="text-sm text-slate-700 font-mono break-all line-clamp-2">{copiedUrl}</p>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full py-3.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                    >
                        {t('feed.understood')}
                    </button>
                </div>
            </div>
        </div>
    );
};
