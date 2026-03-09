import React from 'react';
import { View, NavProps } from '../types';
import { useAuth } from '../context/AuthContext';
import { DashboardBasic } from '../components/dashboard/DashboardBasic';
import { DashboardPro } from '../components/dashboard/DashboardPro';
import { DashboardEnterprise } from '../components/dashboard/DashboardEnterprise';
import { useLanguage } from '../context/LanguageContext';

export const Dashboard: React.FC<NavProps> = (props) => {
  const { user: authUser } = useAuth();
  const { t } = useLanguage();

  if (!authUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="size-16 bg-slate-200 rounded-full mb-4"></div>
          <div className="h-4 w-48 bg-slate-200 rounded-full"></div>
        </div>
      </div>
    );
  }

  // --- FREE PLAN GATE ---
  // The user explicitly requested that Free users see an upgrade prompt for Dashboard
  if (authUser.plan === 'free') {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="text-center max-w-md bg-white p-12 rounded-[56px] shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-700">
          <div className="size-24 bg-blue-50 text-blue-500 rounded-[32px] flex items-center justify-center mx-auto mb-10 rotate-6 shadow-inner">
            <span className="material-symbols-outlined text-5xl filled">analytics</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">{t('dashboard.gateTitle')}</h2>
          <p className="text-slate-500 mb-10 text-lg leading-relaxed">
            {t('dashboard.gateSubtitle').split('{premium}')[0]}
            <span className="text-blue-500 font-extrabold">{t('dashboard.premiumLabel')}</span>
            {t('dashboard.gateSubtitle').split('{premium}')[1]}
          </p>
          <button
            onClick={() => props.navigate(View.PRICING)}
            className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black shadow-2xl hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all text-lg flex items-center justify-center gap-3"
          >
            <span className="material-symbols-outlined font-black">upgrade</span>
            {t('dashboard.upgradeBtn')}
          </button>
        </div>
      </div>
    );
  }

  // --- PLAN SWITCHER ---
  switch (authUser.plan) {
    case 'basic':
      return <DashboardBasic {...props} />;
    case 'pro':
      return <DashboardPro {...props} />;
    case 'enterprise':
      return <DashboardEnterprise {...props} />;
    default:
      // Fallback for any unknown plan, treat as basic
      return <DashboardBasic {...props} />;
  }
};
