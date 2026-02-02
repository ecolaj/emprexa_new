
import React from 'react';
import { View, NavProps } from '../types';
import { useAuth } from '../context/AuthContext';

export const Pricing: React.FC<NavProps> = ({ navigate }) => {
  const { user } = useAuth();
  const currentPlan = user?.plan || 'free';

  const PricingButton: React.FC<{
    planName: string,
    price: string,
    targetPlan: string,
    variant?: 'outline' | 'blue' | 'amber' | 'purple'
  }> = ({ planName, price, targetPlan, variant = 'blue' }) => {

    const isCurrent = currentPlan === targetPlan;

    const styles = {
      outline: "border-slate-200 text-slate-700 hover:border-slate-300 bg-slate-50",
      blue: "bg-blue-50 text-blue-700 hover:bg-blue-100",
      amber: "bg-amber-400 text-white hover:bg-amber-500 shadow-lg shadow-amber-400/30",
      purple: "bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-900/50"
    };

    return (
      <button
        onClick={() => !isCurrent && navigate(View.CHECKOUT, { plan: planName, price })}
        disabled={isCurrent}
        className={`w-full py-3 rounded-xl font-bold transition-all ${styles[variant]} ${isCurrent ? 'opacity-70 cursor-default' : 'hover:-translate-y-0.5'}`}
      >
        {isCurrent ? 'Tu Plan Actual' : (currentPlan === 'free' ? 'Seleccionar' : 'Cambiar Plan')}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background-light py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="bg-blue-50 text-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Impacto Global</span>
        <h1 className="text-4xl font-black text-slate-900 mt-4 mb-4">Planes de Suscripción</h1>
        <p className="text-xl text-slate-500">Elige las herramientas adecuadas para tu nivel de impacto.</p>


      </div>

      <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 pb-12">

        {/* FREE */}
        <div className={`bg-white rounded-2xl shadow-sm border p-6 transition-all flex flex-col ${currentPlan === 'free' ? 'border-primary ring-2 ring-primary/10' : 'border-slate-200'}`}>
          <h3 className="text-lg font-bold text-slate-900 flex justify-between">Free {currentPlan === 'free' && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Actual</span>}</h3>
          <div className="my-4 flex items-baseline">
            <span className="text-4xl font-black text-slate-900">$0</span>
            <span className="text-slate-500">/mes</span>
          </div>
          <p className="text-sm text-slate-500 mb-6 flex-1">Para observadores y entusiastas.</p>

          <div className="space-y-4 mb-8">
            <p className="text-xs font-bold uppercase text-slate-400">Incluye:</p>
            <ul className="space-y-3">
              {['Ver Publicaciones y Proyectos', 'Interactuar (Like, Comentar)', 'Visualizar Perfiles', 'Chat Básico'].map(feat => (
                <li key={feat} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="material-symbols-outlined text-green-500 text-lg">check</span> {feat}
                </li>
              ))}
              <li className="flex items-start gap-3 text-sm text-slate-400 decoration-slate-300">
                <span className="material-symbols-outlined text-slate-300 text-lg">close</span> Publicar contenido
              </li>
            </ul>
          </div>
          <button disabled className="w-full py-3 rounded-xl border border-slate-200 font-bold text-slate-400 bg-slate-50 cursor-default">
            {currentPlan === 'free' ? 'Plan Actual' : 'Incluido'}
          </button>
        </div>

        {/* BASIC */}
        <div className={`bg-white rounded-2xl shadow-sm border p-6 transition-all flex flex-col ${currentPlan === 'basic' ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200'}`}>
          <h3 className="text-lg font-bold text-blue-600 flex justify-between">Básico {currentPlan === 'basic' && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">Actual</span>}</h3>
          <div className="my-4 flex items-baseline">
            <span className="text-4xl font-black text-slate-900">$4.99</span>
            <span className="text-slate-500">/mes</span>
          </div>
          <p className="text-sm text-slate-500 mb-6 flex-1">Para empezar a compartir tu voz.</p>

          <div className="space-y-4 mb-8">
            <p className="text-xs font-bold uppercase text-slate-400">Todo en Free más:</p>
            <ul className="space-y-3">
              {['Publicar Posts (Texto/Img)', 'Panel de Impacto Básico', 'Interacción en mis posts'].map(feat => (
                <li key={feat} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="material-symbols-outlined text-green-500 text-lg">check</span> {feat}
                </li>
              ))}
            </ul>
          </div>
          <PricingButton planName="Básico" price="4.99" targetPlan="basic" variant="blue" />
        </div>

        {/* PRO */}
        <div className={`bg-white rounded-2xl shadow-xl border-2 p-6 relative transform xl:-translate-y-4 flex flex-col transition-all ${currentPlan === 'pro' ? 'border-amber-500 ring-4 ring-amber-500/10' : 'border-amber-400'}`}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-400 text-white text-xs font-bold px-3 py-1 rounded-full uppercase shadow-sm">Popular</div>
          <h3 className="text-lg font-bold text-amber-600 flex justify-between">Pro {currentPlan === 'pro' && <span className="text-xs bg-amber-100 text-amber-600 px-2 py-1 rounded-full">Actual</span>}</h3>
          <div className="my-4 flex items-baseline">
            <span className="text-5xl font-black text-slate-900">$9.99</span>
            <span className="text-slate-500">/mes</span>
          </div>
          <p className="text-sm text-slate-500 mb-6 flex-1">Para líderes de opinión y análisis.</p>

          <div className="space-y-4 mb-8">
            <p className="text-xs font-bold uppercase text-slate-400">Todo en Básico más:</p>
            <ul className="space-y-3">
              {['Métricas Avanzadas', 'Estadísticas de ODS', 'Filtros de fecha en Panel', 'Exportar Reportes', 'Badge PRO'].map(feat => (
                <li key={feat} className="flex items-start gap-3 text-sm text-slate-900 font-medium">
                  <span className="material-symbols-outlined text-amber-500 text-lg filled">check_circle</span> {feat}
                </li>
              ))}
            </ul>
          </div>
          <PricingButton planName="Pro" price="9.99" targetPlan="pro" variant="amber" />
        </div>

        {/* ENTERPRISE */}
        <div className={`bg-slate-900 rounded-2xl shadow-sm border p-6 text-white transition-all flex flex-col ${currentPlan === 'enterprise' ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-800'}`}>
          <h3 className="text-lg font-bold text-purple-400 flex justify-between">Enterprise {currentPlan === 'enterprise' && <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">Actual</span>}</h3>
          <div className="my-4 flex items-baseline">
            <span className="text-4xl font-black text-white">$19.99</span>
            <span className="text-slate-400">/mes</span>
          </div>
          <p className="text-sm text-slate-400 mb-6 flex-1">Para organizaciones y creadores de cambio.</p>

          <div className="space-y-4 mb-8">
            <p className="text-xs font-bold uppercase text-slate-500">Todo en Pro más:</p>
            <ul className="space-y-3">
              {['Publicar Proyectos Completos', 'Gestión de Equipos', 'Acceso Total al Panel', 'Badge Enterprise', 'Soporte Prioritario'].map(feat => (
                <li key={feat} className="flex items-start gap-3 text-sm text-slate-200">
                  <span className="material-symbols-outlined text-purple-400 text-lg">check</span> {feat}
                </li>
              ))}
            </ul>
          </div>
          <PricingButton planName="Enterprise" price="19.99" targetPlan="enterprise" variant="purple" />
        </div>

      </div>
    </div>
  );
};