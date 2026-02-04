-- FUNCIÓN PARA OBTENER CONVERSACIONES UNICAS CON EL ULTIMO MENSAJE
-- Ejecuta esto en el Editor SQL de Supabase

CREATE OR REPLACE FUNCTION get_user_conversations(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    avatar TEXT,
    role TEXT,
    last_message TEXT,
    unread_count BIGINT,
    last_message_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH RECENT_MESSAGES AS (
        SELECT 
            CASE 
                WHEN sender_id = p_user_id THEN receiver_id 
                ELSE sender_id 
            END as peer_id,
            content,
            created_at,
            read,
            sender_id,
            ROW_NUMBER() OVER(PARTITION BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id) ORDER BY created_at DESC) as rn
        FROM messages
        WHERE sender_id = p_user_id OR receiver_id = p_user_id
    ),
    PEER_STATS AS (
        SELECT 
            peer_id,
            MAX(created_at) as last_msg_at,
            COUNT(*) FILTER (WHERE receiver_id = p_user_id AND read = false) as unread_cnt
        FROM messages
        WHERE sender_id = p_user_id OR receiver_id = p_user_id
        GROUP BY peer_id
    )
    SELECT 
        p.id,
        p.name,
        p.avatar,
        p.role,
        rm.content as last_message,
        ps.unread_cnt as unread_count,
        ps.last_msg_at as last_message_at
    FROM profiles p
    JOIN PEER_STATS ps ON p.id = ps.peer_id
    JOIN RECENT_MESSAGES rm ON p.id = rm.peer_id AND rm.rn = 1
    ORDER BY ps.last_msg_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
