
import React, { useState } from 'react';
import { View, NavProps } from '../types';
import { PayPalButtons } from "@paypal/react-paypal-js";
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';

const PLAN_IDS: Record<string, string> = {
  'Básico': import.meta.env.VITE_PAYPAL_PLAN_BASIC,
  'Pro': import.meta.env.VITE_PAYPAL_PLAN_PRO,
  'Enterprise': import.meta.env.VITE_PAYPAL_PLAN_ENTERPRISE
};

// Mapeo de nombre de pantalla a valor en DB
const DB_PLAN_MAP: Record<string, string> = {
  'Básico': 'basic',
  'Pro': 'pro',
  'Enterprise': 'enterprise'
};

export const Checkout: React.FC<NavProps> = ({ navigate, params }) => {
  const { updateUser, user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default values in case params are missing
  const { plan = 'Pro', price = '9.99' } = params || {};
  const planId = PLAN_IDS[plan];

  const updatePlanDirectly = async (subscriptionId: string, planDbValue: string) => {
    // Actualización directa a Supabase como fallback de seguridad
    // Esto asegura que incluso si updateUser falla, el plan se actualice
    if (!user?.id) return false;

    try {
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          plan: planDbValue,
          paypal_subscription_id: subscriptionId,
          plan_updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (dbError) {
        console.error("Error en actualización directa a DB:", dbError);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Exception en actualización directa:", err);
      return false;
    }
  };

  const handleSubscriptionSuccess = async (data: any) => {
    try {
      setIsProcessing(true);
      setError(null);

      const dbPlanValue = DB_PLAN_MAP[plan] || plan.toLowerCase();
      const subscriptionId = data.subscriptionID;

      console.log(`✅ PayPal onApprove - Plan: ${dbPlanValue}, Sub ID: ${subscriptionId}, User: ${user?.id}`);

      // ESTRATEGIA DOBLE: Intentar ambas vías para máxima seguridad
      let updateSuccess = false;

      // Vía 1: updateUser del contexto (actualiza DB + estado local)
      try {
        await updateUser({
          plan: dbPlanValue as any,
          status: 'active',
          paypalSubscriptionId: subscriptionId,
          planUpdatedAt: new Date().toISOString()
        });
        updateSuccess = true;
        console.log("✅ Plan actualizado vía updateUser");
      } catch (updateErr: any) {
        console.error("⚠️ updateUser falló, intentando vía directa:", updateErr.message);

        // Vía 2: Actualización directa a Supabase (fallback)
        updateSuccess = await updatePlanDirectly(subscriptionId, dbPlanValue);
        if (updateSuccess) {
          console.log("✅ Plan actualizado vía directa a DB");
        }
      }

      if (updateSuccess) {
        // Navegar a éxito
        navigate(View.SUCCESS, {
          plan,
          subscriptionId: subscriptionId,
          orderId: data.orderID
        });
      } else {
        // Si AMBAS vías fallan, mostrar mensaje con el subscription ID
        // para que soporte pueda resolver manualmente
        setError(
          `El pago fue procesado exitosamente (ID: ${subscriptionId}), ` +
          `pero hubo un problema actualizando tu plan. ` +
          `Tu suscripción está activa en PayPal. Por favor contacta a soporte con este ID: ${subscriptionId}`
        );
      }
    } catch (err: any) {
      console.error("Error en handleSubscriptionSuccess:", err);
      setError(
        "La transacción fue exitosa pero hubo un problema actualizando tu perfil. " +
        "Tu pago está seguro. Por favor contacta a soporte."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FDFDFF] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden relative">
        <button
          onClick={() => navigate(View.PRICING)}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10"
          disabled={isProcessing}
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="p-8 text-center bg-slate-50 border-b border-slate-100">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 text-primary">
            <span className="material-symbols-outlined text-2xl filled">diamond</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Suscríbete a {plan}</h2>
          <p className="text-slate-500 text-sm mt-1">Desbloquea herramientas de impacto y maximiza tu alcance.</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="font-bold text-slate-900">Plan {plan}</p>
              <p className="text-xs text-slate-500">Facturación mensual</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-xl text-slate-900">${price}<span className="text-sm font-normal text-slate-500">/mes</span></p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {planId ? (
              <PayPalButtons
                style={{
                  shape: 'rect',
                  color: 'gold',
                  layout: 'vertical',
                  label: 'subscribe'
                }}
                disabled={isProcessing}
                createSubscription={(data, actions) => {
                  console.log(`🔄 Creando suscripción PayPal - Plan ID: ${planId}, User ID: ${user?.id}`);
                  return actions.subscription.create({
                    plan_id: planId,
                    custom_id: user?.id as string // Link transaction to this specific user ID
                  });
                }}
                onApprove={async (data, actions) => {
                  console.log("✅ PayPal onApprove disparado:", JSON.stringify(data));
                  await handleSubscriptionSuccess(data);
                }}
                onCancel={() => {
                  console.log("⚠️ PayPal: Transacción cancelada por el usuario");
                  setError("Transacción cancelada.");
                }}
                onError={(err) => {
                  console.error("❌ PayPal onError:", err);
                  // IMPORTANTE: onError puede dispararse INCLUSO cuando el pago fue exitoso
                  // pero hubo un error de red al cerrar el popup de PayPal.
                  // Por eso NO degradamos el plan aquí, solo mostramos un mensaje genérico.
                  setError(
                    "Hubo un error de comunicación con PayPal. " +
                    "Si completaste el pago, tu plan se actualizará automáticamente en unos momentos. " +
                    "Si no, inténtalo de nuevo."
                  );
                }}
              />
            ) : (
              <div className="p-4 bg-amber-50 text-amber-700 text-sm rounded-lg text-center font-medium">
                ID de Plan no configurado para {plan}.
              </div>
            )}
          </div>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center"><span className="bg-white px-2 text-xs text-slate-500">Pago seguro con encriptación SSL</span></div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <span className="material-symbols-outlined text-green-500 text-sm">verified_user</span>
            <p className="text-xs text-slate-500">Tus datos están protegidos. Renovación automática, cancela en cualquier momento.</p>
          </div>

          <div className="pt-4 text-center">
            <p className="text-[10px] text-slate-400">Total a pagar hoy: <span className="font-bold text-slate-600">${price} USD</span></p>
          </div>
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 font-bold text-slate-900">Actualizando tu perfil...</p>
          <p className="text-sm text-slate-500">Un momento por favor.</p>
        </div>
      )}
    </div>
  );
};