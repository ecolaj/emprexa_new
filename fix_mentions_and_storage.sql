
-- REPARACIÓN DE INFRAESTRUCTURA PARA MENCIONES Y STORAGE
-- Este script agrega las columnas necesarias para las menciones y asegura el bucket de imágenes.

-- 1. Perfiles de usuario: Agregar columna username si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'username') THEN
        ALTER TABLE public.profiles ADD COLUMN username TEXT UNIQUE;
        
        -- Autogenerar usernames basados en el nombre actual
        UPDATE public.profiles 
        SET username = LOWER(REPLACE(name, ' ', '_')) || '_' || floor(random() * 1000)::text
        WHERE username IS NULL;
    END IF;
END $$;

-- 2. Organizaciones: Crear tabla si no existe para soportar menciones a empresas
CREATE TABLE IF NOT EXISTS public.organizations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    handle TEXT UNIQUE,
    category TEXT,
    logo TEXT,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Poblar organizaciones básicas (para que el buscador de menciones devuelva algo)
INSERT INTO public.organizations (id, name, handle, category, logo, verified)
VALUES 
(1, 'Fundación Tierra Viva', 'tierraviva', 'Sin Fines de Lucro', 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=200&q=80', true),
(2, 'GreenTech Solutions', 'greentech', 'Startup', 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=200&q=80', true)
ON CONFLICT (id) DO NOTHING;

-- 3. STORAGE: Crear bucket 'post-images' y políticas
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'post-images');

DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-images');

DROP POLICY IF EXISTS "Users can delete their own post images" ON storage.objects;
CREATE POLICY "Users can delete their own post images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'post-images');
