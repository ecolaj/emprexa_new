-- SCRIPT DE LIMPIEZA Y REPARACIÓN DE TRIGGERS
-- Este script elimina triggers antiguos o duplicados que pueden estar causando conflictos
-- y asegura que la lógica de notificaciones sea la única activa.

-- 1. Eliminar triggers duplicados o zombies en 'post_likes'
DROP TRIGGER IF EXISTS on_like_notification ON public.post_likes;
DROP TRIGGER IF EXISTS on_post_like ON public.post_likes; -- Si existe duplicado
DROP TRIGGER IF EXISTS on_like_create_notification ON public.post_likes; -- Lo borramos para recrearlo limpio

-- 2. Eliminar triggers en 'comments'
DROP TRIGGER IF EXISTS on_comment_create_notification ON public.comments; -- Lo borramos para recrearlo limpio

-- 3. Asegurar que la función de comentarios sea robusta
CREATE OR REPLACE FUNCTION public.handle_new_comment()
RETURNS TRIGGER AS $$
DECLARE
    post_owner_id UUID;
    post_title TEXT;
    commenter_name TEXT;
    truncated_title TEXT;
BEGIN
    -- Obtener datos del post
    SELECT user_id, title INTO post_owner_id, post_title
    FROM public.posts
    WHERE id = NEW.post_id;

    -- Si no se encuentra el post, salir (evitar error)
    IF post_owner_id IS NULL THEN
        RAISE WARNING 'Post no encontrado para notification: %', NEW.post_id;
        RETURN NEW;
    END IF;

    -- No notificar si es auto-comentario
    IF post_owner_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Obtener nombre del perfil
    SELECT name INTO commenter_name
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    IF commenter_name IS NULL THEN
        commenter_name := 'Alguien';
    END IF;

    -- Truncar título
    IF post_title IS NULL OR post_title = '' THEN
        truncated_title := 'una publicación';
    ELSIF CHAR_LENGTH(post_title) > 30 THEN
        truncated_title := SUBSTRING(post_title FROM 1 FOR 30) || '...';
    ELSE
        truncated_title := post_title;
    END IF;

    -- Insertar notificación con manejo de error
    BEGIN
        INSERT INTO public.notifications (user_id, notifier_id, type, content, link_id, read)
        VALUES (
            post_owner_id, 
            NEW.user_id, 
            'comment', 
            commenter_name || ' comentó tu post "' || truncated_title || '"',
            NEW.post_id,
            false
        );
    EXCEPTION WHEN OTHERS THEN
        -- Si falla la inserción (ej. FK), no abortar el comentario
        RAISE WARNING 'Error creando notificacion: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Asegurar función de likes
CREATE OR REPLACE FUNCTION public.handle_new_like()
RETURNS TRIGGER AS $$
DECLARE
    post_owner_id UUID;
    post_title TEXT;
    liker_name TEXT;
    truncated_title TEXT;
BEGIN
    SELECT user_id, title INTO post_owner_id, post_title
    FROM public.posts
    WHERE id = NEW.post_id;

    IF post_owner_id IS NULL THEN RETURN NEW; END IF;
    IF post_owner_id = NEW.user_id THEN RETURN NEW; END IF;

    SELECT name INTO liker_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    IF liker_name IS NULL THEN liker_name := 'Alguien'; END IF;

    IF post_title IS NULL OR post_title = '' THEN
        truncated_title := 'una publicación';
    ELSIF CHAR_LENGTH(post_title) > 30 THEN
        truncated_title := SUBSTRING(post_title FROM 1 FOR 30) || '...';
    ELSE
        truncated_title := post_title;
    END IF;

    BEGIN
        INSERT INTO public.notifications (user_id, notifier_id, type, content, link_id, read)
        VALUES (
            post_owner_id,
            NEW.user_id,
            'like',
            liker_name || ' dio like a tu post "' || truncated_title || '"',
            NEW.post_id,
            false
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error creando notificacion like: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recrear Triggers Limpios
CREATE TRIGGER on_comment_create_notification
    AFTER INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_comment();

CREATE TRIGGER on_like_create_notification
    AFTER INSERT ON public.post_likes
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_like();

-- 6. Asegurar permisos en Profiles para que todos puedan leer nombres (esencial para 'notifier')
-- Ajusta esta política según tu privacidad, pero para una red social, leer nombres/updates suele ser público.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public profiles access'
    ) THEN
        CREATE POLICY "Public profiles access" ON public.profiles FOR SELECT USING (true);
    END IF;
END $$;
