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