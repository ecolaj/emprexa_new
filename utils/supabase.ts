import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key is missing from environment variables');
}

// CONFIGURACIÓN CORREGIDA PARA SOPORTAR CALLBACKS
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,           // ✅ Necesario para mantener sesión
    persistSession: true,             // ✅ Sesión persistente en localStorage
    detectSessionInUrl: true,         // ✅✅✅ CRÍTICO: Debe ser TRUE para detectar callback
    storage: localStorage,
    flowType: 'pkce',
  },
});