-- Migration to support PayPal Subscriptions
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMP WITH TIME ZONE;

-- Index for faster lookups by subscription ID
CREATE INDEX IF NOT EXISTS idx_profiles_paypal_subscription_id ON public.profiles(paypal_subscription_id);
