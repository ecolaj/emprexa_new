
import React from 'react';

interface ComingSoonModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
    icon?: string;
}

export const ComingSoonModal: React.FC<ComingSoonModalProps> = ({
    isOpen,
    onClose,
    title = "Próximamente",
    message = "Esta funcionalidad estará disponible muy pronto para usuarios Enterprise.",
    icon = "rocket_launch"
}) => {
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
                    <div className="size-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-4xl filled">{icon}</span>
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">{title}</h2>

                    <p className="text-slate-500 text-sm mb-8 leading-relaxed font-medium">
                        {message}
                    </p>

                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 hover:-translate-y-0.5 active:translate-y-0"
                    >
                        Entendido
                    </button>

                    <p className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Emprexa Enterprise
                    </p>
                </div>
            </div>
        </div>
    );
};
