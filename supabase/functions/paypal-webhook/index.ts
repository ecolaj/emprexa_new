// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mapeo de IDs de plan de PayPal a tipos de plan en la aplicación
const PAYPAL_PLAN_MAP: Record<string, string> = {
  'P-2AK432741X3881430NFCYMCA': 'basic',
  'P-9WC33579S5437044KNFCYNJQ': 'pro',
  'P-1S429263MP637224JNFCYODA': 'enterprise'
}

// Eventos que activan/mantienen un plan de pago
const ACTIVATION_EVENTS = [
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.RENEWED',
  'BILLING.SUBSCRIPTION.RE-ACTIVATED',
  'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.CREATED',
]

// Cancelación → Período de gracia (el usuario conserva su plan hasta que expire)
const GRACE_PERIOD_EVENTS = [
  'BILLING.SUBSCRIPTION.CANCELLED',
]

// Degradación inmediata a FREE (problemas de pago, suspensión forzada, expiración natural)
const IMMEDIATE_DEGRADATION_EVENTS = [
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
]

/**
 * Verifica la autenticidad del webhook con la API de PayPal
 * Esto evita ataques de suplantación de identidad.
 */
async function verifyPayPalSignature(req: Request, rawBody: string) {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
  const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID')

  if (!clientId || !clientSecret || !webhookId) {
    console.error("❌ ERROR: Variables PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET o PAYPAL_WEBHOOK_ID no configuradas.")
    return false
  }

  try {
    // 1. Obtener Access Token de PayPal (OAuth 2.0)
    const auth = btoa(`${clientId}:${clientSecret}`)
    const tokenResponse = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    })

    if (!tokenResponse.ok) {
      console.error("❌ Error obteniendo access token de PayPal")
      return false
    }

    const { access_token } = await tokenResponse.json()

    // 2. Verificar la firma con PayPal
    const verifyResponse = await fetch('https://api-m.paypal.com/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: req.headers.get('paypal-auth-algo'),
        cert_url: req.headers.get('paypal-cert-url'),
        transmission_id: req.headers.get('paypal-transmission-id'),
        transmission_sig: req.headers.get('paypal-transmission-sig'),
        transmission_time: req.headers.get('paypal-transmission-time'),
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody)
      })
    })

    const verifyData = await verifyResponse.json()
    console.log(`🛡️ PayPal Verification Status: ${verifyData.verification_status}`)
    
    return verifyData.verification_status === 'SUCCESS'
  } catch (error) {
    console.error("❌ Excepción en verificación de firma:", error.message)
    return false
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const timestamp = new Date().toISOString()
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📨 [${timestamp}] Webhook PayPal recibido (Iniciando Verificación)`)
  console.log(`${'='.repeat(60)}`)

  try {
    const rawBody = await req.text()
    
    // 🔥 VERIFICACIÓN CRIPTOGRÁFICA DE SEGURIDAD
    const isLegit = await verifyPayPalSignature(req, rawBody)
    
    if (!isLegit) {
      console.error(`🚫 ALERTA: Intento de acceso no autorizado o firma inválida de PayPal detectada.`)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`✅ Firma verificada exitosamente. Procesando contenido...`)
    
    const payload = JSON.parse(rawBody)
    const eventType = payload.event_type
    const resource = payload.resource

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // ==================== ACTIVACIÓN / RENOVACIÓN ====================
    if (ACTIVATION_EVENTS.includes(eventType)) {
      const planValue = resource.plan_id ? (PAYPAL_PLAN_MAP[resource.plan_id] || null) : null
      const customId = resource.custom_id
      const subscriptionId = resource.id

      console.log(`✅ Procesando ACTIVACIÓN: Plan ${planValue}, User ${customId}`)

      if (!planValue) {
        console.warn(`⚠️ plan_id "${resource.plan_id}" no mapeado.`)
        return new Response(JSON.stringify({ received: true, warning: 'Unknown plan' }), { status: 200, headers: corsHeaders })
      }

      const updateData = {
        plan: planValue,
        paypal_subscription_id: subscriptionId,
        plan_updated_at: new Date().toISOString(),
        plan_expires_at: null,          // Limpiar fecha de expiración al activar/renovar
        subscription_status: 'active'  // Marcar como activo
      }

      // Intentar por custom_id (user.id de Supabase)
      if (customId) {
        const { data, error } = await supabaseClient.from('profiles').update(updateData).eq('id', customId).select()
        
        if (error) console.error(`❌ Error actualizando por ID:`, error.message)
        else if (data?.length > 0) console.log(`✅ Perfil actualizado por ID:`, data[0].email)
        else {
          // Fallback por email del suscriptor
          const email = resource.subscriber?.email_address
          if (email) {
            const { data: eData } = await supabaseClient.from('profiles').update(updateData).eq('email', email).select()
            if (eData?.length > 0) console.log(`✅ Perfil actualizado por Email:`, email)
            else console.error(`❌ No se encontró perfil ni por custom_id ni por email`)
          }
        }
      }
    }

    // ==================== CANCELACIÓN (PERÍODO DE GRACIA) ====================
    else if (GRACE_PERIOD_EVENTS.includes(eventType)) {
      const subscriptionId = resource.id
      // next_billing_time es la fecha hasta la que el usuario ya pagó → ahí expira su acceso
      const nextBillingTime = resource.billing_info?.next_billing_time || null

      console.log(`🔶 Procesando CANCELACIÓN con período de gracia: ${subscriptionId}`)
      console.log(`   Acceso garantizado hasta: ${nextBillingTime || 'No disponible → degradación inmediata'}`)

      let updateData: any

      if (nextBillingTime) {
        // Hay fecha de fin de período → conservar plan hasta esa fecha
        updateData = {
          subscription_status: 'cancelled',
          plan_expires_at: nextBillingTime,
          plan_updated_at: new Date().toISOString()
          // ⚠️ NO tocamos 'plan' — el usuario conserva su plan hasta plan_expires_at
        }
        console.log(`✅ Plan conservado hasta ${nextBillingTime}. Degradación automática al vencer.`)
      } else {
        // Sin fecha de fin → degradación inmediata como fallback seguro
        console.warn(`⚠️ No hay next_billing_time. Degradando a FREE inmediatamente.`)
        updateData = {
          plan: 'free',
          subscription_status: 'cancelled',
          plan_expires_at: null,
          plan_updated_at: new Date().toISOString()
        }
      }

      const { data, error } = await supabaseClient
        .from('profiles')
        .update(updateData)
        .eq('paypal_subscription_id', subscriptionId)
        .select()

      if (error) {
        console.error(`❌ Error procesando cancelación:`, error.message)
      } else if (data?.length > 0) {
        console.log(`✅ Cancelación procesada para:`, data[0].email || data[0].id)
      } else {
        console.warn(`⚠️ No se encontró perfil con paypal_subscription_id: ${subscriptionId}`)
      }
    }

    // ==================== DEGRADACIÓN INMEDIATA ====================
    else if (IMMEDIATE_DEGRADATION_EVENTS.includes(eventType)) {
      const subscriptionId = resource.id
      console.log(`🔻 Procesando DEGRADACIÓN INMEDIATA (${eventType}): ${subscriptionId}`)

      const { data, error } = await supabaseClient
        .from('profiles')
        .update({
          plan: 'free',
          subscription_status: 'cancelled',
          plan_expires_at: null,
          plan_updated_at: new Date().toISOString()
        })
        .eq('paypal_subscription_id', subscriptionId)
        .select()

      if (error) {
        console.error(`❌ Error en degradación inmediata:`, error.message)
      } else if (data?.length > 0) {
        console.log(`✅ Suscripción degradada a FREE:`, data[0].email || data[0].id)
      } else {
        console.warn(`⚠️ No se encontró perfil con paypal_subscription_id: ${subscriptionId}`)
      }
    }

    // ==================== EVENTO NO MANEJADO ====================
    else {
      console.log(`ℹ️ Evento no procesado: ${eventType}`)
    }

    console.log(`\n✅ Webhook procesado exitosamente`)
    console.log(`${'='.repeat(60)}\n`)

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error(`❌ ERROR CRÍTICO:`, error.message)
    return new Response(JSON.stringify({ received: true, error: error.message }), {
      status: 200,
      headers: corsHeaders
    })
  }
})
