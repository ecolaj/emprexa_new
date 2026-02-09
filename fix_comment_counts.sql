-- SCRIPT PARA REPARAR Y AUTOMATIZAR EL CONTEO DE COMENTARIOS Y LIKES
-- Este script:
-- 1. Recalcula los contadores actuales basándose en la realidad de las tablas.
-- 2. Crea funciones y triggers para que el conteo sea automático y no dependa del cliente.

-- 1. Función para actualizar el contador de comentarios
CREATE OR REPLACE FUNCTION public.handle_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.posts
        SET comments_count = (
            SELECT count(*) FROM public.comments WHERE post_id = NEW.post_id
        )
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.posts
        SET comments_count = (
            SELECT count(*) FROM public.comments WHERE post_id = OLD.post_id
        )
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Función para actualizar el contador de likes
CREATE OR REPLACE FUNCTION public.handle_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.posts
        SET likes_count = (
            SELECT count(*) FROM public.post_likes WHERE post_id = NEW.post_id
        )
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.posts
        SET likes_count = (
            SELECT count(*) FROM public.post_likes WHERE post_id = OLD.post_id
        )
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear Triggers para Comentarios
DROP TRIGGER IF EXISTS on_comment_change_update_count ON public.comments;
CREATE TRIGGER on_comment_change_update_count
    AFTER INSERT OR DELETE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.handle_comment_count();

-- 4. Crear Triggers para Likes de Posts
DROP TRIGGER IF EXISTS on_post_like_change_update_count ON public.post_likes;
CREATE TRIGGER on_post_like_change_update_count
    AFTER INSERT OR DELETE ON public.post_likes
    FOR EACH ROW EXECUTE FUNCTION public.handle_post_like_count();

-- 5. RE-SINCRONIZACIÓN INICIAL
-- Actualizar todos los posts con el conteo real actual
UPDATE public.posts p
SET 
    comments_count = (SELECT count(*) FROM public.comments c WHERE c.post_id = p.id),
    likes_count = (SELECT count(*) FROM public.post_likes l WHERE l.post_id = p.id);

-- 6. Función para likes en comentarios (opcional but recommended)
CREATE OR REPLACE FUNCTION public.handle_comment_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.comments
        SET likes_count = (
            SELECT count(*) FROM public.coment_like WHERE comment_id = NEW.comment_id
        )
        WHERE id = NEW.comment_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.comments
        SET likes_count = (
            SELECT count(*) FROM public.coment_like WHERE comment_id = OLD.comment_id
        )
        WHERE id = OLD.comment_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_like_change_update_count ON public.coment_like;
CREATE TRIGGER on_comment_like_change_update_count
    AFTER INSERT OR DELETE ON public.coment_like
    FOR EACH ROW EXECUTE FUNCTION public.handle_comment_like_count();

-- Actualizar likes reales en comentarios
UPDATE public.comments c
SET likes_count = (SELECT count(*) FROM public.coment_like l WHERE l.comment_id = c.id);
