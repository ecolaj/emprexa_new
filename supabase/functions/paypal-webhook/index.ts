// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mapeo de IDs de plan de PayPal a tus tipos de plan en la aplicación
const PAYPAL_PLAN_MAP: Record<string, string> = {
  'P-2AK432741X3881430NFCYMCA': 'basic',
  'P-9WC33579S5437044KNFCYNJQ': 'pro',
  'P-1S429263MP637224JNFCYODA': 'enterprise'
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const eventType = payload.event_type
    const resource = payload.resource

    console.log(`📨 Webhook PayPal: ${eventType} | Subscription: ${resource.id}`)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // El plan de la base de datos (lowercase)
    const planValue = PAYPAL_PLAN_MAP[resource.plan_id] || 'free'
    const customId = resource.custom_id // ID del usuario que pasamos desde el front-end

    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
      case 'BILLING.SUBSCRIPTION.RENEWED':
        console.log(`✅ Activando/Renovando plan: ${planValue} para Usuario: ${customId}`)

        if (customId) {
          await supabaseClient
            .from('profiles')
            .update({
              plan: planValue,
              paypal_subscription_id: resource.id,
              plan_updated_at: new Date().toISOString()
            })
            .eq('id', customId)
        } else {
          // Fallback por email si por algo no viene el customId
          const email = resource.subscriber?.email_address
          if (email) {
            // Nota: Esto requiere que el email esté en la tabla profiles o buscarlo de otra forma
            // Si no está, lo ideal es usar siempre custom_id
            console.log(`⚠️ No hay customId, intentando por email: ${email}`)
          }
        }
        break

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        console.log(`🔄 Degradando a FREE suscripción/pago fallido: ${resource.id}`)

        // Buscamos por el ID de suscripción de PayPal
        await supabaseClient
          .from('profiles')
          .update({
            plan: 'free',
            plan_updated_at: new Date().toISOString()
          })
          .eq('paypal_subscription_id', resource.id)
        break

      default:
        console.log(`ℹ️ Evento no procesado: ${eventType}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Error Webhook:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
