import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key is missing from environment variables');
}

// CONFIGURACIÓN CORREGIDA PARA SOPORTAR CALLBACKS
// INTERCEPTOR: Detectar recuperación ANTES de que Supabase limpie la URL
const checkRecovery = () => {
    const url = window.location.href;
    if (url.includes('type=recovery') || url.includes('recovery')) {
        console.log('🚨 DETECTADO MODO RECUPERACIÓN EN NIVEL 0');
        sessionStorage.setItem('is_recovery_flow', 'true');
    }
};
checkRecovery();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,           // ✅ Necesario para mantener sesión
    persistSession: true,             // ✅ Sesión persistente en localStorage
    detectSessionInUrl: true,         // ✅✅✅ CRÍTICO: Debe ser TRUE para detectar callback
    storage: localStorage,
    flowType: 'pkce',
  },
});