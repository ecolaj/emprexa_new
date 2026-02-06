
import React from 'react';
import { View, NavProps } from '../types';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';
import { LogoutModal } from './LogoutModal';
import { useState } from 'react';

interface SidebarProps extends NavProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, navigate, isOpen = false, onClose }) => {
  const { logout, totalUnreadMessages, totalUnreadNotifications } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const menuItems = [
    { view: View.SEARCH, icon: 'search', label: 'Buscar' },
    { view: View.FEED, icon: 'public', label: 'Feed' },
    { view: View.EXPLORE, icon: 'rocket_launch', label: 'Explorar' },
    { view: View.MESSAGES, icon: 'chat', label: 'Mensajes', badge: totalUnreadMessages },
    { view: View.SAVED, icon: 'bookmark', label: 'Guardados' },
    { view: View.NOTIFICATIONS, icon: 'notifications', label: 'Notificaciones', badge: totalUnreadNotifications },
    { view: View.PROFILE, icon: 'person', label: 'Mi Perfil' },
    { view: View.DASHBOARD, icon: 'dashboard', label: 'Panel de Impacto' },
  ];

  const settingsItems = [
    { view: View.SETTINGS, icon: 'settings', label: 'Cuenta' },
  ];

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    if (onClose) onClose();
    await logout();
  };

  const handleNavigation = (view: View) => {
    navigate(view);
    if (onClose) onClose(); // Close mobile menu on navigation
  };

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-[190] lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        ></div>
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-[200] lg:z-auto w-72 lg:w-64 bg-white border-r border-slate-200 
        transform transition-transform duration-300 ease-in-out flex flex-col h-full shrink-0 shadow-2xl lg:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigation(View.FEED)}>
              <Logo className="h-9" />
            </div>
            {/* Close button only visible on mobile */}
            <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.view}
                onClick={() => handleNavigation(item.view)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors font-medium text-sm group ${currentView === item.view
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined ${currentView === item.view || (item.view === View.SAVED && currentView === View.SAVED) ? 'filled' : ''}`}>
                    {item.icon}
                  </span>
                  {item.label}
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${currentView === item.view
                    ? 'bg-primary text-white'
                    : 'bg-red-500 text-white group-hover:bg-red-600'
                    }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-8">
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Configuración</p>
            <nav className="space-y-1">
              {settingsItems.map((item) => (
                <button
                  key={item.view}
                  onClick={() => handleNavigation(item.view)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${currentView === item.view
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <span className={`material-symbols-outlined ${currentView === item.view ? 'filled' : ''}`}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Footer Area */}
        <div className="p-4 border-t border-slate-100 space-y-4 bg-white">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 text-white">
            <p className="text-xs font-bold text-slate-300 mb-1">Actualizar tu plan</p>
            <p className="text-xs text-slate-400 mb-3 leading-snug">Desbloquea función de post, creación de proyectos, dashboards, métricas de impacto.</p>
            <button
              onClick={() => handleNavigation(View.PRICING)}
              className="w-full py-2 bg-white text-slate-900 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors"
            >
              Ver Planes
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors font-medium text-sm"
          >
            <span className="material-symbols-outlined">logout</span>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
      />
    </>
  );
};
