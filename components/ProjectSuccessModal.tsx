
import React from 'react';
import { View } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface ProjectSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGoToProject: () => void;
    projectName: string;
    isEdit?: boolean;
}

export const ProjectSuccessModal: React.FC<ProjectSuccessModalProps> = ({
    isOpen,
    onClose,
    onGoToProject,
    projectName,
    isEdit = false
}) => {
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
                    {/* Celebration Icon */}
                    <div className={`size-24 ${isEdit ? 'bg-blue-50 text-blue-500' : 'bg-green-50 text-green-500'} rounded-full flex items-center justify-center mx-auto mb-6 relative`}>
                        <span className="material-symbols-outlined text-5xl filled animate-bounce">
                            {isEdit ? 'task_alt' : 'rocket_launch'}
                        </span>
                        <div className={`absolute inset-0 ${isEdit ? 'bg-blue-400' : 'bg-green-400'} rounded-full animate-ping opacity-20`}></div>
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                        {isEdit ? t('projectSuccessModal.editTitle') : t('projectSuccessModal.createTitle')}
                    </h2>

                    <p className="text-slate-500 text-sm mb-8 leading-relaxed font-medium">
                        {isEdit
                            ? t('projectSuccessModal.editDesc', { name: projectName })
                            : t('projectSuccessModal.createDesc', { name: projectName })}
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={onGoToProject}
                            className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined">visibility</span> {t('projectSuccessModal.viewProject')}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 text-sm transition-colors"
                        >
                            {t('projectSuccessModal.backToExplore')}
                        </button>
                    </div>
                </div>

                {/* Decorative confetti pattern placeholder or just a nice gradient */}
                <div className="h-2 w-full bg-gradient-to-r from-green-400 via-primary to-blue-500"></div>
            </div>
        </div>
    );
};
