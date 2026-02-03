import React, { useState, useEffect } from 'react';
import { View } from './types';
import { Sidebar } from './components/Sidebar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Loading } from './components/Loading';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Feed } from './pages/Feed';
import { Pricing } from './pages/Pricing';
import { Checkout } from './pages/Checkout';
import { Success } from './pages/Success';
import { Explore } from './pages/Explore';
import { Search } from './pages/Search';
import { SDGFeed } from './pages/SDGFeed';
import { Messages } from './pages/Messages';
import { Notifications } from './pages/Notifications';
import { ProfileSettings } from './pages/ProfileSettings';
import { Profile } from './pages/Profile';
import { OrgProfile } from './pages/OrgProfile';
import { OrgSettings } from './pages/OrgSettings';
import { HashtagFeed } from './pages/HashtagFeed';
import { ProjectDetails } from './pages/ProjectDetails';
import { CreateProject } from './pages/CreateProject';
import { SinglePost } from './pages/SinglePost';
import { Saved } from './pages/Saved';
import { Logo } from './components/Logo';
import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { AuthCallback } from './components/AuthCallback';
import { ResetPassword } from './pages/ResetPassword';


function AppContent() {
  const { user, isLoading, totalUnreadMessages, totalUnreadNotifications } = useAuth();
  const [currentView, setCurrentView] = useState<View>(View.LOGIN);
  const [navParams, setNavParams] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  // Deep Linking & Auth Redirect Logic - VERSIÓN FINAL
  useEffect(() => {
    // 1. Siempre verificar parámetros de URL PRIMERO (lo más importante)
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    const idParam = urlParams.get('id');

    // Si hay un post en la URL, MOSTRARLO SIEMPRE (público o logueado)
    if (viewParam === 'post' && idParam) {
      setCurrentView(View.SINGLE_POST);
      setNavParams({ postId: idParam });
      setInitialCheckDone(true);
      return;
    }

    // REGLA 1: No hacer nada durante loading inicial
    if (isLoading && !initialCheckDone) {
      return;
    }

    // REGLA 2: Si acaba de terminar el loading y no hay usuario, quedarse en LOGIN
    if (!isLoading && !initialCheckDone && !user) {
      setCurrentView(View.LOGIN);
      setInitialCheckDone(true);
      return;
    }

    // REGLA 3: Si ya terminó el loading inicial y hay usuario, decidir entre FEED o ONBOARDING
    if (!isLoading && !initialCheckDone && user) {
      if (user.status === 'onboarding' || !user.sdgInterests || user.sdgInterests.length === 0) {
        setCurrentView(View.ONBOARDING);
      } else {
        setCurrentView(View.FEED);
      }
      setInitialCheckDone(true);
      return;
    }

    // REGLA NUEVA: Si el usuario cambia de null a objeto (login/signup), redirigir
    if (user && currentView === View.LOGIN) {
      if (user.status === 'onboarding' || !user.sdgInterests || user.sdgInterests.length === 0) {
        setCurrentView(View.ONBOARDING);
      } else {
        setCurrentView(View.FEED);
      }
      return;
    }

    // REGLA NUEVA (FIX LOGOUT): Si ya cargó la app y el usuario se vuelve null (Logout), redirigir al Login
    // Excluyendo vistas que son públicamente accesibles para evitar rebotes en SinglePost, etc.
    if (initialCheckDone && !isLoading && !user) {
      const publicViews = [View.LOGIN, View.SINGLE_POST, View.RESET_PASSWORD, View.PRICING];
      if (!publicViews.includes(currentView)) {
        setCurrentView(View.LOGIN);
        setNavParams(null);
        return;
      }
    }

    setInitialCheckDone(true);
  }, [user, isLoading, currentView, initialCheckDone]);

  const navigate = (view: View, params?: any) => {
    // Permitir navegación incluso durante loading post-inicial
    if (isLoading && !initialCheckDone) return;

    // Definir vistas públicas (accesibles sin login)
    const publicViews = [
      View.LOGIN,
      View.ONBOARDING,
      View.SINGLE_POST,
      View.PRICING,  // Pricing puede ser público
      View.RESET_PASSWORD
    ];

    // Si no hay usuario y trata de acceder a vista protegida → LOGIN
    if (!user && !publicViews.includes(view)) {
      setCurrentView(View.LOGIN);
      setNavParams(null);
      window.history.pushState({}, '', '/');
      window.scrollTo(0, 0);
      return;
    }

    // Navegación normal
    setCurrentView(view);
    setNavParams(params || null);

    if (view === View.SINGLE_POST && params?.postId) {
      window.history.pushState({}, '', `?view=post&id=${params.postId}`);
    } else {
      window.history.pushState({}, '', '/');
    }

    window.scrollTo(0, 0);

    // Cerrar menú móvil al navegar
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  // --- NUEVA REGLA: Verificar si estamos en callback de autenticación ---
  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;

    // Si hay un hash o parámetros de autenticación en la URL, es un callback
    if (hash && (hash.includes('access_token') || hash.includes('type=recovery'))) {
      console.log('🔐 URL de callback detectada');
      // Dejamos que AuthCallback maneje esto
    }
  }, []);

