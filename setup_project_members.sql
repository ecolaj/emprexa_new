
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id BIGINT NOT NULL,
    user_id UUID NOT NULL,
    role TEXT DEFAULT 'Miembro',
    added_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT unique_project_member UNIQUE (project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Permitir lectura a todos
DROP POLICY IF EXISTS "Todos pueden ver miembros del proyecto" ON public.project_members;
CREATE POLICY "Todos pueden ver miembros del proyecto" ON public.project_members
    FOR SELECT USING (true);

-- Permitir al dueño del proyecto gestionar miembros
DROP POLICY IF EXISTS "Dueño gestiona miembros" ON public.project_members;
CREATE POLICY "Dueño gestiona miembros" ON public.project_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = project_members.project_id 
            AND owner_id = auth.uid()
        )
    );
