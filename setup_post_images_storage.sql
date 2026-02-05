
-- SCRIPT PARA CREAR EL BUCKET DE IMÁGENES DE PUBLICACIONES
-- Este bucket es necesario para guardar las fotos que los usuarios adjuntan a sus posts.

-- 1. Crear el bucket 'post-images' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de seguridad para el bucket 'post-images'

-- Permitir acceso público de lectura (para que todos vean las fotos de los posts)
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'post-images');

-- Permitir a usuarios autenticados subir sus propias fotos
-- La ruta debe empezar con su user_id (ej: folder/file.jpg -> auth.uid()/file.jpg)
DROP POLICY IF EXISTS "Authenticated users can upload post images" ON storage.objects;
CREATE POLICY "Authenticated users can upload post images" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (
    bucket_id = 'post-images' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir a los usuarios actualizar sus propias fotos
DROP POLICY IF EXISTS "Users can update their own post images" ON storage.objects;
CREATE POLICY "Users can update their own post images" ON storage.objects 
FOR UPDATE TO authenticated 
USING (
    bucket_id = 'post-images' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir a los usuarios borrar sus propias fotos
DROP POLICY IF EXISTS "Users can delete their own post images" ON storage.objects;
CREATE POLICY "Users can delete their own post images" ON storage.objects 
FOR DELETE TO authenticated 
USING (
    bucket_id = 'post-images' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);
