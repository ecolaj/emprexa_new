-- SCRIPT PARA CREAR EL BUCKET DE IMÁGENES DE PROYECTO
-- Ejecuta esto en el Editor SQL de Supabase

-- 1. Crear el bucket 'project-images' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de seguridad para el bucket
-- Permitir acceso público de lectura
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'project-images');

-- Permitir a usuarios autenticados subir sus propias fotos
DROP POLICY IF EXISTS "Authenticated users can upload project images" ON storage.objects;
CREATE POLICY "Authenticated users can upload project images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'project-images' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir a los dueños borrar sus fotos
DROP POLICY IF EXISTS "Owners can delete their project images" ON storage.objects;
CREATE POLICY "Owners can delete their project images" ON storage.objects FOR DELETE TO authenticated USING (
    bucket_id = 'project-images' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);
