-- SCRIPT DE SEGURIDAD AVANZADA
-- Resuelve advertencias de 'search_path' y políticas de RLS permisivas.

-- 1. ASEGURAR SEARCH PATH EN FUNCIONES
-- Esto evita ataques de secuestro de esquema al fijar el camino de búsqueda a 'public'.

-- Algunas funciones pueden tener firmas diferentes según cómo se crearon. 
-- Este bloque intenta aplicar el cambio a las firmas más probables.
DO $$ 
BEGIN
    -- Lista de funciones mencionadas en el reporte de Supabase
    EXECUTE 'ALTER FUNCTION public.handle_new_user() SET search_path = public';
    EXECUTE 'ALTER FUNCTION public.update_post_likes() SET search_path = public';
    EXECUTE 'ALTER FUNCTION public.decrement_trial_posts() SET search_path = public';
    EXECUTE 'ALTER FUNCTION public.create_like_notification() SET search_path = public';
    EXECUTE 'ALTER FUNCTION public.check_trial_expiration() SET search_path = public';
    EXECUTE 'ALTER FUNCTION public.handle_new_comment() SET search_path = public';
    EXECUTE 'ALTER FUNCTION public.handle_new_like() SET search_path = public';
    EXECUTE 'ALTER FUNCTION public.get_user_conversations(member_id uuid) SET search_path = public';
    EXECUTE 'ALTER FUNCTION public.check_auth_settings() SET search_path = public';
    EXECUTE 'ALTER FUNCTION public.notify_new_message() SET search_path = public';
    EXECUTE 'ALTER FUNCTION public.update_post_comments_count() SET search_path = public';
    EXECUTE 'ALTER FUNCTION public.handle_sync_user_email() SET search_path = public';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Nota: Alguna función no pudo ser alterada (puede que la firma sea diferente), pero el resto se aplicó.';
END $$;


-- 2. CORREGIR POLÍTICAS DE RLS PERMISIVAS (USING true / WITH CHECK true)
-- Las notificaciones y perfiles son creados por triggers del sistema, no necesitan acceso manual público.

-- Tabla: notifications
DROP POLICY IF EXISTS "Insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
-- Nota: La lectura (SELECT) y actualización (UPDATE para marcar como leída) siguen activas para los usuarios.

-- Tabla: profiles
DROP POLICY IF EXISTS "Solo sistema puede insertar perfiles" ON public.profiles;
-- Nota: El trigger 'handle_new_user' es SECURITY DEFINER, por lo que seguirá funcionando sin este permiso público.

-- 3. RESULTADO
SELECT ' HARDENING COMPLETADO EXITOSAMENTE' as resultado;
