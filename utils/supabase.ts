import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key is missing from environment variables');
}

// CONFIGURACIÓN CORREGIDA PARA SOPORTAR CALLBACKS
// INTERCEPTOR DE NIVEL 0: Capturar recuperación antes de que el cliente limpie la URL
const detectRecoveryOnLoad = () => {
    try {
        const url = window.location.href;
        if (url.includes('recovery') || url.includes('type=recovery')) {
            console.log('🚀 [Nivel 0] Detección de recuperación confirmada');
            sessionStorage.setItem('is_recovery_active', 'true');
        }
    } catch (e) {}
};
detectRecoveryOnLoad();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,           // ✅ Necesario para mantener sesión
    persistSession: true,             // ✅ Sesión persistente en localStorage
    detectSessionInUrl: true,         // ✅✅✅ CRÍTICO: Debe ser TRUE para detectar callback
    storage: localStorage,
    flowType: 'pkce',
  },
});