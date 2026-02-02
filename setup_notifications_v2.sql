-- setup_notifications_v2.sql

-- 1. Asegurar tabla de notificaciones con campo link_id
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- Receptor
    notifier_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Actor (quien da like/comenta)
    type TEXT CHECK (type IN ('like', 'comment', 'follow', 'mention')) NOT NULL,
    content TEXT NOT NULL,
    link_id INTEGER, -- ID del post relacionado (opcional)
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Agregar columna link_id si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'link_id') THEN
        ALTER TABLE public.notifications ADD COLUMN link_id INTEGER;
    END IF;
END $$;

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas (Usuarios ven sus propias notificaciones)
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- System can insert (o triggers con rol postgres/service_role)
-- Permitimos insert público por ahora para facilitar funciones frontend si fuera necesario, 
-- pero idealmente solo triggers insertan.
CREATE POLICY "Insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);


-- 2. TRIGGER PARA COMENTARIOS
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

    -- No notificar si uno se comenta a sí mismo
    IF post_owner_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Obtener nombre del comentador
    SELECT name INTO commenter_name
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    -- Si no hay nombre, usar default
    IF commenter_name IS NULL THEN
        commenter_name := 'Alguien';
    END IF;

    -- Truncar título si es muy largo
    IF CHAR_LENGTH(post_title) > 30 THEN
        truncated_title := SUBSTRING(post_title FROM 1 FOR 30) || '...';
    ELSE
        truncated_title := post_title;
    END IF;

    -- Insertar notificación
    INSERT INTO public.notifications (user_id, notifier_id, type, content, link_id)
    VALUES (
        post_owner_id, 
        NEW.user_id, 
        'comment', 
        commenter_name || ' comentó tu post "' || truncated_title || '"',
        NEW.post_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger si existe para recrearlo
DROP TRIGGER IF EXISTS on_comment_create_notification ON public.comments;
CREATE TRIGGER on_comment_create_notification
    AFTER INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_comment();


-- 3. TRIGGER PARA LIKES
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

    -- No notificar si uno se da like a sí mismo
    IF post_owner_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Obtener nombre del que da like
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

    -- Insertar notificación
    INSERT INTO public.notifications (user_id, notifier_id, type, content, link_id)
    VALUES (
        post_owner_id, 
        NEW.user_id, 
        'like', 
        liker_name || ' dio like a tu post "' || truncated_title || '"',
        NEW.post_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger si existe
DROP TRIGGER IF EXISTS on_like_create_notification ON public.post_likes;
CREATE TRIGGER on_like_create_notification
    AFTER INSERT ON public.post_likes
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_like();
