DO $$ 
DECLARE
    v_col_name TEXT;
    v_table_name TEXT;
BEGIN
    -- 1. ASEGURAR TABLA: comments
    ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Comentarios visibles para todos" ON public.comments;
    CREATE POLICY "Comentarios visibles para todos" ON public.comments FOR SELECT USING (true);
    
    SELECT column_name INTO v_col_name FROM information_schema.columns WHERE table_name = 'comments' AND column_name IN ('user_id', 'profile_id') LIMIT 1;
    IF v_col_name IS NOT NULL THEN
        EXECUTE format('DROP POLICY IF EXISTS "Usuarios pueden crear comentarios" ON public.comments');
        EXECUTE format('CREATE POLICY "Usuarios pueden crear comentarios" ON public.comments FOR INSERT WITH CHECK (auth.uid() = %I)', v_col_name);
        EXECUTE format('DROP POLICY IF EXISTS "Actualizar comentarios" ON public.comments');
        EXECUTE format('CREATE POLICY "Actualizar comentarios" ON public.comments FOR UPDATE USING (auth.uid() = %I)', v_col_name);
        EXECUTE format('DROP POLICY IF EXISTS "Eliminar comentarios" ON public.comments');
        EXECUTE format('CREATE POLICY "Eliminar comentarios" ON public.comments FOR DELETE USING (auth.uid() = %I)', v_col_name);
    END IF;

    -- 2. ASEGURAR TABLAS DE LIKES: comment_likes y coment_like
    FOR v_table_name IN SELECT UNNEST(ARRAY['comment_likes', 'coment_like']) LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = v_table_name AND table_schema = 'public') THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table_name);
            EXECUTE format('DROP POLICY IF EXISTS "Likes visibles para todos" ON public.%I', v_table_name);
            EXECUTE format('CREATE POLICY "Likes visibles para todos" ON public.%I FOR SELECT USING (true)', v_table_name);
            
            SELECT column_name INTO v_col_name FROM information_schema.columns WHERE table_name = v_table_name AND column_name IN ('user_id', 'profile_id') LIMIT 1;
            IF v_col_name IS NOT NULL THEN
                EXECUTE format('DROP POLICY IF EXISTS "Usuarios pueden gestionar likes" ON public.%I', v_table_name);
                EXECUTE format('CREATE POLICY "Usuarios pueden gestionar likes" ON public.%I FOR ALL USING (auth.uid() = %I)', v_table_name, v_col_name);
            END IF;
        END IF;
    END LOOP;

    -- 3. ASEGURAR TABLA: organizations
    ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Organizaciones visibles para todos" ON public.organizations;
    CREATE POLICY "Organizaciones visibles para todos" ON public.organizations FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Admins pueden editar organizaciones" ON public.organizations;
    CREATE POLICY "Admins pueden editar organizaciones" ON public.organizations FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

    -- 4. ASEGURAR TABLA: project_members
    ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Miembros de proyecto visibles para todos" ON public.project_members;
    CREATE POLICY "Miembros de proyecto visibles para todos" ON public.project_members FOR SELECT USING (true);
    
    SELECT column_name INTO v_col_name FROM information_schema.columns WHERE table_name = 'project_members' AND column_name IN ('user_id', 'profile_id') LIMIT 1;
    IF v_col_name IS NOT NULL THEN
        EXECUTE format('DROP POLICY IF EXISTS "Gestionar miembros" ON public.project_members');
        EXECUTE format('CREATE POLICY "Gestionar miembros" ON public.project_members FOR ALL USING (auth.uid() = %I OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()))', v_col_name);
    END IF;

    -- 5. ASEGURAR TABLA: sdgs
    ALTER TABLE public.sdgs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "ODS visibles para todos" ON public.sdgs;
    CREATE POLICY "ODS visibles para todos" ON public.sdgs FOR SELECT USING (true);

END $$;


