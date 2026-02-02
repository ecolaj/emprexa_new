-- TRIGGER PARA DECREMENTAR POSTS EN MODO TRIAL
-- Este trigger se ejecuta automáticamente cada vez que un usuario en trial crea un post

CREATE OR REPLACE FUNCTION decrement_trial_posts()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo decrementar si el usuario está en modo trial activo Y tiene posts restantes
  UPDATE profiles
  SET trial_posts_remaining = GREATEST(trial_posts_remaining - 1, 0)
  WHERE id = NEW.user_id
    AND is_trial_active = true
    AND trial_posts_remaining > 0;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger
DROP TRIGGER IF EXISTS on_post_created_decrement_trial ON posts;

CREATE TRIGGER on_post_created_decrement_trial
AFTER INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION decrement_trial_posts();


-- TRIGGER PARA AUTO-EXPIRAR EL TRIAL
-- Este trigger verifica si el trial debe expirar al crear un post

CREATE OR REPLACE FUNCTION check_trial_expiration()
RETURNS TRIGGER AS $$
DECLARE
  user_plan TEXT;
  trial_active BOOLEAN;
  posts_remaining INTEGER;
  trial_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Obtener estado actual del usuario
  SELECT plan, is_trial_active, trial_posts_remaining, trial_ends_at
  INTO user_plan, trial_active, posts_remaining, trial_end
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Si está en trial activo, verificar si debe expirar
  IF trial_active = true THEN
    -- Condición 1: Se acabaron los posts (llegó a 0 después del INSERT)
    -- Condición 2: Pasó la fecha de expiración
    IF posts_remaining <= 0 OR (trial_end IS NOT NULL AND trial_end < NOW()) THEN
      UPDATE profiles
      SET 
        plan = 'free',
        is_trial_active = false,
        trial_posts_remaining = 0
      WHERE id = NEW.user_id;
      
      RAISE NOTICE 'Trial expired for user %', NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger (ejecuta DESPUÉS del trigger de decremento)
DROP TRIGGER IF EXISTS on_post_created_check_expiration ON posts;

CREATE TRIGGER on_post_created_check_expiration
AFTER INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION check_trial_expiration();
