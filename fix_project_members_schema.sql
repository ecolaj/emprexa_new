
-- Tienen que ejecutar este script en el Editor SQL de Supabase para corregir la tabla project_members
-- que le falta la columna 'role' (y posiblemente otras) por haber existido previamente sin ellas.

DO $$
BEGIN
    -- Agregar columna 'role' si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_members' AND column_name = 'role') THEN
        ALTER TABLE public.project_members ADD COLUMN role TEXT DEFAULT 'Miembro';
    END IF;

    -- Agregar columna 'added_at' si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_members' AND column_name = 'added_at') THEN
        ALTER TABLE public.project_members ADD COLUMN added_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Asegurar que las claves foráneas tengan borrado en cascada (opcional pero recomendado)
    -- Nota: Modificar constraints existentes es complejo en SQL puro sin saber nombres exactos,
    -- así que nos enfocamos en las columnas faltantes que causan el error 400.
END $$;
