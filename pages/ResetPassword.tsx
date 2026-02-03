import React, { useState, useEffect } from 'react';
import { View, NavProps } from '../types';
import { Logo } from '../components/Logo';
import { supabase } from '../utils/supabase';

export const ResetPassword: React.FC<NavProps> = ({ navigate }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isValidSession, setIsValidSession] = useState(false);

  useEffect(() => {
    const checkRecoverySession = async () => {
      setIsLoading(true);

      // PRIMERO: Verificar si hay token en la URL
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      const urlType = urlParams.get('type');

      if (urlToken && urlType === 'recovery') {
        console.log('🔐 Token recibido directamente en URL, redirigiendo a procesador...');

        // Redirigir a una página que procese el token
        window.location.href = `/process-recovery?token=${urlToken}&type=${urlType}`;
        setIsLoading(false);
        return;
      }

      try {
        console.log('🔐 ResetPassword: Verificando sesión de recovery...');

        // 1. Primero intentar obtener sesión actual
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('❌ Error obteniendo sesión:', sessionError);
          setMessage({
            type: 'error',
            text: 'Error al verificar la sesión. Por favor, solicita un nuevo enlace.'
          });
          setIsValidSession(false);
          return;
        }

        // 2. Si hay sesión, es válida
        if (session?.user) {
          console.log('✅ Sesión de recovery válida encontrada para:', session.user.email);
          setIsValidSession(true);
          setMessage(null);
          return;
        }

        // 3. Si NO hay sesión y hay hash #reset-password, esperar un momento
        if (window.location.hash === '#reset-password' && !session) {
          console.log('⏳ Esperando que la sesión se sincronice...');
          return;
        }

        // 4. Si no hay sesión y no hay hash, mostrar error
        console.log('⚠️ No hay sesión de recovery activa');
        setMessage({
          type: 'error',
          text: 'No hay una sesión de recuperación activa. Por favor, solicita un nuevo enlace desde el login.'
        });
        setIsValidSession(false);

      } catch (err: any) {
        console.error('❌ Error en checkRecoverySession:', err);
        setMessage({
          type: 'error',
          text: 'Error al procesar la solicitud. Intenta nuevamente.'
        });
        setIsValidSession(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkRecoverySession();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage({
        type: 'error',
        text: 'Las contraseñas no coinciden.'
      });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({
        type: 'error',
        text: 'La contraseña debe tener al menos 6 caracteres.'
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: '¡Contraseña actualizada exitosamente! Cerrando sesión para seguridad...'
      });

      // IMPORTANTE: Cerrar sesión después de cambiar contraseña
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate(View.LOGIN);
      }, 2000);

    } catch (err: any) {
      console.error('Error resetting password:', err);
      setMessage({
        type: 'error',
        text: err.message || 'Error al actualizar la contraseña.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Logo className="h-12 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-slate-900">Restablecer Contraseña</h1>
          <p className="text-slate-500 mt-2">
            {isValidSession
              ? 'Ingresa tu nueva contraseña'
              : 'Esperando validación...'
            }
          </p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-bold ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        {isValidSession ? (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-2">
                Nueva Contraseña
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700 block mb-2">
                Confirmar Contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Repite tu contraseña"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                  Actualizando...
                </>
              ) : (
                'Establecer Nueva Contraseña'
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate(View.LOGIN)}
              className="w-full py-3 text-slate-600 hover:text-slate-900 font-medium"
            >
              ← Volver al Login
            </button>
          </form>
        ) : (
          <div className="text-center p-8">
            <div className="size-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">link_off</span>
            </div>

            <p className="text-slate-600 mb-6">
              {message?.text || 'Validando enlace de recuperación...'}
            </p>

            {message?.type === 'error' && message.text.includes('expirado') && (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-slate-500 text-center">
                  ¿Necesitas un nuevo enlace?
                </p>
                <button
                  onClick={() => navigate(View.LOGIN)}
                  className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors"
                >
                  Volver al Login para solicitar nuevo enlace
                </button>
              </div>
            )}

            {(!message || !message.text.includes('expirado')) && (
              <button
                onClick={() => navigate(View.LOGIN)}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                Volver al Login
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};