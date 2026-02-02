
import React from 'react';
import { View, NavProps } from '../types';

export const Success: React.FC<NavProps> = ({ navigate, params }) => {
  const { plan = 'Pro', subscriptionId } = params || {};

  // Calcular fecha de próximo cargo (1 mes desde hoy)
  const nextCharge = new Date();
  nextCharge.setMonth(nextCharge.getMonth() + 1);
  const formattedNextCharge = nextCharge.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background-light flex items-center justify-center p-4 relative overflow-hidden">
      {/* Confetti simulation dots */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="absolute w-2 h-2 rounded-full animate-bounce"
            style={{
              top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
              backgroundColor: ['#E5243B', '#33CC33', '#359EFF', '#FCC30B'][Math.floor(Math.random() * 4)],
              opacity: 0.6,
              animationDelay: `${Math.random() * 2}s`
            }}></div>
        ))}
      </div>

      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden animate-[pulse_0.5s_ease-out]">
        <div className="text-center p-12 pb-8">
          <div className="inline-flex p-4 rounded-full bg-green-100 text-green-600 mb-6 shadow-sm">
            <span className="material-symbols-outlined text-5xl">verified</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-4">
            ¡Bienvenido a la comunidad <span className="text-primary">{plan}</span>!
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Tu suscripción se ha procesado correctamente. Hemos desbloqueado todas las funciones de tu nuevo nivel de impacto.
          </p>
        </div>

        <div className="bg-slate-50 border-y border-slate-100 p-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Plan Actual</p>
            <p className="text-lg font-bold text-slate-900 flex items-center justify-center md:justify-start gap-2">
              Emprexa {plan} <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded">Activo</span>
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Suscripción ID</p>
            <p className="text-sm font-mono text-slate-600 truncate">{subscriptionId || 'S-RECXXXXXXX'}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Próximo cargo</p>
            <p className="text-lg font-bold text-slate-900">{formattedNextCharge}</p>
          </div>
        </div>

        <div className="p-12 text-center space-y-4">
          <button
            onClick={() => navigate(View.FEED)}
            className="w-full md:w-auto bg-primary text-white px-8 py-4 rounded-xl text-lg font-bold shadow-lg shadow-primary/30 hover:bg-primary-dark hover:-translate-y-1 transition-all inline-flex items-center justify-center gap-2"
          >
            Comenzar a explorar <span className="material-symbols-outlined">rocket_launch</span>
          </button>
          <p className="text-xs text-slate-400">Recibirás un correo de confirmación de PayPal en unos minutos.</p>
        </div>
      </div>
    </div>
  );
};
