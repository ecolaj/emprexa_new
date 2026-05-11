import React from 'react';
import { View, NavProps } from '../types';
import { useAuth } from '../context/AuthContext';

export const BottomNav: React.FC<NavProps> = ({ currentView, navigate }) => {
  const { totalUnreadNotifications } = useAuth();

  const navItems = [
    { view: View.FEED, icon: 'public', label: 'Feed' },
    { view: View.SEARCH, icon: 'search', label: 'Search' },
    // Center button will be handled separately
    { view: View.NOTIFICATIONS, icon: 'notifications', label: 'Notifs', badge: totalUnreadNotifications },
    { view: View.PROFILE, icon: 'person', label: 'Profile' },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 z-[100] pb-safe">
      <div className="flex justify-around items-center h-16 px-2">
        {/* Left items */}
        {navItems.slice(0, 2).map((item) => (
          <button
            key={item.view}
            onClick={() => navigate(item.view)}
            className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
              currentView === item.view ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className={`material-symbols-outlined text-[26px] ${currentView === item.view ? 'filled' : ''}`}>
              {item.icon}
            </span>
          </button>
        ))}

        <div className="relative -top-5">
          <button
            onClick={() => navigate(View.FEED, { createPost: true })}
            className="flex items-center justify-center w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark hover:scale-105 transition-transform"
          >
            <span className="material-symbols-outlined text-[32px]">add</span>
          </button>
        </div>

        {/* Right items */}
        {navItems.slice(2, 4).map((item) => (
          <button
            key={item.view}
            onClick={() => navigate(item.view)}
            className={`relative flex flex-col items-center justify-center w-16 h-full transition-colors ${
              currentView === item.view ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className={`material-symbols-outlined text-[26px] ${currentView === item.view ? 'filled' : ''}`}>
              {item.icon}
            </span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="absolute top-2 right-3 flex items-center justify-center min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full px-1 border-2 border-white">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
