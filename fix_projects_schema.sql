
-- SCRIPT PARA ACTUALIZAR LA TABLA DE PROYECTOS
-- Ejecuta este script en el Editor SQL de Supabase

DO $$ 
BEGIN
    -- 1. Agregar columnas de fechas y galería
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'start_date') THEN
        ALTER TABLE public.projects ADD COLUMN start_date DATE DEFAULT CURRENT_DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'end_date') THEN
        ALTER TABLE public.projects ADD COLUMN end_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'gallery') THEN
        ALTER TABLE public.projects ADD COLUMN gallery TEXT[] DEFAULT '{}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'raised_amount') THEN
        ALTER TABLE public.projects ADD COLUMN raised_amount NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'volunteers_count') THEN
        ALTER TABLE public.projects ADD COLUMN volunteers_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'location') THEN
        ALTER TABLE public.projects ADD COLUMN location TEXT;
    END IF;

    -- 2. Asegurar que 'looking_for' sea un array de texto (si no lo es ya)
    -- Si ya existe como otro tipo, puede requerir una conversión más compleja,
    -- pero usualmente se define como text[] para mocks.
    
    -- 3. Agregar 'created_at' para ordenamiento si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'created_at') THEN
        ALTER TABLE public.projects ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
    END IF;

    -- 4. Asegurar que las políticas de RLS permitan la inserción a usuarios autenticados
    -- (Ajusta esto según tus políticas de seguridad actuales)
    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
END $$;

-- Permitir a usuarios autenticados crear proyectos
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Users can create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

-- Permitir a todos ver proyectos
DROP POLICY IF EXISTS "Everyone can view projects" ON public.projects;
CREATE POLICY "Everyone can view projects" ON public.projects FOR SELECT TO public USING (true);

-- Permitir a los dueños editar/borrar sus proyectos
DROP POLICY IF EXISTS "Owners can update their projects" ON public.projects;
CREATE POLICY "Owners can update their projects" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete their projects" ON public.projects;
CREATE POLICY "Owners can delete their projects" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- 5. Tabla de Actualizaciones (Updates)
CREATE TABLE IF NOT EXISTS public.project_updates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view project updates" ON public.project_updates;
CREATE POLICY "Anyone can view project updates" ON public.project_updates FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Owners can manage updates" ON public.project_updates;
CREATE POLICY "Owners can manage updates" ON public.project_updates FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
);
