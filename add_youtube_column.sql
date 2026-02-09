-- MIGRACIÓN PARA SOPORTAR VIDEOS DE YOUTUBE EN POSTS
-- Este script añade la columna youtube_url a la tabla posts.

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'youtube_url') THEN
        ALTER TABLE public.posts ADD COLUMN youtube_url TEXT;
    END IF;
END $$;
