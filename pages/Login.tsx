import React, { useState, useEffect } from 'react';
import { View, NavProps } from '../types';
import { SDGS, POSTS, PROJECTS } from '../constants';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { getAuthRedirectUrl, getPasswordResetUrl, getBaseUrl } from '../utils/environment';

// TEST TEMPORAL - ELIMINAR DESPUÉS
console.log('🔧 Environment test:', {
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  authUrl: getAuthRedirectUrl(),
  resetUrl: getPasswordResetUrl()
});

// Estructura para el estado de la imagen
interface BackgroundState {
  url: string;
  sdgId: number;
  loaded: boolean;
}

const IMAGES_BY_SDG: Record<number, string[]> = {
  1: [
    "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1593113598332-cd288d649433?q=80&w=2070&auto=format&fit=crop"
  ],
  2: [
    "https://images.unsplash.com/photo-1595841696677-6489ff3f8cd1?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1621451537084-482c73073a0f?q=80&w=1974&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=2069&auto=format&fit=crop"
  ],
  3: [
    "https://images.unsplash.com/photo-1571772996211-2f02c9727629?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?q=80&w=2089&auto=format&fit=crop"
  ],
  4: [
    "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=2018&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=2073&auto=format&fit=crop"
  ],
  5: [
    "https://images.unsplash.com/photo-1573164713988-8665fc963095?q=80&w=2069&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1590650516494-0c8e4a4dd67e?q=80&w=2071&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1607748862156-7c548e7e98f4?q=80&w=2070&auto=format&fit=crop"
  ],
  6: [
    "https://images.unsplash.com/photo-1520699918507-3c3e05c46b90?q=80&w=1974&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1538300342682-cf57afb97285?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1617155093730-a8bf47be792d?q=80&w=2070&auto=format&fit=crop"
  ],
  7: [
    "https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=2072&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1466611653911-95081537e5b7?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?q=80&w=1974&auto=format&fit=crop"
  ],
  8: [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?q=80&w=2072&auto=format&fit=crop"
  ],
  9: [
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=2049&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop"
  ],
  10: [
    "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=1974&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1573497620053-ea5300f94f21?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=2070&auto=format&fit=crop"
  ],
  11: [
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=2144&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1449824913929-49aa7115669f?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1445964047600-cdbdb873673d?q=80&w=2000&auto=format&fit=crop"
  ],
  12: [
    "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=1974&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1605600659908-0ef719419d41?q=80&w=2073&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1526951521990-620dc14c2103?q=80&w=1978&auto=format&fit=crop"
  ],
  13: [
    "https://images.unsplash.com/photo-1611273426761-53c8577a3c18?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=2074&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1620121692029-d088224ddc74?q=80&w=2000&auto=format&fit=crop"
  ],
  14: [
    "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1582967788606-a171f1080ca8?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop"
  ],
  15: [
    "https://images.unsplash.com/photo-1448375240586-dfd8d395ea6c?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1502082553048-f009c37129b9?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=2070&auto=format&fit=crop"
  ],
  16: [
    "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1575505586569-646b2ca898fc?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1555374018-13a8994ab246?q=80&w=1915&auto=format&fit=crop"
  ],
  17: [
    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=2084&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=2069&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=2032&auto=format&fit=crop"
  ]
};

