-- Migration: Agregar campos para manejo de período de gracia en cancelaciones
-- Permite mantener el plan activo hasta el fin del período pagado

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';

-- Índice para consultas de expiración (útil para futuros jobs de limpieza)
CREATE INDEX IF NOT EXISTS idx_profiles_plan_expires_at 
  ON public.profiles(plan_expires_at) 
  WHERE plan_expires_at IS NOT NULL;

-- Comentarios para documentación
COMMENT ON COLUMN public.profiles.plan_expires_at IS 'Fecha en que expira el plan tras una cancelación. NULL si la suscripción está activa.';
COMMENT ON COLUMN public.profiles.subscription_status IS 'Estado de la suscripción PayPal: active, cancelled. Distinto del plan mismo.';
