import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { Logo } from './Logo';

export const AuthCallback: React.FC = () => {
    const { refreshUserData } = useAuth();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Procesando autenticación...');

    useEffect(() => {
        const handleAuthCallback = async () => {
            try {
                const hash = window.location.hash;
                const search = window.location.search;

                console.log('🔐 [AuthCallback] Iniciando procesamiento...');

                // 1. Obtener sesión actual (Supabase detecta los tokens en la URL automáticamente)
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('❌ Error obteniendo sesión:', sessionError);
                    setStatus('error');
                    setMessage('Error al validar la sesión. Por favor intenta de nuevo.');
                    return;
                }

                if (session) {
                    console.log('✅ Sesión confirmada para:', session.user.email);

                    // 2. Determinar si es un flujo de recuperación de contraseña
                    // IMPORTANTE: Buscamos rastros en la URL o en la bandera de emergencia que pusimos en Nivel 0
                    const isRecovery = hash.includes('type=recovery') ||
                        search.includes('type=recovery') ||
                        sessionStorage.getItem('is_recovery_active') === 'true';

                    if (isRecovery) {
                        console.log('🔑 MODO RECUPERACIÓN DETECTADO');
                        // Limpiamos rastros de emergencia
                        sessionStorage.removeItem('is_recovery_active');

                        // LIMPIEZA CRÍTICA: Borramos el pathname /auth/callback para no confundir a App.tsx
                        window.history.replaceState(null, '', '/');

                        // Redirigimos vía hash para activar ResetPassword.tsx
                        window.location.hash = 'reset-password';

                        setStatus('success');
                        setMessage('Redirigiendo a cambio de contraseña...');
                        return;
                    }

                    // 3. Flujo normal (Login o Verificación de email estándar)
                    console.log('🚀 Flujo normal detectado. Refrescando datos...');
                    await refreshUserData();
                    setStatus('success');
                    setMessage('¡Bienvenido! Redirigiendo...');

                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1500);
                } else {
                    console.log('⚠️ No hay sesión activa. Verificando usuario directo...');
                    const { data: { user } } = await supabase.auth.getUser();

                    if (user) {
                        window.location.href = '/';
                    } else {
                        setStatus('error');
                        setMessage('No se pudo encontrar una sesión válida.');
                    }
                }
            } catch (error: any) {
                console.error('❌ Error crítico en AuthCallback:', error);
                setStatus('error');
                setMessage(error.message || 'Ocurrió un error inesperado al procesar la sesión.');
            }
        };

        handleAuthCallback();
    }, [refreshUserData]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6 text-slate-800">
            <div className="w-full max-w-md text-center">
                <Logo className="h-12 mx-auto mb-8" />

                <div className="bg-white rounded-2xl p-8 shadow-xl border border-slate-200">
                    <div className="flex flex-col items-center">
                        {status === 'loading' && (
                            <>
                                <div className="size-14 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                                <h1 className="text-xl font-bold mb-2">Procesando</h1>
                                <p className="text-slate-500">{message}</p>
                            </>
                        )}

                        {status === 'success' && (
                            <>
                                <div className="size-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                                    <span className="material-symbols-outlined text-3xl">done_all</span>
                                </div>
                                <h1 className="text-xl font-bold mb-2">¡Todo listo!</h1>
                                <p className="text-slate-500">{message}</p>
                            </>
                        )}

                        {status === 'error' && (
                            <>
                                <div className="size-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                                    <span className="material-symbols-outlined text-3xl">warning</span>
                                </div>
                                <h1 className="text-xl font-bold mb-2">Algo salió mal</h1>
                                <p className="text-slate-500 mb-6">{message}</p>
                                <button
                                    onClick={() => window.location.href = '/'}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                                >
                                    Ir al Inicio
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};