import React, { useEffect, useState } from 'react';
import { View, NavProps, User, ID, Post } from '../types';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { useLanguage } from '../context/LanguageContext';

export const Notifications: React.FC<NavProps> = ({ navigate }) => {
  const { t } = useLanguage();
  const {
    user: authUser,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    isLoading: authLoading
  } = useAuth();

  useEffect(() => {
    // If we want to mark all as read when entering the page, we could call markAllNotificationsAsRead() here.
    // However, it's better to let the user do it or mark individual ones on click to remove the badge.
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-black text-slate-900">{t('notifications.title')}</h1>
          {notifications.some(n => !n.read) && (
            <button
              onClick={markAllNotificationsAsRead}
              className="text-sm font-bold text-primary hover:underline"
            >
              {t('notifications.markAllRead')}
            </button>
          )}
        </div>

        <div className="space-y-2 animate-[fade-in_0.3s_ease-out]">
          {notifications.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
              <div className="size-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <span className="material-symbols-outlined text-3xl">notifications_off</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">{t('notifications.emptyTitle')}</h3>
              <p className="text-sm text-slate-500">{t('notifications.emptyDesc')}</p>
            </div>
          ) : (
            notifications.map((notif) => {
              let icon = 'notifications';
              let iconColor = 'bg-slate-200 text-slate-500';

              switch (notif.type) {
                case 'like':
                  icon = 'favorite';
                  iconColor = 'bg-red-100 text-red-500';
                  break;
                case 'comment':
                  icon = 'chat_bubble';
                  iconColor = 'bg-blue-100 text-blue-500';
                  break;
                case 'follow':
                  icon = 'person_add';
                  iconColor = 'bg-green-100 text-green-500';
                  break;
                case 'mention':
                  icon = 'alternate_email';
                  iconColor = 'bg-amber-100 text-amber-500';
                  break;
              }

              return (
                <div
                  key={notif.id}
                  className={`relative flex gap-4 p-4 rounded-xl border transition-all cursor-pointer ${notif.read
                    ? 'bg-white border-slate-100 hover:border-slate-200'
                    : 'bg-blue-50/50 border-blue-100 hover:border-blue-200'
                    }`}
                  onClick={() => {
                    markNotificationAsRead(notif.id);
                    if (notif.type === 'follow') {
                      navigate(View.PROFILE, { userId: notif.user.id });
                    } else if (notif.linkId) {
                      navigate(View.SINGLE_POST, { id: notif.linkId });
                    }
                  }}
                >
                  {!notif.read && (
                    <div className="absolute top-4 right-4 size-2 rounded-full bg-red-500"></div>
                  )}

                  <div className="relative shrink-0">
                    <div
                      className="size-12 rounded-full bg-cover bg-center border border-slate-200"
                      style={{ backgroundImage: `url("${notif.user.avatar}")` }}
                    ></div>
                    <div className={`absolute -bottom-1 -right-1 size-6 rounded-full border-2 border-white flex items-center justify-center ${iconColor}`}>
                      <span className="material-symbols-outlined text-[14px] filled">{icon}</span>
                    </div>
                  </div>

                  <div className="flex-1 pt-1">
                    <p className="text-sm text-slate-800 leading-relaxed">
                      <span className="font-bold text-slate-900 hover:underline" onClick={(e) => {
                        e.stopPropagation();
                        navigate(View.PROFILE, { userId: notif.user.id });
                      }}>{notif.user.name}</span> {notif.content}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {notif.time && <span className="text-xs text-slate-400 font-medium">{notif.time}</span>}
                      {!notif.read && <span className="text-[10px] text-primary font-bold uppercase tracking-wider">{t('notifications.new')}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
