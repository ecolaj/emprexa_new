import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { Logo } from './Logo';

export const AuthCallback: React.FC = () => {
    const { refreshUserData } = useAuth();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Procesando autenticación...');
    const [debugInfo, setDebugInfo] = useState<string>('');

    useEffect(() => {
        const handleAuthCallback = async () => {
            try {
                // Obtener información de la URL
                const hash = window.location.hash;
                const search = window.location.search;
                const fullUrl = window.location.href;

                setDebugInfo(`URL: ${fullUrl}\nHash: ${hash}\nSearch: ${search}`);
                console.log('🔐 URL completa:', fullUrl);
                console.log('🔐 Hash:', hash);
                console.log('🔐 Search:', search);

                // ========== MANEJAR RECOVERY PRIMERO ==========
                if (hash && hash.includes('type=recovery')) {
                    console.log('🔐 RECOVERY CALLBACK DETECTADO - Procesando...');

                    // 1. Procesar la sesión de recovery
                    const { data: { session }, error } = await supabase.auth.getSession();

                    if (error) {
                        console.error('❌ Error en recovery session:', error);
                        setStatus('error');
                        setMessage('Error en recuperación de contraseña');
                        setTimeout(() => {
                            window.location.href = '/reset-password';
                        }, 2000);
                        return;
                    }

                                    if (session) {
                    console.log('✅ Recovery session válida para:', session.user.email);

                    // Mostrar mensaje de éxito y redirigir INMEDIATAMENTE
                    setStatus('success');
                    setMessage('Redirigiendo a cambio de contraseña...');

                    // Redirigir INMEDIATAMENTE sin delay
                    // Usar location.replace para no guardar en historial
                    window.location.replace('/#reset-password');
                    return;
                    } else {
                        console.log('⚠️ No hay sesión en recovery callback');
                        // Aún así redirigir a reset-password
                        setStatus('loading');
                        setMessage('Redirigiendo...');
                        setTimeout(() => {
                            window.location.href = '/reset-password';
                        }, 1000);
                        return;
                    }
                }
                // ========== FIN MANEJAR RECOVERY ==========

                // Verificar si hay un hash en la URL (callback de Supabase)
                if (hash) {
                    console.log('🔐 Procesando callback de Supabase:', hash.substring(0, 50) + '...');
                }

                // Intentar obtener la sesión (Supabase maneja el hash automáticamente)
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('❌ Error obteniendo sesión en callback:', sessionError);
                    setStatus('error');
                    setMessage('Error al procesar la autenticación. Intenta nuevamente.');
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 3000);
                    return;
                }

                if (session) {
                    console.log('✅ Sesión confirmada para:', session.user.email);
                    console.log('📧 Email confirmado:', session.user.email_confirmed_at);

                    // Refrescar datos del usuario
                    await refreshUserData();

                    setStatus('success');
                    setMessage('¡Autenticación exitosa! Redirigiendo...');

                    // Redirigir al feed después de 2 segundos
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 2000);
                } else {
                    console.log('⚠️ No se encontró sesión en el callback');

                    // Intentar obtener el usuario directamente
                    const { data: { user } } = await supabase.auth.getUser();
                    console.log('👤 Usuario obtenido:', user?.email);

                    if (user) {
                        setStatus('success');
                        setMessage('Cuenta verificada. Redirigiendo...');

                        setTimeout(() => {
                            window.location.href = '/';
                        }, 2000);
                    } else {
                        setStatus('error');
                        setMessage('No se pudo completar la verificación. Intenta iniciar sesión.');

                        setTimeout(() => {
                            window.location.href = '/';
                        }, 3000);
                    }
                }
            } catch (error: any) {
                console.error('❌ Error en AuthCallback:', error);
                setStatus('error');
                setMessage(`Error: ${error.message || 'Ocurrió un error inesperado'}`);

                setTimeout(() => {
                    window.location.href = '/';
                }, 3000);
            }
        };

        handleAuthCallback();
    }, [refreshUserData]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <Logo className="h-12 mx-auto mb-6" />
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">
                        {status === 'loading' && 'Procesando...'}
                        {status === 'success' && '¡Éxito!'}
                        {status === 'error' && 'Error'}
                    </h1>
                    <p className="text-slate-600 mb-4">{message}</p>

                    {debugInfo && process.env.NODE_ENV === 'development' && (
                        <div className="mt-4 p-3 bg-slate-100 rounded-lg text-left">
                            <p className="text-xs font-mono text-slate-500 break-all">{debugInfo}</p>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200">
                    <div className="flex flex-col items-center">
                        {status === 'loading' && (
                            <>
                                <div className="size-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-6"></div>
                                <p className="text-slate-500 text-sm">
                                    {message.includes('recovery') || message.includes('recuperación')
                                        ? 'Procesando recuperación de contraseña...'
                                        : 'Procesando verificación de cuenta...'
                                    }
                                </p>
                            </>
                        )}

                        {status === 'success' && (
                            <>
                                <div className="size-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                                    <span className="material-symbols-outlined text-3xl">check_circle</span>
                                </div>
                                <p className="text-slate-600 text-center">
                                    {message.includes('recovery') || message.includes('recuperación')
                                        ? '¡Listo para cambiar tu contraseña!'
                                        : '¡Tu cuenta ha sido verificada exitosamente!'
                                    }
                                </p>
                                <p className="text-slate-500 text-sm mt-2 text-center">
                                    Serás redirigido automáticamente...
                                </p>
                            </>
                        )}

                        {status === 'error' && (
                            <>
                                <div className="size-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                                    <span className="material-symbols-outlined text-3xl">error</span>
                                </div>
                                <p className="text-slate-600 text-center mb-6">
                                    {message}
                                </p>
                                <button
                                    onClick={() => window.location.href = '/'}
                                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                                >
                                    Volver al inicio
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="mt-8 text-center text-sm text-slate-400">
                    <p>Si no eres redirigido automáticamente, haz clic <a href="/" className="text-primary font-bold hover:underline">aquí</a>.</p>
                </div>
            </div>
        </div>
    );
};