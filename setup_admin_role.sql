
-- 1. Agregar columna is_admin a la tabla profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. Asegurarse de que los perfiles existentes tengan el valor por defecto
UPDATE public.profiles SET is_admin = false WHERE is_admin IS NULL;

-- 3. (OPCIONAL) Convertir un usuario específico en Administrador
-- Reemplaza 'TU_USER_ID' con el ID real si quieres probarlo ahora:
-- UPDATE public.profiles SET is_admin = true WHERE id = 'TU_USER_ID';

-- 4. Actualizar políticas de RLS para que los admins tengan poderes extra (Ejemplo)
-- Por ahora solo habilitamos la columna para el frontend.
