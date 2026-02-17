import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { Logo } from './Logo';

export const AuthCallback: React.FC = () => {
    const { refreshUserData } = useAuth();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verificando credenciales...');

    useEffect(() => {
        const handleAuthCallback = async () => {
            try {
                console.log('🔐 [AuthCallback] Iniciando procesamiento...');

                // 1. Obtener sesión de Supabase
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) throw error;

                if (session) {
                    console.log('✅ Sesión confirmada para:', session.user.email);

                    // 2. DETECCIÓN POR METADATA (La forma más segura)
                    // Supabase limpia la URL, pero mantiene el evento en la sesión actual
                    const isRecoveryFlow =
                        window.location.hash.includes('type=recovery') ||
                        window.location.search.includes('type=recovery') ||
                        sessionStorage.getItem('is_recovery_active') === 'true';

                    console.log('🔍 Chequeo de flujo:', isRecoveryFlow ? 'RECUPERACIÓN' : 'NORMAL');

                    if (isRecoveryFlow) {
                        console.log('🔑 Redirigiendo a cambio de contraseña...');
                        sessionStorage.removeItem('is_recovery_active');

                        // REDIRECCIÓN LIMPIA A LA RUTA REAL
                        // Esto rompe el bucle de App.tsx que redirigía de '/' a '/feed'
                        window.location.href = '/reset-password';
                        return;
                    }

                    // 3. FLUJO NORMAL (Login)
                    console.log('🚀 Flujo normal detectado. Refrescando datos...');
                    await refreshUserData();

                    // Limpieza y salida
                    window.history.replaceState(null, '', '/');
                    window.location.href = '/';
                } else {
                    console.log('⚠️ No hay sesión activa. Verificando usuario...');
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        window.location.href = '/';
                    } else {
                        setStatus('error');
                        setMessage('No se pudo validar la sesión.');
                    }
                }
            } catch (err: any) {
                console.error('❌ Error crítico:', err);
                setStatus('error');
                setMessage(err.message || 'Error inesperado.');
            }
        };

        handleAuthCallback();
    }, [refreshUserData]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900 font-sans">
            <div className="w-full max-w-sm text-center">
                <Logo className="h-10 mx-auto mb-8" />
                <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100 italic">
                    <div className="flex flex-col items-center">
                        {status === 'loading' && (
                            <>
                                <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                                <p className="text-slate-500 animate-pulse text-sm">Sincronizando con Emprexa...</p>
                            </>
                        )}
                        {status === 'success' && (
                            <div className="text-indigo-600">
                                <span className="material-symbols-outlined text-4xl mb-2">lock_open</span>
                                <p className="font-bold">Acceso validado</p>
                            </div>
                        )}
                        {status === 'error' && (
                            <div className="text-red-500">
                                <span className="material-symbols-outlined text-4xl mb-2">error</span>
                                <p className="font-bold">Error de enlace</p>
                                <button onClick={() => window.location.href = '/'} className="mt-4 text-xs underline">Volver</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};