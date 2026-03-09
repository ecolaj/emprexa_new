import React, { useState } from 'react';
import { View, NavProps } from '../types';
import { PayPalButtons } from "@paypal/react-paypal-js";
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const PLAN_IDS: Record<string, string> = {
  'basic': import.meta.env.VITE_PAYPAL_PLAN_BASIC,
  'pro': import.meta.env.VITE_PAYPAL_PLAN_PRO,
  'enterprise': import.meta.env.VITE_PAYPAL_PLAN_ENTERPRISE
};

export const Checkout: React.FC<NavProps> = ({ navigate, params }) => {
  const location = useLocation();
  const { user, updateUser } = useAuth();
  const { t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener parámetros del estado de navegación o de las props
  const { plan = 'pro', price = '9.99' } = { ...(location.state as any), ...params };
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

      const dbPlanValue = plan.toLowerCase();
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
          t('checkout.paymentSuccessProblem', { subscriptionId })
        );
      }
    } catch (err: any) {
      console.error("Error en handleSubscriptionSuccess:", err);
      setError(
        t('checkout.transactionSuccessError')
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
          <h2 className="text-2xl font-bold text-slate-900">{t('checkout.title', { plan: t(`pricing.plans.${plan}.name`) })}</h2>
          <p className="text-slate-500 text-sm mt-1">{t('checkout.subtitle')}</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="font-bold text-slate-900">{t('pricing.plans.' + plan + '.name')}</p>
              <p className="text-xs text-slate-500">{t('checkout.monthlyBilling')}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-xl text-slate-900">${price}<span className="text-sm font-normal text-slate-500">/{t('pricing.monthly')}</span></p>
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
                  setError(t('checkout.cancel'));
                }}
                onError={(err) => {
                  console.error("❌ PayPal onError:", err);
                  // IMPORTANTE: onError puede dispararse INCLUSO cuando el pago fue exitoso
                  // pero hubo un error de red al cerrar el popup de PayPal.
                  // Por eso NO degradamos el plan aquí, solo mostramos un mensaje genérico.
                  setError(t('checkout.error'));
                }}
              />
            ) : (
              <div className="p-4 bg-amber-50 text-amber-700 text-sm rounded-lg text-center font-medium">
                {t('checkout.noId', { plan: t(`pricing.plans.${plan}.name`) })}
              </div>
            )}
          </div>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center"><span className="bg-white px-2 text-xs text-slate-500">{t('checkout.securePayment')}</span></div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <span className="material-symbols-outlined text-green-500 text-sm">verified_user</span>
            <p className="text-xs text-slate-500">{t('checkout.protectedData')}</p>
          </div>

          <div className="pt-4 text-center">
            <p className="text-[10px] text-slate-400">{t('checkout.totalToday')} <span className="font-bold text-slate-600">${price} USD</span></p>
          </div>
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 font-bold text-slate-900">{t('checkout.updatingProfile')}</p>
          <p className="text-sm text-slate-500">{t('checkout.oneMoment')}</p>
        </div>
      )}
    </div>
  );
};