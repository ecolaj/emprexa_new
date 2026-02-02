-- SCRIPT DE DEPURACIÓN (DIAGNOSTICO)
-- Ejecuta esto para ver qué está pasando realmente en las tablas.

-- 1. Ver los últimos 5 comentarios creados (para confirmar que tu comentario existe y ver IDs)
SELECT id, user_id, post_id, text, created_at 
FROM public.comments 
ORDER BY created_at DESC 
LIMIT 5;

-- 2. Ver los últimos 5 posts (para verificar quién es el dueño del post que comentaste)
-- Nota: Busca el 'id' que coincide con el 'post_id' del comentario de arriba.
SELECT id, user_id, title, created_at 
FROM public.posts 
ORDER BY created_at DESC 
LIMIT 5;

-- 3. Ver las últimas 5 notificaciones (para ver si se creó alguna, aunque sea errónea)
SELECT id, user_id as receiver_id, notifier_id, type, content, created_at, link_id
FROM public.notifications 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. Verificar si los Triggers están activos
SELECT event_object_table, trigger_name, action_statement 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
