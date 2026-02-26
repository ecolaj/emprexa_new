import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { Logo } from './Logo';

export const AuthCallback: React.FC = () => {
    const { refreshUserData } = useAuth();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verificando credenciales...');
    const [errorType, setErrorType] = useState<string | null>(null);

    useEffect(() => {
        const handleAuthCallback = async () => {
            try {
                // 1. Revisar si la URL trae errores desde Supabase (como enlaces expirados)
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const searchParams = new URLSearchParams(window.location.search);

                const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
                const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');

                if (errorCode === 'otp_expired') {
                    setStatus('error');
                    setErrorType('otp_expired');
                    setMessage('Por medidas de seguridad, los enlaces de acceso solo duran un tiempo limitado y el tuyo ha caducado.');
                    return; // Terminamos aquí
                } else if (errorCode) {
                    setStatus('error');
                    const errorMessage = errorDesc ? decodeURIComponent(errorDesc).replace(/\+/g, ' ') : 'Hubo un error al verificar tu enlace.';
                    setMessage(`Error: ${errorMessage}`);
                    return;
                }

                console.log('🔐 [AuthCallback] Iniciando procesamiento...');

                // 2. Obtener sesión de Supabase
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
                            <div className="flex flex-col items-center">
                                {errorType === 'otp_expired' ? (
                                    <>
                                        <div className="bg-orange-100 text-orange-500 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                                            <span className="material-symbols-outlined text-4xl">hourglass_empty</span>
                                        </div>
                                        <h2 className="text-xl font-bold text-slate-800 mb-2">¡Tu enlace expiró!</h2>
                                        <p className="text-sm text-slate-600 mb-6 px-2 leading-relaxed">
                                            {message}
                                            <br /><br />
                                            <span className="font-medium text-slate-800">¡Pero no te preocupes!</span> Es muy fácil solucionarlo. Solo haz clic en el botón de abajo para ir a <strong>Iniciar Sesión</strong>, escribe de nuevo tu correo y así te enviaremos un enlace nuevo.
                                        </p>
                                        <button
                                            onClick={() => window.location.href = '/'}
                                            className="w-full py-3 bg-indigo-600 text-white rounded-full text-sm font-semibold hover:bg-indigo-700 transition shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-sm">login</span>
                                            Ir a Iniciar Sesión
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="bg-red-100 text-red-500 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                                            <span className="material-symbols-outlined text-4xl">error</span>
                                        </div>
                                        <p className="text-lg font-bold text-slate-800 mb-2">Vaya, algo salió mal</p>
                                        <p className="text-sm text-slate-600 mb-6 px-2">{message}</p>
                                        <button
                                            onClick={() => window.location.href = '/'}
                                            className="w-full py-3 bg-indigo-600 text-white rounded-full text-sm font-semibold hover:bg-indigo-700 transition shadow-md"
                                        >
                                            Ir a Iniciar Sesión
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};