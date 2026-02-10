-- ALGORITMO DE PRIORIDAD V2 (ROBUSTO)
-- Copia y ejecuta esto en el SQL Editor de Supabase

-- IMPORTANTE: Eliminamos la función antes de recrearla para evitar errores de cambio de tipo de retorno
DROP FUNCTION IF EXISTS get_intelligent_feed(UUID, INT, INT);

CREATE OR REPLACE FUNCTION get_intelligent_feed(
    p_user_id UUID,
    p_offset INT,
    p_limit INT
)
RETURNS TABLE (
    id INTEGER,
    user_id UUID,
    created_at TIMESTAMPTZ,
    title TEXT,
    content TEXT,
    sdg_ids INTEGER[],
    images TEXT[],
    likes_count INTEGER,
    comments_count INTEGER,
    youtube_url TEXT,
    author_name TEXT,
    author_avatar TEXT,
    author_role TEXT,
    author_plan TEXT,
    score FLOAT
) AS $$
DECLARE
    v_user_interests INTEGER[];
BEGIN
    -- 1. Obtener intereses del usuario una sola vez para eficiencia
    SELECT sdg_interests INTO v_user_interests 
    FROM public.profiles 
    WHERE public.profiles.id = p_user_id;

    RETURN QUERY
    WITH author_stats AS (
        -- Consolidar popularidad de autores
        SELECT following_id as auth_id, COUNT(*)::INTEGER as followers_count
        FROM public.follows
        GROUP BY following_id
    ),
    user_following AS (
        -- Obtener lista de seguidos
        SELECT following_id as followed_id FROM public.follows WHERE follower_id = p_user_id
    )
    SELECT 
        p.id, 
        p.user_id, 
        p.created_at, 
        p.title, 
        p.content, 
        p.sdg_ids, 
        p.images, 
        p.likes_count, 
        p.comments_count, 
        p.youtube_url,
        prof.name as author_name,
        prof.avatar as author_avatar,
        prof.role as author_role,
        prof.plan as author_plan,
        (
            -- PESO 1: Engagement (Popularidad actual del post)
            (COALESCE(p.likes_count, 0) * 2.0 + COALESCE(p.comments_count, 0) * 5.0) +
            
            -- PESO 2: Relevancia Social (Si sigues al autor)
            (CASE WHEN p.user_id IN (SELECT followed_id FROM user_following) THEN 100.0 ELSE 0.0 END) +
            
            -- PESO 3: Intereses (Si el post coincide con tus ODS)
            (CASE WHEN p.sdg_ids && v_user_interests THEN 50.0 ELSE 0.0 END) +
            
            -- PESO 4: Autoridad (Popularidad del autor)
            (COALESCE((SELECT fs.followers_count FROM author_stats fs WHERE fs.auth_id = p.user_id), 0) * 0.1)
        )::FLOAT as calculated_score
    FROM 
        public.posts p
    JOIN 
        public.profiles prof ON p.user_id = prof.id
    ORDER BY 
        p.created_at::date DESC,  -- 1º Prioridad: Orden Cronológico por Día
        calculated_score DESC,    -- 2º Prioridad: Lo más relevante del día primero
        p.created_at DESC         -- 3º Prioridad: Lo más reciente (horas/minutos)
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

