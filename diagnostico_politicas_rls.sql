-- ============================================================
-- SCRIPT DE DIAGNÓSTICO DE POLÍTICAS RLS
-- ============================================================
-- Este script te ayudará a revisar todas las políticas de seguridad
-- y diagnosticar problemas con las notificaciones de chat.

-- 1. VERIFICAR SI RLS ESTÁ HABILITADO EN LA TABLA NOTIFICATIONS
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'notifications' AND schemaname = 'public';

-- 2. LISTAR TODAS LAS POLÍTICAS DE LA TABLA NOTIFICATIONS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'notifications' AND schemaname = 'public'
ORDER BY policyname;

-- 3. VERIFICAR POLÍTICAS DE OTRAS TABLAS RELACIONADAS
SELECT 
    tablename,
    policyname,
    cmd as command,
    CASE 
        WHEN cmd = 'INSERT' THEN 'Inserción'
        WHEN cmd = 'SELECT' THEN 'Lectura'
        WHEN cmd = 'UPDATE' THEN 'Actualización'
        WHEN cmd = 'DELETE' THEN 'Eliminación'
        WHEN cmd = 'ALL' THEN 'Todas las operaciones'
        ELSE cmd
    END as tipo_operacion
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('notifications', 'messages', 'profiles', 'posts', 'comments')
ORDER BY tablename, cmd, policyname;

-- 4. VERIFICAR TRIGGERS ACTIVOS EN NOTIFICATIONS
SELECT 
    trigger_name,
    event_manipulation as event,
    event_object_table as table_name,
    action_statement,
    action_timing as timing
FROM information_schema.triggers
WHERE event_object_table IN ('messages', 'comments', 'post_likes')
  AND event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 5. VERIFICAR FUNCIONES RELACIONADAS CON NOTIFICACIONES
SELECT 
    routine_name,
    routine_type,
    security_type,
    CASE 
        WHEN security_type = 'DEFINER' THEN 'Ejecuta con permisos del creador (SEGURO)'
        WHEN security_type = 'INVOKER' THEN 'Ejecuta con permisos del usuario (PUEDE FALLAR)'
        ELSE security_type
    END as tipo_seguridad
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('handle_new_comment', 'handle_new_like', 'notify_new_message')
ORDER BY routine_name;

-- 6. VERIFICAR ESTRUCTURA DE LA TABLA NOTIFICATIONS
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'notifications' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. CONTAR NOTIFICACIONES RECIENTES (ÚLTIMAS 24 HORAS)
SELECT 
    type as tipo_notificacion,
    COUNT(*) as cantidad,
    MAX(created_at) as ultima_notificacion
FROM notifications
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY type
ORDER BY cantidad DESC;

-- 8. VERIFICAR SI HAY MENSAJES RECIENTES SIN NOTIFICACIONES
SELECT 
    'Mensajes sin notificación' as problema,
    COUNT(*) as cantidad
FROM messages m
WHERE m.created_at > NOW() - INTERVAL '24 hours'
  AND NOT EXISTS (
      SELECT 1 FROM notifications n 
      WHERE n.type = 'message' 
        AND n.created_at >= m.created_at - INTERVAL '5 seconds'
        AND n.created_at <= m.created_at + INTERVAL '5 seconds'
  );

-- 9. RESUMEN DE POLÍTICAS FALTANTES
SELECT 
    'DIAGNÓSTICO: Políticas de INSERT en notifications' as diagnostico,
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ NO HAY POLÍTICAS DE INSERT - ESTE ES EL PROBLEMA'
        ELSE '✅ Hay ' || COUNT(*) || ' política(s) de INSERT'
    END as resultado
FROM pg_policies
WHERE tablename = 'notifications' 
  AND schemaname = 'public'
  AND cmd IN ('INSERT', 'ALL');

-- 10. VERIFICAR PERMISOS DE LA TABLA NOTIFICATIONS
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges
WHERE table_name = 'notifications' 
  AND table_schema = 'public'
ORDER BY grantee, privilege_type;
