/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_PAYPAL_CLIENT_ID: string
  readonly VITE_PAYPAL_PLAN_BASIC: string
  readonly VITE_PAYPAL_PLAN_PRO: string
  readonly VITE_PAYPAL_PLAN_ENTERPRISE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
