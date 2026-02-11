
-- Este script RECREA la tabla para evitar problemas de esquemas inconsistentes
-- y asegura que funcionará.

BEGIN;

-- 1. Eliminar la tabla actual (se pierden los miembros actuales, pero arregla el esquema)
DROP TABLE IF EXISTS public.project_members CASCADE;

-- 2. Crear la tabla con la estructura correcta
CREATE TABLE public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id BIGINT NOT NULL,
    user_id UUID NOT NULL,
    role TEXT DEFAULT 'Miembro',
    added_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT unique_project_member UNIQUE (project_id, user_id)
);

-- 3. Habilitar seguridad
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas de acceso
CREATE POLICY "Todos pueden ver miembros del proyecto" ON public.project_members
    FOR SELECT USING (true);

CREATE POLICY "Dueño gestiona miembros" ON public.project_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = project_members.project_id 
            AND owner_id = auth.uid()
        )
    );

COMMIT;
