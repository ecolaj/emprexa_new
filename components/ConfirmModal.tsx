
import React from 'react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info' | 'warning';
    icon?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    type = 'danger',
    icon = 'delete'
}) => {
    if (!isOpen) return null;

    const colors = {
        danger: {
            bg: 'bg-red-50',
            text: 'text-red-500',
            button: 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
        },
        warning: {
            bg: 'bg-amber-50',
            text: 'text-amber-500',
            button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
        },
        info: {
            bg: 'bg-primary/10',
            text: 'text-primary',
            button: 'bg-primary hover:bg-primary-dark shadow-primary/20'
        }
    };

    const activeColor = colors[type];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fade-in_0.3s_ease-out]"
                onClick={onClose}
            ></div>

            {/* Modal Card */}
            <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-[scale-in_0.2s_ease-out]">
                <div className="p-8 text-center">
                    <div className={`size-16 ${activeColor.bg} ${activeColor.text} rounded-full flex items-center justify-center mx-auto mb-6`}>
                        <span className="material-symbols-outlined text-3xl">{icon}</span>
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 mb-2 font-outfit">{title}</h2>
                    <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                        {description}
                    </p>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`w-full py-3 ${activeColor.button} text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2`}
                        >
                            {confirmText}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all"
                        >
                            {cancelText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
