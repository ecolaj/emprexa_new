-- SCRIPT DE CORRECCIÓN DE BASE DE DATOS PARA EMPREXA 2.0
-- Ejecuta este script en el Editor SQL de Supabase para asegurar que todas las tablas
-- necesarias existen y tienen la estructura correcta para soportar Comentarios, Likes y Respuestas.

-- 1. Tabla de Comentarios (Si no existe, o verificar columnas)
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id INTEGER REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Asegurar que existan las columnas correctas (en caso de que la tabla ya exista con estructura vieja)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comments' AND column_name = 'parent_id') THEN
        ALTER TABLE public.comments ADD COLUMN parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comments' AND column_name = 'likes_count') THEN
        ALTER TABLE public.comments ADD COLUMN likes_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. Tabla de Likes en Comentarios (coment_like)
-- Esta tabla linkea usuarios con comentarios que les gustaron.
CREATE TABLE IF NOT EXISTS public.coment_like (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, comment_id)
);

-- 3. Tabla de Likes en Posts (post_likes)
-- Esta tabla linkea usuarios con posts que les gustaron.
CREATE TABLE IF NOT EXISTS public.post_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, post_id)
);

-- 4. Habilitar RLS (Seguridad) - Opcional pero recomendado
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coment_like ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso público (Para desarrollo, permite todo. En producción restringir)
CREATE POLICY "Public Comments Access" ON public.comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Comment Likes Access" ON public.coment_like FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Post Likes Access" ON public.post_likes FOR ALL USING (true) WITH CHECK (true);

-- 5. Actualizar la tabla Posts para asegurar que tenga los contadores
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'likes_count') THEN
        ALTER TABLE public.posts ADD COLUMN likes_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'comments_count') THEN
        ALTER TABLE public.posts ADD COLUMN comments_count INTEGER DEFAULT 0;
    END IF;
END $$;
