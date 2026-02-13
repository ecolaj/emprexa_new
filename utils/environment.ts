export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

export const getBaseUrl = (): string => {
  if (isDevelopment) {
    return 'http://localhost:3000';
  }
  // En producción, usa tu dominio real (nota: usa emprexa.net sin www)
  return 'https://emprexa.net';
};

export const getAuthRedirectUrl = (): string => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/auth/callback`;
};

export const getPasswordResetUrl = (): string => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/reset-password`;
};

export const getUpdatePasswordUrl = (): string => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/update-password`;
};

/**
 * Genera la URL para compartir posts. 
 * En producción usa una Edge Function como proxy para inyectar Meta Tags dinámicos (OG Tags)
 * para que WhatsApp/Facebook muestren la imagen y título del post.
 */
export const getShareUrl = (postId: string | number): string => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl && !import.meta.env.DEV) {
    return `${supabaseUrl}/functions/v1/og-preview?id=${postId}`;
  }
  return `${getBaseUrl()}/?view=post&id=${postId}`;
};

/**
 * Genera la URL para compartir perfiles con soporte de OG Tags.
 */
export const getProfileShareUrl = (userId: string | number): string => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl && !import.meta.env.DEV) {
    return `${supabaseUrl}/functions/v1/og-preview?userId=${userId}`;
  }
  return `${getBaseUrl()}/?view=PROFILE&userId=${userId}`;
};

