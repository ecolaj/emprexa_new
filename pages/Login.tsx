import React, { useState, useEffect } from 'react';
import { View, NavProps } from '../types';
import { SDGS, POSTS, PROJECTS } from '../constants';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
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

// La selección de imágenes ahora se hace dinámicamente desde /public/assets/sdgs/


export const Login: React.FC<NavProps> = ({ navigate }) => {
  const { login, isLoading } = useAuth(); // Use Auth Context
  const { t, language, setLanguage } = useLanguage();
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
  const [sdgStats, setSdgStats] = useState<Record<number, { projects: number, posts: number }>>({});

  // Controlled Inputs
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

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
    registerData.password.length >= 6 &&
    registerData.password === registerData.confirmPassword &&
    registerData.acceptedTerms;

  useEffect(() => {
    // Generar un ID de ODS aleatorio (1-17)
    const randomSdgId = Math.floor(Math.random() * 17) + 1;
    // Generar un número de foto aleatorio (1-3)
    const randomPhotoNum = Math.floor(Math.random() * 3) + 1;

    // Formatear con ceros a la izquierda para coincidir con la nomenclatura (ej: 01-01)
    const sdgStr = randomSdgId.toString().padStart(2, '0');
    const photoStr = randomPhotoNum.toString().padStart(2, '0');

    // URL local basada en tu nomenclatura y formato .avif
    const imageUrl = `/assets/sdgs/${sdgStr}-${photoStr}.avif`;

    setBackground({
      sdgId: randomSdgId,
      url: imageUrl,
      loaded: false
    });
  }, []);

  useEffect(() => {
    const fetchSdgStats = async () => {
      try {
        const { data: projectsData } = await supabase.from('projects').select('sdg_id');
        const { data: postsData } = await supabase.from('posts').select('sdg_ids');

        const stats: Record<number, { projects: number, posts: number }> = {};

        // Initialize with 0
        SDGS.forEach(sdg => { stats[sdg.id] = { projects: 0, posts: 0 }; });

        // Count Projects
        projectsData?.forEach((p: any) => {
          if (stats[p.sdg_id]) stats[p.sdg_id].projects++;
        });

        // Count Posts
        postsData?.forEach((p: any) => {
          if (Array.isArray(p.sdg_ids)) {
            p.sdg_ids.forEach((id: number) => {
              if (stats[id]) stats[id].posts++;
            });
          }
        });

        setSdgStats(stats);
      } catch (error) {
        console.error('Error fetching SDG stats:', error);
      }
    };

    fetchSdgStats();
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
        text: err.message || t('login.errorCreatingAccount')
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
      const redirectUrl = `${baseUrl}/auth/callback?type=recovery`;

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
        setLoginError(t('login.rateLimitInstructions', {
          url: `${getBaseUrl()}/#reset-password`,
          email: forgotPasswordEmail
        }));
      } else {
        setLoginError(t('login.passwordResetError', { error: err.message }));
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
              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md border border-white/20 px-5 py-3 rounded-2xl text-white shadow-lg transition-transform hover:scale-105 max-w-sm">
                <div className="text-right">
                  <span className="block text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">{t('feed.sdgAbbr')} {activeSdgInfo.id}</span>
                  <span className="block text-sm font-black leading-tight">{t(`sdgs.${activeSdgInfo.id}.label`) || activeSdgInfo.label}</span>
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
              {t('login.drivingChange1')} <br />
              <span className="text-primary-300">{t('login.drivingChange2')}</span>
            </h1>
            <p className="text-lg text-slate-200 font-medium leading-relaxed opacity-90 drop-shadow-md">
              {t('login.joinNetwork')}
            </p>
          </div>

          <div className="flex justify-between items-end border-t border-white/10 pt-4 text-white/40 text-[10px] font-medium uppercase tracking-widest">
            <span>© Emprexa 2026</span>
            <span className="flex items-center gap-1">
              {t('login.photosVia')} Unsplash
            </span>
          </div>
        </div>
      </div>

      {/* Right Panel: Form */}
      <div className="flex w-full lg:w-5/12 flex-col justify-center items-center bg-white p-6 sm:p-12 relative z-30 shadow-2xl">

        {/* Language Selector */}
        <div className="absolute top-6 right-6 flex items-center bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setLanguage('es')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${language === 'es' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            ES
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${language === 'en' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            EN
          </button>
        </div>

        <div className="w-full max-w-[400px] flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">{t('login.welcomeTitle')}</h2>
            <p className="text-slate-500 text-base">{t('login.welcomeSubtitle')}</p>
          </div>

          <form className="flex flex-col gap-5" onSubmit={handleLoginSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">{t('login.emailLabel')}</label>
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
                <label className="text-sm font-semibold text-slate-700">{t('login.passwordLabel')}</label>
                <button type="button" onClick={() => setIsForgotPasswordOpen(true)} className="text-xs font-bold text-primary hover:underline">{t('login.forgotPassword')}</button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all pr-12"
                  placeholder=""
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
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
                  <span>{t('login.submitButton')}</span>
                  <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center text-sm text-slate-500">
            {t('login.noAccount')} <button onClick={() => setIsRegisterOpen(true)} className="text-primary font-bold hover:underline">{t('login.registerFree')}</button>
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setIsSdgModalOpen(true)}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
              {t('login.whatAreSdgs')}
            </button>
            <button
              onClick={() => setIsEmprexaModalOpen(true)}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-primary">info</span>
              {t('login.whatIsEmprexa')}
            </button>
          </div>
        </div>
      </div>

      {/* --- MODAL: REGISTRATION --- */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-[fade-in_0.2s_ease-out] flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-bold text-slate-900 text-lg">{t('login.registerTitle')}</h3>
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
                  <label className="text-sm font-bold text-slate-700 block mb-1">{t('login.fullNameLabel')}</label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                    placeholder={t('login.fullNamePlaceholder')}
                    value={registerData.name}
                    onChange={e => setRegisterData({ ...registerData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-1">{t('login.emailLabel')}</label>
                  <input
                    type="email"
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                    placeholder={t('login.emailPlaceholder')}
                    value={registerData.email}
                    onChange={e => setRegisterData({ ...registerData, email: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-end mb-1">
                      <label className="text-sm font-bold text-slate-700">{t('login.passwordLabel')}</label>
                      <span className="text-[10px] text-slate-400 font-medium">{t('login.passwordMinChars')}</span>
                    </div>
                    <div className="relative">
                      <input
                        type={showRegisterPassword ? "text" : "password"}
                        required
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary pr-12"
                        placeholder="••••••••"
                        value={registerData.password}
                        onChange={e => setRegisterData({ ...registerData, password: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <span className="material-symbols-outlined text-xl">
                          {showRegisterPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700 block mb-1">{t('login.confirmPasswordLabel')}</label>
                    <div className="relative">
                      <input
                        type={showRegisterConfirmPassword ? "text" : "password"}
                        required
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary pr-12"
                        placeholder="••••••••"
                        value={registerData.confirmPassword}
                        onChange={e => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <span className="material-symbols-outlined text-xl">
                          {showRegisterConfirmPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
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
                    {t('login.termsPrefix')} <button type="button" onClick={() => setIsTermsOpen(true)} className="text-primary font-bold hover:underline">{t('login.termsLink')}</button>.
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
                      {t('login.creatingAccountButton')}
                    </span>
                  ) : (
                    t('login.createAccountButton')
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
              <h3 className="font-bold text-slate-900 text-xl">{t('login.forgotTitle')}</h3>
              <p className="text-slate-500 text-sm mt-1">{t('login.forgotSubtitle')}</p>
            </div>
            <div className="p-6">
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <input
                  type="email"
                  required
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  placeholder={t('login.forgotEmailPlaceholder')}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-center"
                />
                <button type="submit" className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all">
                  {t('login.sendRecoveryLinkButton')}
                </button>
              </form>
              <button
                onClick={() => setIsForgotPasswordOpen(false)}
                className="w-full mt-4 text-sm font-bold text-slate-400 hover:text-slate-600"
              >
                {t('login.backToLoginButton')}
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
              <h3 className="font-bold text-slate-900 text-lg">{t('termsModal.modalTitle')}</h3>
              <button onClick={() => setIsTermsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-8 overflow-y-auto text-sm text-slate-600 leading-relaxed space-y-6 text-justify">
              <div className="space-y-6">
                <h4 className="font-bold text-slate-900 text-lg text-center">{t('termsModal.header')}</h4>

                <div>
                  <strong className="block text-slate-900 text-base mb-2">{t('termsModal.s1Title')}</strong>
                  <p>{t('termsModal.s1p1')}</p>
                  <p className="mt-2">{t('termsModal.s1p2')}</p>
                </div>

                <div>
                  <strong className="block text-slate-900 text-base mb-2">{t('termsModal.s2Title')}</strong>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>{t('termsModal.s2i1_strong')}</strong>{t('termsModal.s2i1_desc')}</li>
                    <li><strong>{t('termsModal.s2i2_strong')}</strong>{t('termsModal.s2i2_desc')}</li>
                    <li><strong>{t('termsModal.s2i3_strong')}</strong>{t('termsModal.s2i3_desc')}</li>
                    <li><strong>{t('termsModal.s2i4_strong')}</strong>{t('termsModal.s2i4_desc')}</li>
                    <li><strong>{t('termsModal.s2i5_strong')}</strong>{t('termsModal.s2i5_desc')}</li>
                  </ul>
                </div>

                <div>
                  <strong className="block text-slate-900 text-base mb-2">{t('termsModal.s3Title')}</strong>
                  <p className="mb-2"><strong>{t('termsModal.s3p1')}</strong>{t('termsModal.s3p1_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s3p2')}</strong>{t('termsModal.s3p2_desc')}</p>
                  <ul className="list-[lower-alpha] pl-5 space-y-1 mb-2">
                    <li>{t('termsModal.s3i1')}</li>
                    <li>{t('termsModal.s3i2')}</li>
                    <li>{t('termsModal.s3i3')}</li>
                    <li>{t('termsModal.s3i4')}</li>
                  </ul>
                  <p><strong>{t('termsModal.s3p3')}</strong>{t('termsModal.s3p3_desc')}</p>
                </div>

                <div>
                  <strong className="block text-slate-900 text-base mb-2">{t('termsModal.s4Title')}</strong>
                  <p className="mb-2"><strong>{t('termsModal.s4p1_strong')}</strong>{t('termsModal.s4p1_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s4p2_strong')}</strong>{t('termsModal.s4p2_desc')}</p>
                  <ul className="list-[lower-alpha] pl-5 space-y-1 mb-2">
                    <li>{t('termsModal.s4i1')}</li>
                    <li>{t('termsModal.s4i2')}</li>
                    <li>{t('termsModal.s4i3')}</li>
                    <li>{t('termsModal.s4i4')}</li>
                    <li>{t('termsModal.s4i5')}</li>
                    <li>{t('termsModal.s4i6')}</li>
                    <li>{t('termsModal.s4i7')}</li>
                  </ul>
                  <p><strong>{t('termsModal.s4p3_strong')}</strong>{t('termsModal.s4p3_desc')}</p>
                </div>

                <div>
                  <strong className="block text-slate-900 text-base mb-2">{t('termsModal.s5Title')}</strong>
                  <p className="mb-2"><strong>{t('termsModal.s5p1_strong')}</strong>{t('termsModal.s5p1_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s5p2_strong')}</strong>{t('termsModal.s5p2_desc')}</p>
                  <ul className="list-[lower-alpha] pl-5 space-y-1 mb-2">
                    <li>{t('termsModal.s5i1')}</li>
                    <li>{t('termsModal.s5i2')}</li>
                    <li>{t('termsModal.s5i3')}</li>
                  </ul>
                  <p className="mb-2"><strong>{t('termsModal.s5p3_strong')}</strong>{t('termsModal.s5p3_desc')}</p>
                  <p><strong>{t('termsModal.s5p4_strong')}</strong>{t('termsModal.s5p4_desc')}</p>
                </div>

                <div>
                  <strong className="block text-slate-900 text-base mb-2">{t('termsModal.s6Title')}</strong>
                  <p className="mb-2"><strong>{t('termsModal.s6p1_strong')}</strong>{t('termsModal.s6p1_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s6p2_strong')}</strong>{t('termsModal.s6p2_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s6p3_strong')}</strong>{t('termsModal.s6p3_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s6p4_strong')}</strong>{t('termsModal.s6p4_desc')}</p>
                  <p><strong>{t('termsModal.s6p5_strong')}</strong>{t('termsModal.s6p5_desc')}</p>
                </div>

                <div>
                  <strong className="block text-slate-900 text-base mb-2">{t('termsModal.s7Title')}</strong>
                  <p className="mb-2"><strong>{t('termsModal.s7p1_strong')}</strong>{t('termsModal.s7p1_desc')}</p>
                  <ul className="list-[lower-alpha] pl-5 space-y-1 mb-2">
                    <li>{t('termsModal.s7i1')}</li>
                    <li>{t('termsModal.s7i2')}</li>
                    <li>{t('termsModal.s7i3')}</li>
                  </ul>
                  <p className="mb-2"><strong>{t('termsModal.s7p2_strong')}</strong>{t('termsModal.s7p2_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s7p3_strong')}</strong>{t('termsModal.s7p3_desc')}</p>
                  <ul className="list-[lower-alpha] pl-5 space-y-1 mb-2">
                    <li>{t('termsModal.s7i4')}</li>
                    <li>{t('termsModal.s7i5')}</li>
                    <li>{t('termsModal.s7i6')}</li>
                    <li>{t('termsModal.s7i7')}</li>
                  </ul>
                  <p><strong>{t('termsModal.s7p4_strong')}</strong>{t('termsModal.s7p4_desc')}</p>
                </div>

                <div>
                  <strong className="block text-slate-900 text-base mb-2">{t('termsModal.s8Title')}</strong>
                  <p className="mb-2"><strong>{t('termsModal.s8p1_strong')}</strong>{t('termsModal.s8p1_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s8p2_strong')}</strong>{t('termsModal.s8p2_desc')}</p>
                  <p><strong>{t('termsModal.s8p3_strong')}</strong>{t('termsModal.s8p3_desc')}</p>
                </div>

                <div>
                  <strong className="block text-slate-900 text-base mb-2">{t('termsModal.s9Title')}</strong>
                  <p className="mb-2"><strong>{t('termsModal.s9p1_strong')}</strong>{t('termsModal.s9p1_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s9p2_strong')}</strong>{t('termsModal.s9p2_desc')}</p>
                  <ul className="list-[lower-alpha] pl-5 space-y-1 mb-2">
                    <li>{t('termsModal.s9i1')}</li>
                    <li>{t('termsModal.s9i2')}</li>
                    <li>{t('termsModal.s9i3')}</li>
                    <li>{t('termsModal.s9i4')}</li>
                  </ul>
                  <p><strong>{t('termsModal.s9p3_strong')}</strong>{t('termsModal.s9p3_desc')}</p>
                </div>

                <div>
                  <strong className="block text-slate-900 text-base mb-2">{t('termsModal.s10Title')}</strong>
                  <p className="mb-2"><strong>{t('termsModal.s10p1_strong')}</strong>{t('termsModal.s10p1_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s10p2_strong')}</strong>{t('termsModal.s10p2_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s10p3_strong')}</strong>{t('termsModal.s10p3_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s10p4_strong')}</strong>{t('termsModal.s10p4_desc')}</p>
                  <p><strong>{t('termsModal.s10p5_strong')}</strong>{t('termsModal.s10p5_desc')}</p>
                </div>

                <div>
                  <strong className="block text-slate-900 text-base mb-2">{t('termsModal.s11Title')}</strong>
                  <p className="mb-2">{t('termsModal.s11desc')}</p>
                  <ul className="list-[lower-alpha] pl-5 space-y-1">
                    <li>{t('termsModal.s11i1')}</li>
                    <li>{t('termsModal.s11i2')}</li>
                    <li>{t('termsModal.s11i3')}</li>
                    <li>{t('termsModal.s11i4')}</li>
                  </ul>
                </div>

                <div>
                  <strong className="block text-slate-900 text-base mb-2">{t('termsModal.s12Title')}</strong>
                  <p className="mb-2"><strong>{t('termsModal.s12p1_strong')}</strong>{t('termsModal.s12p1_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s12p2_strong')}</strong>{t('termsModal.s12p2_desc')}</p>
                  <p><strong>{t('termsModal.s12p3_strong')}</strong>{t('termsModal.s12p3_desc')}</p>
                </div>

                <div>
                  <strong className="block text-slate-900 text-base mb-2">{t('termsModal.s13Title')}</strong>
                  <p className="mb-2"><strong>{t('termsModal.s13p1_strong')}</strong>{t('termsModal.s13p1_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s13p2_strong')}</strong>{t('termsModal.s13p2_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s13p3_strong')}</strong>{t('termsModal.s13p3_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s13p4_strong')}</strong>{t('termsModal.s13p4_desc')}</p>
                  <p className="mb-2"><strong>{t('termsModal.s13p5_strong')}</strong>{t('termsModal.s13p5_desc')}</p>
                  <p><strong>{t('termsModal.s13p6_strong')}</strong>{t('termsModal.s13p6_desc')}</p>
                </div>

                <div>
                  <strong className="block text-slate-900 text-base mb-2">{t('termsModal.s14Title')}</strong>
                  <p>{t('termsModal.s14p1')}</p>
                  <p className="font-bold mt-2">{t('termsModal.s14p2')}</p>
                  <p>{t('termsModal.s14p3')}</p>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-400">{t('termsModal.lastUpdate')}</p>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-white rounded-b-2xl flex justify-end">
              <button onClick={() => setIsTermsOpen(false)} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800">{t('login.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: ¿QUÉ SON LOS ODS? --- */}
      {isSdgModalOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-slate-50 rounded-[2.5rem] shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-[fade-in_0.3s_ease-out]">
            <div className="p-6 md:p-8 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{t('sdgModal.title')}</h3>
                  <p className="text-slate-400 font-medium mt-1 text-sm leading-relaxed max-w-4xl">
                    {t('sdgModal.desc1')}
                    <span className="hidden md:inline">{t('sdgModal.desc2')}</span>
                  </p>
                </div>
                <button onClick={() => { setIsSdgModalOpen(false); setSelectedSdg(null); }} className="size-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all shrink-0 ml-4">
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              <div className="flex-1 flex flex-col justify-center min-h-0 relative">
                {selectedSdg ? (
                  <div
                    className="h-full rounded-[2rem] p-8 md:p-12 relative overflow-hidden flex flex-col justify-end animate-[fade-in_0.4s_ease-out]"
                    style={{ backgroundColor: selectedSdg.color }}
                  >
                    <span className="absolute -top-10 -right-10 material-symbols-outlined text-[300px] text-white/20 pointer-events-none select-none">
                      {selectedSdg.icon}
                    </span>

                    <button onClick={() => setSelectedSdg(null)} className="absolute top-6 left-6 flex items-center gap-2 text-white/80 hover:text-white font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm transition-all text-sm">
                      <span className="material-symbols-outlined text-lg">arrow_back</span>
                      {t('sdgModal.backToGrid')}
                    </button>

                    <div className="relative z-10 text-white">
                      <div className="flex items-center gap-4 mb-4">
                        <span className="inline-block bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em]">{t('feed.sdgAbbr')} {selectedSdg.id}</span>
                        <div className="flex gap-4 text-xs font-bold text-white/90">
                          <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">folder_open</span> {sdgStats[selectedSdg.id]?.projects || 0} {t('sdgModal.projects')}</span>
                          <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">dynamic_feed</span> {sdgStats[selectedSdg.id]?.posts || 0} {t('sdgModal.posts')}</span>
                        </div>
                      </div>
                      <h4 className="text-4xl md:text-5xl font-black mb-6 leading-[1.1]">{t(`sdgs.${selectedSdg.id}.label`) || selectedSdg.label}</h4>
                      <p className="text-xl md:text-2xl text-white/90 font-medium leading-relaxed max-w-2xl">{t(`sdgs.${selectedSdg.id}.description`) || selectedSdg.description}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-6 gap-2 sm:gap-3 p-1">
                    {SDGS.map(sdg => (
                      <div key={sdg.id} className="relative group aspect-square">
                        <button
                          onClick={() => setSelectedSdg(sdg)}
                          className="w-full h-full rounded-[1.2rem] p-3 flex flex-col justify-between items-start text-left text-white shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-95 transition-all relative overflow-hidden"
                          style={{ backgroundColor: sdg.color }}
                        >
                          <span className="text-[9px] font-black opacity-80 z-10">0{sdg.id}</span>
                          <span className="material-symbols-outlined text-2xl md:text-3xl font-light z-10">{sdg.icon}</span>
                          <span className="text-[9px] font-black leading-tight z-10 line-clamp-2">{t(`sdgs.${sdg.id}.short`) || sdg.short}</span>
                          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </button>

                        {/* Tooltip */}
                        <div
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 z-50 whitespace-nowrap px-3 py-1.5 rounded-lg text-[10px] font-bold text-white shadow-xl pointer-events-none"
                          style={{ backgroundColor: sdg.color }}
                        >
                          {t(`sdgs.${sdg.id}.label`) || sdg.label}
                          <div
                            className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-current"
                            style={{ color: sdg.color }}
                          ></div>
                        </div>
                      </div>
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
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-[fade-in_0.3s_ease-out] relative">

            {/* Fondo con patrón de ODS en diagonal */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180%] h-[180%] grid grid-cols-6 gap-12 -rotate-45 opacity-[0.07]">
                {[...SDGS, ...SDGS, ...SDGS].map((sdg, i) => (
                  <div key={i} className="flex items-center justify-center">
                    <span className="material-symbols-outlined text-7xl" style={{ color: sdg.color }}>
                      {sdg.icon}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 md:p-12 text-center relative z-10 overflow-y-auto custom-scrollbar">
              <div className="size-20 bg-primary/10 text-primary rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 transform -rotate-6">
                <Logo className="h-8" />
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 mb-6 tracking-tight">{t('emprexaModal.title')}</h3>
              <div className="space-y-4 text-sm md:text-base text-slate-600 font-medium leading-relaxed text-left">
                <p>
                  {t('emprexaModal.subtitle1')} <span className="text-primary font-black">{t('emprexaModal.subtitleHighlight')}</span>.
                  <br />
                  {t('emprexaModal.subtitle2')}
                </p>

                <div>
                  <p className="font-bold text-slate-900 mb-1">{t('emprexaModal.buildChange')}</p>
                  <p>
                    {t('emprexaModal.desc')}
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-0.5 text-slate-500 text-xs md:text-sm">
                    <li>{t('emprexaModal.point1')}</li>
                    <li>{t('emprexaModal.point2')}</li>
                    <li>{t('emprexaModal.point3')}</li>
                    <li><strong className="text-slate-700">{t('emprexaModal.point4')}</strong></li>
                  </ul>
                </div>

                <div>
                  <p className="font-bold text-slate-900">{t('emprexaModal.whyExistsTitle')}</p>
                  <p>{t('emprexaModal.whyExistsDesc')}</p>
                </div>

                <div>
                  <p className="font-bold text-slate-900">{t('emprexaModal.whyPaidTitle')}</p>
                  <p>{t('emprexaModal.whyPaidDesc')}</p>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-2">
                  <p className="text-slate-900 font-black text-lg">{t('emprexaModal.welcome')}</p>
                  <p className="text-primary font-bold">{t('emprexaModal.slogan')}</p>
                </div>
              </div>
            </div>
            <button onClick={() => setIsEmprexaModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-colors z-50">
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

              <h2 className="text-xl font-bold text-slate-900 mb-2">{t('login.resetSentTitle')}</h2>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                {t('login.resetSentSubtitle')}
              </p>

              <button
                onClick={() => setIsPasswordResetSent(false)}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-600/20 transition-all"
              >
                {t('login.gotItButton')}
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

              <h2 className="text-xl font-bold text-slate-900 mb-2">{t('login.loginErrorTitle')}</h2>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                {loginError}
              </p>

              <button
                onClick={() => setLoginError(null)}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 transition-all"
              >
                {t('login.tryAgainButton')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};