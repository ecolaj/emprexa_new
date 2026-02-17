-- LIMPIEZA Y CONFIGURACIÓN DE TRAZABILIDAD
-- Ejecuta este código completo en el SQL Editor de Supabase.

-- 1. Asegurar limpieza (Evita conflictos si ya existía algo)
DROP TRIGGER IF EXISTS tr_auth_user_updated ON auth.users;

-- 2. Crear tabla de logs
CREATE TABLE IF NOT EXISTS public.user_auth_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    event_type TEXT, 
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Seguridad e Índices
ALTER TABLE public.user_auth_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON public.user_auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON public.user_auth_logs(created_at);

-- 4. Función de captura avanzada
CREATE OR REPLACE FUNCTION public.on_auth_user_updated()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Detectar Cambio de Contraseña
    IF (OLD.encrypted_password <> NEW.encrypted_password) THEN
        INSERT INTO public.user_auth_logs (user_id, email, event_type)
        VALUES (NEW.id, NEW.email, 'PASSWORD_CHANGE');
    END IF;

    -- Detectar Login
    IF (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at) THEN
        INSERT INTO public.user_auth_logs (user_id, email, event_type)
        VALUES (NEW.id, NEW.email, 'LOGIN');
    END IF;

    -- Detectar Solicitud de Recuperación
    IF (OLD.recovery_sent_at IS DISTINCT FROM NEW.recovery_sent_at) THEN
        INSERT INTO public.user_auth_logs (user_id, email, event_type)
        VALUES (NEW.id, NEW.email, 'RECOVERY_REQUESTED');
    END IF;

    RETURN NEW;
END;
$$;

-- 5. Vincular función a la tabla auth.users
CREATE TRIGGER tr_auth_user_updated
AFTER UPDATE ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.on_auth_user_updated();