export const Login: React.FC<NavProps> = ({ navigate }) => {
  const { login, isLoading } = useAuth(); // Use Auth Context
  const [background, setBackground] = useState<BackgroundState | null>(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isPasswordResetSent, setIsPasswordResetSent] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isSdgModalOpen, setIsSdgModalOpen] = useState(false);
  const [isEmprexaModalOpen, setIsEmprexaModalOpen] = useState(false);
  const [selectedSdg, setSelectedSdg] = useState<typeof SDGS[0] | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerMessage, setRegisterMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Controlled Inputs
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register Form State
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false
  });

  // Forgot Password State
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');

  const isRegisterValid =
    registerData.name.trim() !== '' &&
    registerData.email.trim() !== '' &&
    registerData.password.trim() !== '' &&
    registerData.password === registerData.confirmPassword &&
    registerData.acceptedTerms;

  useEffect(() => {
    const randomSdgId = Math.floor(Math.random() * 17) + 1;
    const imagesForSdg = IMAGES_BY_SDG[randomSdgId] || IMAGES_BY_SDG[13];
    const randomUrl = imagesForSdg[Math.floor(Math.random() * imagesForSdg.length)];

    setBackground({
      sdgId: randomSdgId,
      url: randomUrl,
      loaded: false
    });
  }, []);

  const handleImageLoad = () => {
    if (background) {
      setBackground({ ...background, loaded: true });
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(loginEmail, loginPassword);
    } catch (err: any) {
      setLoginError(err.message || "Error al iniciar sesión");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRegisterValid) return;

    setRegisterLoading(true);
    setRegisterMessage(null);

    try {
      // 1. Create user in Supabase Auth CON REDIRECCIÓN
      const { data, error } = await supabase.auth.signUp({
        email: registerData.email,
        password: registerData.password,
        options: {
          data: {
            name: registerData.name
          },
          emailRedirectTo: getAuthRedirectUrl()
        }
      });

      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            name: registerData.name,
            email: registerData.email,
            role: 'Agente de Cambio',
            avatar: 'https://cdn-icons-png.flaticon.com/512/847/847969.png',
            plan: 'free',
            status: 'onboarding'
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
        }
      }

      setRegisterMessage({
        type: 'success',
        text: `¡Cuenta creada exitosamente! Se ha enviado un email de confirmación a ${registerData.email}. Revisa tu bandeja de entrada (y spam) para confirmar tu cuenta.`
      });

      setRegisterData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        acceptedTerms: false
      });

      setTimeout(() => {
        setIsRegisterOpen(false);
        setRegisterMessage(null);
      }, 5000);

    } catch (err: any) {
      console.error('Registration error:', err);
      setRegisterMessage({
        type: 'error',
        text: err.message || 'Error al crear la cuenta. Intenta nuevamente.'
      });
    } finally {
      setRegisterLoading(false);
    }
  };

    const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!forgotPasswordEmail) {
      setIsPasswordResetSent(true);
      return;
    }

    try {
      // IMPORTANTE: Usar hash para que App.tsx lo detecte
      const baseUrl = getBaseUrl();
      const redirectUrl = `${baseUrl}/#reset-password`;
      
      console.log('📧 Enviando email de recuperación a:', forgotPasswordEmail);
      console.log('🔗 URL de redirección:', redirectUrl);
      
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      setIsForgotPasswordOpen(false);
      setIsPasswordResetSent(true);

    } catch (err: any) {
      console.error('Password reset error:', err);

      // Cerrar modal de olvidé contraseña
      setIsForgotPasswordOpen(false);

      // Manejo especial para rate limit en desarrollo
      if (err.message.includes('rate limit') && import.meta.env.DEV) {
        setLoginError(`
        ⚠️ Límite de emails alcanzado (modo desarrollo)
        
        Para continuar pruebas:
        1. Ve directamente a: ${getBaseUrl()}/#reset-password
        2. O espera 1 hora
        
        Email ingresado: ${forgotPasswordEmail}
      `);
      } else {
        setLoginError('Error al enviar el enlace: ' + err.message);
      }
    }
  };

  const activeSdgInfo = background ? SDGS.find(s => s.id === background.sdgId) : null;

  return (
    <div className="flex min-h-screen w-full flex-row">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-7/12 relative flex-col justify-between p-12 bg-slate-900 overflow-hidden group">

        {/* --- BACKGROUND LOGIC --- */}
        {background && (
          <>
            <div
              className="absolute inset-0 z-0 bg-gradient-to-br from-slate-800 to-slate-900"
              style={{ backgroundColor: activeSdgInfo?.color || '#0f172a' }}
            ></div>

            <img
              src={background.url}
              alt="SDG Background"
              className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-1000 ${background.loaded ? 'opacity-100' : 'opacity-0 scale-100'}`}
              onLoad={handleImageLoad}
              style={{
                transition: 'opacity 1.5s ease-in-out',
                animation: background.loaded ? 'subtle-zoom 20s ease-out forwards' : 'none'
              }}
            />
          </>
        )}

        <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-900 via-slate-900/60 to-slate-900/20 mix-blend-multiply opacity-90"></div>
        <div className="absolute inset-0 z-10 bg-black/10"></div>

        <div className="relative z-20 flex justify-between items-start">
          <Logo color="white" className="h-12" />

          {activeSdgInfo && (
            <div className={`flex flex-col items-end transition-all duration-700 ${background?.loaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-2xl text-white shadow-lg transition-transform hover:scale-105">
                <div className="text-right">
                  <span className="block text-[10px] font-bold uppercase tracking-widest opacity-80">Objetivo {activeSdgInfo.id}</span>
                  <span className="block text-sm font-bold leading-none">{activeSdgInfo.short}</span>
                </div>
                <div className="w-px h-8 bg-white/20"></div>
                <span className="material-symbols-outlined text-3xl">{activeSdgInfo.icon}</span>
              </div>
            </div>
          )}
        </div>

        <div className="relative z-20">
          <div className="max-w-xl mb-12 animate-[fade-in_0.8s_ease-out]">
            <div className="h-1 w-20 bg-primary mb-6 rounded-full shadow-[0_0_15px_rgba(53,158,255,0.6)]"></div>
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight mb-4 drop-shadow-lg">
              Impulsando el cambio global, <br />
              <span className="text-primary-300">una conexión a la vez.</span>
            </h1>
            <p className="text-lg text-slate-200 font-medium leading-relaxed opacity-90 drop-shadow-md">
              Únete a la red más grande de emprendedores dedicados a los Objetivos de Desarrollo Sostenible de la ONU.
            </p>
          </div>

          <div className="flex justify-between items-end border-t border-white/10 pt-4 text-white/40 text-[10px] font-medium uppercase tracking-widest">
            <span>© Emprexa 2026</span>
            <span className="flex items-center gap-1">
              Fotos via Unsplash
            </span>
          </div>
        </div>
      </div>

      {/* Right Panel: Form */}
      <div className="flex w-full lg:w-5/12 flex-col justify-center items-center bg-white p-6 sm:p-12 relative z-30 shadow-2xl">
        <div className="w-full max-w-[400px] flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Bienvenido de nuevo</h2>
            <p className="text-slate-500 text-base">Ingresa tus datos para continuar impactando.</p>
          </div>

          <form className="flex flex-col gap-5" onSubmit={handleLoginSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Correo electrónico</label>
              <div className="relative">
                <input
                  type="email"
                  className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                  placeholder=""
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-slate-700">Contraseña</label>
                <button type="button" onClick={() => setIsForgotPasswordOpen(true)} className="text-xs font-bold text-primary hover:underline">¿Olvidaste tu contraseña?</button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                  placeholder=""
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary py-3.5 px-6 text-sm font-bold text-white shadow-lg shadow-primary/25 hover:bg-primary-dark transition-all duration-200 mt-2 disabled:opacity-70"
            >
              {isLoading ? (
                <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
              ) : (
                <>
                  <span>Iniciar Sesión</span>
                  <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center text-sm text-slate-500">
            ¿No tienes cuenta? <button onClick={() => setIsRegisterOpen(true)} className="text-primary font-bold hover:underline">Regístrate gratis</button>
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setIsSdgModalOpen(true)}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
              ¿Qué son los ODS?
            </button>
            <button
              onClick={() => setIsEmprexaModalOpen(true)}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-primary">info</span>
              ¿Qué es Emprexa?
            </button>
          </div>
        </div>
      </div>

      {/* --- MODAL: REGISTRATION --- */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-[fade-in_0.2s_ease-out] flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-bold text-slate-900 text-lg">Crear Cuenta Nueva</h3>
              <button onClick={() => setIsRegisterOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {registerMessage && (
                <div className={`mb-4 p-4 rounded-xl text-sm font-bold ${registerMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {registerMessage.text}
                </div>
              )}
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                    placeholder="Ej. Ana García"
                    value={registerData.name}
                    onChange={e => setRegisterData({ ...registerData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                    placeholder="ana@ejemplo.com"
                    value={registerData.email}
                    onChange={e => setRegisterData({ ...registerData, email: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-slate-700 block mb-1">Contraseña</label>
                    <input
                      type="password"
                      required
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                      placeholder="••••••••"
                      value={registerData.password}
                      onChange={e => setRegisterData({ ...registerData, password: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700 block mb-1">Confirmar</label>
                    <input
                      type="password"
                      required
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                      placeholder="••••••••"
                      value={registerData.confirmPassword}
                      onChange={e => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={registerData.acceptedTerms}
                    onChange={e => setRegisterData({ ...registerData, acceptedTerms: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                  <label htmlFor="terms" className="text-sm text-slate-600">
                    He leído y acepto los <button type="button" onClick={() => setIsTermsOpen(true)} className="text-primary font-bold hover:underline">Términos y Condiciones</button>.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!isRegisterValid || registerLoading}
                  className={`w-full py-3 rounded-xl font-bold transition-all mt-4 ${isRegisterValid && !registerLoading
                    ? 'bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                >
                  {registerLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                      Creando cuenta...
                    </span>
                  ) : (
                    'Crear Cuenta'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: FORGOT PASSWORD --- */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-[fade-in_0.2s_ease-out]">
            <div className="p-6 text-center border-b border-slate-100">
              <div className="size-16 bg-blue-50 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">lock_reset</span>
              </div>
              <h3 className="font-bold text-slate-900 text-xl">Recuperar Contraseña</h3>
              <p className="text-slate-500 text-sm mt-1">Ingresa tu correo y te enviaremos un enlace para restablecerla.</p>
            </div>
            <div className="p-6">
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <input
                  type="email"
                  required
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-center"
                />
                <button type="submit" className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all">
                  Enviar Enlace de Recuperación
                </button>
              </form>
              <button
                onClick={() => setIsForgotPasswordOpen(false)}
                className="w-full mt-4 text-sm font-bold text-slate-400 hover:text-slate-600"
              >
                Volver a Iniciar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: TERMS --- */}
      {isTermsOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col animate-[fade-in_0.2s_ease-out]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="font-bold text-slate-900 text-lg">Términos y Condiciones</h3>
              <button onClick={() => setIsTermsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-8 overflow-y-auto text-sm text-slate-600 leading-relaxed space-y-6">
              <p>Bienvenido a Emprexa...</p>
            </div>
            <div className="p-4 border-t border-slate-100 bg-white rounded-b-2xl flex justify-end">
              <button onClick={() => setIsTermsOpen(false)} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: ¿QUÉ SON LOS ODS? --- */}
      {isSdgModalOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-slate-50 rounded-[2.5rem] shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-[fade-in_0.3s_ease-out]">
            <div className="p-8 md:p-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">Objetivos de Desarrollo Sostenible</h3>
                  <p className="text-slate-500 font-medium mt-1">Conoce las metas globales para transformar nuestro mundo.</p>
                </div>
                <button onClick={() => { setIsSdgModalOpen(false); setSelectedSdg(null); }} className="size-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
                {selectedSdg ? (
                  <div
                    className="h-full rounded-[2rem] p-8 md:p-12 relative overflow-hidden flex flex-col justify-end min-h-[400px] animate-[fade-in_0.4s_ease-out]"
                    style={{ backgroundColor: selectedSdg.color }}
                  >
                    <span className="absolute -top-10 -right-10 material-symbols-outlined text-[300px] text-white/20 pointer-events-none select-none">
                      {selectedSdg.icon}
                    </span>

                    <button onClick={() => setSelectedSdg(null)} className="absolute top-6 left-6 flex items-center gap-2 text-white/80 hover:text-white font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm transition-all text-sm">
                      <span className="material-symbols-outlined text-lg">arrow_back</span>
                      Volver a la cuadrícula
                    </button>

                    <div className="relative z-10 text-white">
                      <div className="flex items-center gap-4 mb-4">
                        <span className="inline-block bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em]">Meta {selectedSdg.id}</span>
                        <div className="flex gap-4 text-xs font-bold text-white/90">
                          <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">folder_open</span> {PROJECTS.filter(p => p.sdgId === selectedSdg.id).length} Proyectos</span>
                          <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">dynamic_feed</span> {POSTS.filter(p => p.sdgIds.includes(selectedSdg.id)).length} Publicaciones</span>
                        </div>
                      </div>
                      <h4 className="text-4xl md:text-5xl font-black mb-6 leading-[1.1]">{selectedSdg.label}</h4>
                      <p className="text-xl md:text-2xl text-white/90 font-medium leading-relaxed max-w-2xl">{selectedSdg.description}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 p-1">
                    {SDGS.map(sdg => (
                      <button
                        key={sdg.id}
                        onClick={() => setSelectedSdg(sdg)}
                        className="aspect-square rounded-[1.5rem] p-4 flex flex-col justify-between items-start text-left text-white shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-95 transition-all relative overflow-hidden group"
                        style={{ backgroundColor: sdg.color }}
                      >
                        <span className="text-[10px] font-black opacity-80 z-10">0{sdg.id}</span>
                        <span className="material-symbols-outlined text-3xl md:text-4xl font-light z-10">{sdg.icon}</span>
                        <span className="text-[10px] font-black leading-tight z-10 line-clamp-2">{sdg.short}</span>
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: ¿QUÉ ES EMPREXA? --- */}
      {isEmprexaModalOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-[fade-in_0.3s_ease-out] relative">
            <div className="p-10 md:p-14 text-center">
              <div className="size-24 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mx-auto mb-10 transform -rotate-6">
                <Logo className="h-10" />
              </div>
              <h3 className="text-4xl font-black text-slate-900 mb-8 tracking-tight">El Propósito detras de Emprexa</h3>
              <div className="space-y-6 text-lg md:text-xl text-slate-600 font-medium leading-[1.6]">
                <p>
                  Emprexa no es una red social más, acá no se trata de influencers, de gatitos bailando, memes o demás.
                  Se trata de una <span className="text-primary font-black">red seria, con propósito, con impacto</span>, para que las organizaciones den visibilidad de sus proyectos.
                </p>
                <p>
                  Si hay una sección de pagos es para evitar que cualquiera publique cosas como lo que hoy vemos en las otras redes.
                  Así que las personas adquieren un <span className="text-slate-900 font-black">compromiso serio al pagar</span> para publicar y dar visibilidad a sus proyectos.
                </p>
              </div>
              <button
                onClick={() => setIsEmprexaModalOpen(false)}
                className="mt-12 w-full py-4 bg-slate-950 text-white rounded-2xl font-black text-base hover:bg-slate-800 shadow-xl transition-all active:scale-95"
              >
                Entendido, quiero impactar
              </button>
            </div>
            <button onClick={() => setIsEmprexaModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-colors">
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL: PASSWORD RESET SUCCESS --- */}
      {isPasswordResetSent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fade-in_0.3s_ease-out]"
            onClick={() => setIsPasswordResetSent(false)}
          ></div>

          {/* Modal Card */}
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-[scale-in_0.2s_ease-out]">
            <div className="p-8 text-center">
              <div className="size-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-3xl">mark_email_read</span>
              </div>

              <h2 className="text-xl font-bold text-slate-900 mb-2">¡Enlace enviado!</h2>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                Se ha enviado un enlace de recuperación a tu correo electrónico.
                Revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace
                para restablecer tu contraseña.
              </p>

              <button
                onClick={() => setIsPasswordResetSent(false)}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-600/20 transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: LOGIN ERROR --- */}
      {loginError && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fade-in_0.3s_ease-out]"
            onClick={() => setLoginError(null)}
          ></div>

          {/* Modal Card */}
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-[scale-in_0.2s_ease-out]">
            <div className="p-8 text-center">
              <div className="size-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-3xl">error</span>
              </div>

              <h2 className="text-xl font-bold text-slate-900 mb-2">Error al Iniciar Sesión</h2>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                {loginError}
              </p>

              <button
                onClick={() => setLoginError(null)}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 transition-all"
              >
                Intentar de Nuevo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};