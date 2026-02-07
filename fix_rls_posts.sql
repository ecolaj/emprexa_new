-- SCRIPT PARA REPARAR EL FEED Y LOS FILTROS EN PRODUCCIÓN
-- Este script habilita el acceso público a la lectura de posts y proyectos,
-- lo cual es necesario si RLS está activo en el Dashboard de Supabase.

-- 1. ASEGURAR POLÍTICAS PARA LA TABLA 'posts'
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública (crucial para que el feed no aparezca vacío)
DROP POLICY IF EXISTS "Public posts access" ON public.posts;
CREATE POLICY "Public posts access" ON public.posts FOR SELECT USING (true);

-- Permitir a usuarios autenticados crear sus propios posts
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
CREATE POLICY "Users can insert their own posts" ON public.posts 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Permitir a los dueños editar sus posts
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts" ON public.posts 
    FOR UPDATE USING (auth.uid() = user_id);

-- Permitir a los dueños borrar sus posts
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts" ON public.posts 
    FOR DELETE USING (auth.uid() = user_id);


-- 2. ASEGURAR POLÍTICAS PARA LA TABLA 'projects' (Si no existen)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public projects access" ON public.projects;
CREATE POLICY "Public projects access" ON public.projects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own projects" ON public.projects;
CREATE POLICY "Users can insert their own projects" ON public.projects 
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Users can update their own projects" ON public.projects 
    FOR UPDATE USING (auth.uid() = owner_id);
