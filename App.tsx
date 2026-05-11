import React, { useState, useEffect } from 'react';
import { View } from './types';
import { Sidebar } from './components/Sidebar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useLanguage } from './context/LanguageContext';
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
import { ProcessRecovery } from './pages/ProcessRecovery';
import { BottomNav } from './components/BottomNav';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation,
  useParams,
  Navigate
} from 'react-router-dom';


function AppContent() {
  const { user, isLoading, totalUnreadMessages, totalUnreadNotifications } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  // Helper para navegar usando el enum View (Retrocompatibilidad)
  const appNavigate = (view: View, params?: any) => {
    let path = '/feed';
    switch (view) {
      case View.FEED: path = '/feed'; break;
      case View.DASHBOARD: path = '/dashboard'; break;
      case View.EXPLORE: path = '/explore'; break;
      case View.NOTIFICATIONS: path = '/notifications'; break;
      case View.MESSAGES: path = '/messages'; break;
      case View.SETTINGS: path = '/settings'; break;
      case View.SAVED: path = '/saved'; break;
      case View.SEARCH: path = '/search'; break;
      case View.PRICING: path = '/pricing'; break;
      case View.LOGIN: path = '/login'; break;
      case View.ONBOARDING: path = '/onboarding'; break;
      case View.RESET_PASSWORD: path = '/reset-password'; break;
      case View.PROCESS_RECOVERY: path = '/process-recovery'; break;
      case View.SINGLE_POST:
        path = params?.postId ? `/post/${params.postId}` : '/';
        break;
      case View.PROFILE:
        if (params?.username) path = `/u/${params.username}`;
        else if (params?.userId) path = `/profile/${params.userId}`;
        else path = '/profile';
        break;
      case View.PROJECT_DETAILS:
        path = params?.projectId ? `/project/${params.projectId}` : '/';
        break;
      case View.SDG_FEED:
        path = params?.id ? `/sdg/${params.id}` : '/explore';
        break;
      case View.HASHTAG:
        path = params?.tag ? `/hashtag/${params.tag.replace('#', '')}` : '/explore';
        break;
      case View.CREATE_PROJECT: path = '/projects/new'; break;
      case View.EDIT_PROJECT: path = `/projects/edit/${params?.projectId}`; break;
      case View.ORG_SETTINGS: path = params?.editMode ? '/org/settings' : '/org/profile'; break;
      case View.CHECKOUT: path = '/checkout'; break;
      case View.SUCCESS: path = '/success'; break;
      default: path = '/';
    }
    navigate(path, { state: params });
    window.scrollTo(0, 0);
    setIsMobileMenuOpen(false);
  };

  // Lógica de Redirección y Onboarding
  const publicPaths = ['/login', '/reset-password', '/auth/callback', '/process-recovery'];
  const isPublicPath = publicPaths.includes(location.pathname) ||
    location.pathname.startsWith('/post/') ||
    location.pathname.startsWith('/u/') ||
    location.pathname.startsWith('/profile/');

  useEffect(() => {
    if (isLoading) return;

    if (!user && !isPublicPath) {
      if (location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    } else if (user && location.pathname === '/login') {
      if (user.status === 'onboarding' || !user.sdgInterests || user.sdgInterests.length === 0) {
        navigate('/onboarding');
      } else {
        navigate('/feed');
      }
    } else if (user && user.status === 'onboarding' && location.pathname !== '/onboarding') {
      if (!location.pathname.startsWith('/post/') && !location.pathname.startsWith('/u/')) {
        navigate('/onboarding');
      }
    }

    setInitialCheckDone(true);
  }, [user, isLoading, location.pathname, isPublicPath]);

  // Si no hay usuario y la ruta es privada, redirigir inmediatamente (evita flash de contenido en blanco)
  if (!isLoading && initialCheckDone && !user && !isPublicPath) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading && !initialCheckDone) return <Loading />;

  // --- VERIFICAR SI ES CALLBACK DE AUTENTICACIÓN --- (Mantener lógica de AuthCallback)
  const hash = window.location.hash;
  const search = window.location.search;
  const pathname = window.location.pathname;

  const isAuthCallback =
    pathname.includes('/auth/callback') ||
    (hash && (
      (hash.includes('access_token')) ||
      (hash.includes('type=recovery')) ||
      hash.includes('error=')
    )) ||
    (search && (search.includes('code=') || search.includes('token=')));

  if (isAuthCallback && location.pathname !== '/reset-password') {
    return <AuthCallback />;
  }

  // Bloqueo de seguridad: Si estamos cargando el reset-password, no permitir que el resto de la app cargue
  if (location.pathname === '/reset-password' && isLoading) {
    return <Loading />;
  }

  // Layout Wrapper para Sidebar
  const withSidebar = (component: React.ReactNode, view: View) => (
    <div className="flex h-screen bg-background-light">
      <Sidebar
        currentView={view}
        navigate={appNavigate}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden relative pt-16 pb-16 lg:pt-0 lg:pb-0">
        <header className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0 fixed top-0 left-0 w-full z-[50]">
          <div className="flex items-center gap-2"><Logo className="h-8" /></div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              className="flex items-center justify-center font-black text-[11px] uppercase w-7 h-7 rounded-full bg-slate-100 text-slate-600 hover:bg-primary hover:text-white transition-colors"
            >
              {language}
            </button>
            <button onClick={() => appNavigate(View.MESSAGES)} className="relative text-slate-500">
              <span className="material-symbols-outlined">chat</span>
              {totalUnreadMessages > 0 && <span className="absolute -top-1 -right-1 size-5 bg-red-500 border-2 border-white rounded-full text-[10px] text-white flex items-center justify-center font-bold">{totalUnreadMessages}</span>}
            </button>
            <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-500 p-2 rounded-lg z-50"><span className="material-symbols-outlined text-2xl">menu</span></button>
          </div>
        </header>
        {component}
        <BottomNav currentView={view} navigate={appNavigate} />
      </div>
    </div>
  );

  return (
    <Routes>
      <Route path="/login" element={<Login currentView={View.LOGIN} navigate={appNavigate} />} />
      <Route path="/onboarding" element={<Onboarding currentView={View.ONBOARDING} navigate={appNavigate} />} />
      <Route path="/reset-password" element={<ResetPassword currentView={View.RESET_PASSWORD} navigate={appNavigate} />} />
      <Route path="/process-recovery" element={<ProcessRecovery currentView={View.PROCESS_RECOVERY} navigate={appNavigate} />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route path="/" element={<Navigate to="/feed" replace />} />
      <Route path="/feed" element={withSidebar(<Feed currentView={View.FEED} navigate={appNavigate} />, View.FEED)} />
      <Route path="/dashboard" element={withSidebar(<Dashboard currentView={View.DASHBOARD} navigate={appNavigate} />, View.DASHBOARD)} />
      <Route path="/explore" element={withSidebar(<Explore currentView={View.EXPLORE} navigate={appNavigate} />, View.EXPLORE)} />
      <Route path="/search" element={withSidebar(<Search currentView={View.SEARCH} navigate={appNavigate} />, View.SEARCH)} />
      <Route path="/notifications" element={withSidebar(<Notifications currentView={View.NOTIFICATIONS} navigate={appNavigate} />, View.NOTIFICATIONS)} />
      <Route path="/messages" element={withSidebar(<Messages currentView={View.MESSAGES} navigate={appNavigate} />, View.MESSAGES)} />
      <Route path="/settings" element={withSidebar(<ProfileSettings currentView={View.SETTINGS} navigate={appNavigate} />, View.SETTINGS)} />
      <Route path="/saved" element={withSidebar(<Saved currentView={View.SAVED} navigate={appNavigate} />, View.SAVED)} />
      <Route path="/pricing" element={withSidebar(<Pricing currentView={View.PRICING} navigate={appNavigate} />, View.PRICING)} />
      <Route path="/checkout" element={withSidebar(<Checkout currentView={View.CHECKOUT} navigate={appNavigate} />, View.CHECKOUT)} />
      <Route path="/success" element={withSidebar(<Success currentView={View.SUCCESS} navigate={appNavigate} />, View.SUCCESS)} />

      <Route path="/post/:postId" element={<RouteHelper component={SinglePost} view={View.SINGLE_POST} navigate={appNavigate} paramKey="postId" withSidebarWrap={withSidebar} user={user} />} />
      <Route path="/profile" element={withSidebar(<Profile currentView={View.PROFILE} navigate={appNavigate} />, View.PROFILE)} />
      <Route path="/profile/:userId" element={<RouteHelper component={Profile} view={View.PROFILE} navigate={appNavigate} paramKey="userId" withSidebarWrap={withSidebar} user={user} />} />
      <Route path="/u/:username" element={<RouteHelper component={Profile} view={View.PROFILE} navigate={appNavigate} paramKey="username" withSidebarWrap={withSidebar} user={user} />} />

      <Route path="/project/:projectId" element={withSidebar(<ProjectDetailsWrapper navigate={appNavigate} />, View.PROJECT_DETAILS)} />
      <Route path="/sdg/:id" element={withSidebar(<SDGFeedWrapper navigate={appNavigate} />, View.SDG_FEED)} />
      <Route path="/hashtag/:tag" element={withSidebar(<HashtagFeedWrapper navigate={appNavigate} />, View.HASHTAG)} />

      <Route path="/projects/new" element={withSidebar(<CreateProject currentView={View.CREATE_PROJECT} navigate={appNavigate} />, View.CREATE_PROJECT)} />
      <Route path="/projects/edit/:projectId" element={withSidebar(<EditProjectWrapper navigate={appNavigate} />, View.EDIT_PROJECT)} />

      <Route path="/org/profile" element={withSidebar(<OrgProfile currentView={View.ORG_SETTINGS} navigate={appNavigate} />, View.ORG_SETTINGS)} />
      <Route path="/org/settings" element={withSidebar(<OrgSettings currentView={View.ORG_SETTINGS} navigate={appNavigate} params={{ editMode: true }} />, View.ORG_SETTINGS)} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Helpers para extraer parámetros de la ruta
function RouteHelper({ component: Component, view, navigate, paramKey, withSidebarWrap, user }: any) {
  const params = useParams();
  const navParams = { [paramKey]: params[paramKey] };
  const element = <Component currentView={view} navigate={navigate} params={navParams} />;
  return user ? withSidebarWrap(element, view) : element;
}

function ProjectDetailsWrapper({ navigate }: any) {
  const { projectId } = useParams();
  return <ProjectDetails currentView={View.PROJECT_DETAILS} navigate={navigate} params={{ projectId }} />;
}

function SDGFeedWrapper({ navigate }: any) {
  const { id } = useParams();
  return <SDGFeed currentView={View.SDG_FEED} navigate={navigate} params={{ id: parseInt(id || '0') }} />;
}

function HashtagFeedWrapper({ navigate }: any) {
  const { tag } = useParams();
  return <HashtagFeed currentView={View.HASHTAG} navigate={navigate} params={{ tag }} />;
}

function EditProjectWrapper({ navigate }: any) {
  const { projectId } = useParams();
  return <CreateProject currentView={View.EDIT_PROJECT} navigate={navigate} params={{ projectId }} />;
}

const App: React.FC = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return (
    <Router>
      <PayPalScriptProvider options={{
        clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID,
        vault: true,
        intent: "subscription"
      }}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </PayPalScriptProvider>
    </Router>
  );
};

export default App;