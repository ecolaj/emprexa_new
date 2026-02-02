import React, { useState } from 'react';

interface AccountActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDeactivate: () => void;
    onDelete: () => void;
}

export const AccountActionModal: React.FC<AccountActionModalProps> = ({ isOpen, onClose, onDeactivate, onDelete }) => {
    const [step, setStep] = useState<'selection' | 'confirm_deactivate' | 'confirm_delete'>('selection');

    if (!isOpen) return null;

    const renderContent = () => {
        switch (step) {
            case 'selection':
                return (
                    <>
                        <div className="p-6 text-center border-b border-slate-100">
                            <div className="size-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                                <span className="material-symbols-outlined text-3xl">no_accounts</span>
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 mb-2 font-outfit">Gestión de Cuenta</h2>
                            <p className="text-sm text-slate-500">¿Quieres tomarte un descanso o despedirte para siempre?</p>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Deactivate Option */}
                            <button
                                onClick={() => setStep('confirm_deactivate')}
                                className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-primary hover:bg-primary/5 transition-all group"
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-slate-900 font-outfit">Desactivar Cuenta (Temporal)</span>
                                    <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">pause_circle</span>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed">Tu perfil y contenido se ocultarán. Podrás recuperar todo simplemente volviendo a iniciar sesión.</p>
                            </button>

                            {/* Delete Option */}
                            <button
                                onClick={() => setStep('confirm_delete')}
                                className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-red-500 hover:bg-red-50 transition-all group"
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-slate-900 font-outfit">Eliminar Cuenta (Permanente)</span>
                                    <span className="material-symbols-outlined text-slate-400 group-hover:text-red-500 transition-colors">delete_forever</span>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed">Borraremos tus datos personales. Tus contribuciones se anonimizarán bajo "Ex-miembro de Emprexa". No hay marcha atrás.</p>
                            </button>
                        </div>

                        <div className="p-4 bg-slate-50 flex justify-center">
                            <button onClick={onClose} className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Tal vez después</button>
                        </div>
                    </>
                );

            case 'confirm_deactivate':
                return (
                    <div className="p-8 text-center animate-[fade-in_0.2s_ease-out]">
                        <h3 className="text-2xl font-black text-slate-900 mb-4 font-outfit">¿Confirmas la desactivación?</h3>
                        <p className="text-sm text-slate-600 mb-8 leading-relaxed">
                            Al confirmar, cerraremos tu sesión y tu rastro será invisible para otros miembros de la comunidad hasta que decidas regresar.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={onDeactivate}
                                className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
                            >
                                Desactivar mi cuenta
                            </button>
                            <button
                                onClick={() => setStep('selection')}
                                className="w-full py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all"
                            >
                                Volver atrás
                            </button>
                        </div>
                    </div>
                );

            case 'confirm_delete':
                return (
                    <div className="p-8 text-center animate-[fade-in_0.2s_ease-out]">
                        <h3 className="text-2xl font-black text-red-600 mb-4 font-outfit">¡Atención! Acción irreversible</h3>
                        <p className="text-sm text-slate-600 mb-8 leading-relaxed">
                            Estás a punto de borrar permanentemente tu rastro personal. Tus proyectos y posts se mantendrán pero de forma **anónima**. ¿Estás totalmente seguro?
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={onDelete}
                                className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                            >
                                Sí, eliminar para siempre
                            </button>
                            <button
                                onClick={() => setStep('selection')}
                                className="w-full py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all"
                            >
                                No, mejor solo desactivar
                            </button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fade-in_0.3s_ease-out]"
                onClick={onClose}
            ></div>

            {/* Modal Card */}
            <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-[scale-in_0.2s_ease-out]">
                {renderContent()}
            </div>
        </div>
    );
};
