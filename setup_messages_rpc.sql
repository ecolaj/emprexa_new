-- Función para obtener conversaciones del usuario con el último mensaje y conteo de no leídos
DROP FUNCTION IF EXISTS get_user_conversations(UUID);

CREATE OR REPLACE FUNCTION get_user_conversations(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    avatar TEXT,
    role TEXT,
    plan TEXT,
    last_message_time TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH last_messages AS (
        SELECT 
            CASE 
                WHEN sender_id = p_user_id THEN receiver_id 
                ELSE sender_id 
            END as other_user_id,
            MAX(created_at) as max_created_at
        FROM messages
        WHERE sender_id = p_user_id OR receiver_id = p_user_id
        GROUP BY 1
    )
    SELECT 
        p.id,
        p.name,
        p.avatar,
        p.role,
        p.plan,
        lm.max_created_at as last_message_time
    FROM profiles p
    JOIN last_messages lm ON p.id = lm.other_user_id
    ORDER BY lm.max_created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