// Manejar rutas hash para reset-password - VERSIÓN CORREGIDA
useEffect(() => {
  const handleHashRoute = () => {
    const hash = window.location.hash;
    
    // IGNORAR si hay tokens de autenticación en el hash
    // (AuthCallback se encargará de ellos)
    if (hash && (
      hash.includes('access_token') || 
      hash.includes('refresh_token') ||
      hash.includes('type=recovery')
    )) {
      console.log('📍 App.tsx: Hash contiene tokens - dejando que AuthCallback maneje');
      return;
    }
    
    // Solo procesar #reset-password si NO hay tokens
    if (hash === '#reset-password') {
      console.log('📍 App.tsx: Hash #reset-password detectado, navegando');
      setCurrentView(View.RESET_PASSWORD);
      setInitialCheckDone(true);
      
      // Limpiar el hash para evitar problemas
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  // Ejecutar después de un pequeño delay para asegurar que AuthCallback tuvo tiempo
  setTimeout(handleHashRoute, 100);
  
  // También escuchar cambios en el hash
  const handleHashChange = () => {
    // Esperar un momento antes de procesar para dar tiempo a AuthCallback
    setTimeout(handleHashRoute, 50);
  };

  window.addEventListener('hashchange', handleHashChange);
  
  return () => {
    window.removeEventListener('hashchange', handleHashChange);
  };
}, [setCurrentView, setInitialCheckDone]);

  if (isLoading && !initialCheckDone) {
    return <Loading />;
  }

    // --- VERIFICAR SI ES CALLBACK DE AUTENTICACIÓN ---
  const hash = window.location.hash;
  const isAuthCallback = hash && (
    (hash.includes('access_token') && !hash.includes('#reset-password')) ||
    (hash.includes('type=recovery') && !hash.includes('#reset-password')) ||
    hash.includes('error=')
  );

  // Si es un callback de autenticación, mostrar componente especial
  if (isAuthCallback) {
    return <AuthCallback />;
  }

  // --- FULL SCREEN VIEWS (No Sidebar) ---
  if (currentView === View.LOGIN) return <Login currentView={currentView} navigate={navigate} />;
  if (currentView === View.ONBOARDING) return <Onboarding currentView={currentView} navigate={navigate} />;
  if (currentView === View.CHECKOUT) return <Checkout currentView={currentView} navigate={navigate} params={navParams} />;
  if (currentView === View.SUCCESS) return <Success currentView={currentView} navigate={navigate} params={navParams} />;
  if (currentView === View.RESET_PASSWORD) return <ResetPassword currentView={currentView} navigate={navigate} />;
  // Public Post View - SIEMPRE visible, con o sin usuario
  if (currentView === View.SINGLE_POST) {
    return <SinglePost currentView={currentView} navigate={navigate} params={navParams} />;
  }

  // --- PROTECTED APP LAYOUT (With Sidebar) ---
  return (
    <div className="flex h-screen bg-background-light">
      <Sidebar
        currentView={currentView}
        navigate={navigate}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <Logo className="h-8" />
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(View.MESSAGES)} className="relative text-slate-500">
              <span className="material-symbols-outlined">chat</span>
              {totalUnreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 size-5 bg-red-500 border-2 border-white rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                  {totalUnreadMessages}
                </span>
              )}
            </button>
            <button onClick={() => navigate(View.NOTIFICATIONS)} className="relative text-slate-500">
              <span className="material-symbols-outlined">notifications</span>
              {totalUnreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 size-5 bg-red-500 border-2 border-white rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                  {totalUnreadNotifications}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="text-slate-500 hover:text-slate-700 p-1"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
          </div>
        </header>

        {currentView === View.DASHBOARD && <Dashboard currentView={currentView} navigate={navigate} params={navParams} />}
        {currentView === View.SEARCH && <Search currentView={currentView} navigate={navigate} params={navParams} />}
        {currentView === View.FEED && <Feed currentView={currentView} navigate={navigate} params={navParams} />}
        {currentView === View.PRICING && <Pricing currentView={currentView} navigate={navigate} params={navParams} />}
        {currentView === View.EXPLORE && <Explore currentView={currentView} navigate={navigate} params={navParams} />}
        {currentView === View.SDG_FEED && <SDGFeed currentView={currentView} navigate={navigate} params={navParams} />}
        {currentView === View.HASHTAG && <HashtagFeed currentView={currentView} navigate={navigate} params={navParams} />}
        {currentView === View.MESSAGES && <Messages currentView={currentView} navigate={navigate} params={navParams} />}
        {currentView === View.NOTIFICATIONS && <Notifications currentView={currentView} navigate={navigate} params={navParams} />}
        {currentView === View.PROFILE && <Profile currentView={currentView} navigate={navigate} params={navParams} />}
        {currentView === View.SETTINGS && <ProfileSettings currentView={currentView} navigate={navigate} params={navParams} />}
        {currentView === View.SINGLE_POST && <SinglePost currentView={currentView} navigate={navigate} params={navParams} />}
        {currentView === View.SAVED && <Saved currentView={currentView} navigate={navigate} params={navParams} />}

        {currentView === View.ORG_SETTINGS && (
          navParams?.editMode ?
            <OrgSettings currentView={currentView} navigate={navigate} params={navParams} /> :
            <OrgProfile currentView={currentView} navigate={navigate} params={navParams} />
        )}

        {currentView === View.PROJECT_DETAILS && <ProjectDetails currentView={currentView} navigate={navigate} params={navParams} />}
        {currentView === View.CREATE_PROJECT && <CreateProject currentView={currentView} navigate={navigate} params={navParams} />}
      </div>
    </div>
  );
}

const App: React.FC = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return (
    <PayPalScriptProvider options={{
      clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID,
      vault: true,
      intent: "subscription"
    }}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </PayPalScriptProvider>
  );
};

export default App;