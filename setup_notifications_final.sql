-- SCRIPT FINAL DE CONFIGURACIÓN DE NOTIFICACIONES
-- Basado en la estructura confirmada de tu base de datos.
-- Este script es seguro de ejecutar: verifica existencia de columnas y recrea triggers limpiamente.

-- 1. Asegurar columna 'link_id' en la tabla 'notifications'
-- Esta columna sirve para navegar al post/contenido cuando se hace clic en la notificación.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'link_id') THEN
        ALTER TABLE public.notifications ADD COLUMN link_id INTEGER;
    END IF;
END $$;

-- 2. Asegurar que las políticas de seguridad (RLS) permitan insertar notificaciones
-- Esto es necesario para que los triggers funcionen correctamente bajo el contexto de seguridad.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Permitir que el sistema (triggers) y usuarios autenticados inserten notificaciones
-- (Nota: Idealmente solo el sistema debería, pero para evitar errores de permisos en desarrollo:)
DROP POLICY IF EXISTS "Insert notifications" ON public.notifications;
CREATE POLICY "Insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- 3. FUNCIÓN Y TRIGGER PARA COMENTARIOS
CREATE OR REPLACE FUNCTION public.handle_new_comment()
RETURNS TRIGGER AS $$
DECLARE
    post_owner_id UUID;
    post_title TEXT;
    commenter_name TEXT;
    truncated_title TEXT;
BEGIN
    -- Obtener dueño del post y título
    SELECT user_id, title INTO post_owner_id, post_title
    FROM public.posts
    WHERE id = NEW.post_id;

    -- No notificar si el dueño del post es quien comenta (auto-comentario)
    IF post_owner_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Obtener nombre del usuario que comenta
    SELECT name INTO commenter_name
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    -- Fallback si no tiene nombre
    IF commenter_name IS NULL THEN
        commenter_name := 'Alguien';
    END IF;

    -- Truncar el título para que no ocupe toda la notificación
    IF CHAR_LENGTH(post_title) > 30 THEN
        truncated_title := SUBSTRING(post_title FROM 1 FOR 30) || '...';
    ELSE
        truncated_title := post_title;
    END IF;

    -- Insertar la notificación
    INSERT INTO public.notifications (user_id, notifier_id, type, content, link_id, read)
    VALUES (
        post_owner_id,      -- Para quién es (dueño del post)
        NEW.user_id,        -- Quién la causó (comentador)
        'comment',          -- Tipo
        commenter_name || ' comentó tu post "' || truncated_title || '"', -- Mensaje formateado
        NEW.post_id,        -- ID para el enlace
        false               -- No leída
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER permite que el trigger tenga permisos de admin

-- Recrear el trigger de comentarios
DROP TRIGGER IF EXISTS on_comment_create_notification ON public.comments;
CREATE TRIGGER on_comment_create_notification
    AFTER INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_comment();


-- 4. FUNCIÓN Y TRIGGER PARA LIKES
CREATE OR REPLACE FUNCTION public.handle_new_like()
RETURNS TRIGGER AS $$
DECLARE
    post_owner_id UUID;
    post_title TEXT;
    liker_name TEXT;
    truncated_title TEXT;
BEGIN
    -- Obtener dueño del post y título
    SELECT user_id, title INTO post_owner_id, post_title
    FROM public.posts
    WHERE id = NEW.post_id;

    -- No notificar autolikes
    IF post_owner_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Obtener nombre del usuario que da like
    SELECT name INTO liker_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    IF liker_name IS NULL THEN
        liker_name := 'Alguien';
    END IF;

    IF CHAR_LENGTH(post_title) > 30 THEN
        truncated_title := SUBSTRING(post_title FROM 1 FOR 30) || '...';
    ELSE
        truncated_title := post_title;
    END IF;

    -- Insertar la notificación
    INSERT INTO public.notifications (user_id, notifier_id, type, content, link_id, read)
    VALUES (
        post_owner_id,
        NEW.user_id,
        'like',
        liker_name || ' dio like a tu post "' || truncated_title || '"',
        NEW.post_id,
        false
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger de likes
DROP TRIGGER IF EXISTS on_like_create_notification ON public.post_likes;
CREATE TRIGGER on_like_create_notification
    AFTER INSERT ON public.post_likes
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_like();

