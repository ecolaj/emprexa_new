-- COLUMNAS PARA MODO TRIAL
-- Agregamos columnas para manejar la prueba gratuita sin romper el esquema actual

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_trial_active') THEN
        ALTER TABLE public.profiles ADD COLUMN is_trial_active BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'trial_posts_remaining') THEN
        ALTER TABLE public.profiles ADD COLUMN trial_posts_remaining INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'trial_ends_at') THEN
        ALTER TABLE public.profiles ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Agregar columna para verificar si ya canjeó el trial alguna vez (para que no aparezca de nuevo)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'has_used_trial') THEN
        ALTER TABLE public.profiles ADD COLUMN has_used_trial BOOLEAN DEFAULT false;
    END IF;
END $$;
