
import React from 'react';

interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, onClose, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]">
            <div
                className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-[scale-in_0.2s_ease-out]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-8 text-center">
                    <div className="size-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-3xl filled">check_circle</span>
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
                    <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                        {message}
                    </p>

                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all"
                    >
                        Continuar
                    </button>
                </div>
            </div>
        </div>
    );
};
