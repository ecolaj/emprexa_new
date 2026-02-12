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

// Eventos que degradan a FREE
const DEGRADATION_EVENTS = [
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
]

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Log completo para debug
  const timestamp = new Date().toISOString()
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📨 [${timestamp}] Webhook PayPal recibido`)
  console.log(`${'='.repeat(60)}`)

  try {
    const rawBody = await req.text()
    
    // Log del payload completo para diagnóstico
    console.log(`📋 Payload completo:`, rawBody.substring(0, 2000))
    
    let payload: any
    try {
      payload = JSON.parse(rawBody)
    } catch (parseError) {
      console.error(`❌ Error parseando JSON:`, parseError.message)
      console.error(`📋 Raw body (primeros 500 chars):`, rawBody.substring(0, 500))
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const eventType = payload.event_type
    const resource = payload.resource

    if (!eventType || !resource) {
      console.error(`❌ Payload inválido: falta event_type o resource`)
      return new Response(JSON.stringify({ error: 'Missing event_type or resource' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`📌 Evento: ${eventType}`)
    console.log(`📌 Subscription ID: ${resource.id}`)
    console.log(`📌 Plan ID: ${resource.plan_id || 'NO PRESENTE'}`)
    console.log(`📌 Custom ID (User): ${resource.custom_id || 'NO PRESENTE'}`)
    console.log(`📌 Status: ${resource.status || 'NO PRESENTE'}`)
    console.log(`📌 Subscriber Email: ${resource.subscriber?.email_address || 'NO PRESENTE'}`)

    // Inicializar Supabase con Service Role Key (acceso total, sin RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`❌ FATAL: Variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas`)
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // ==================== ACTIVACIÓN / RENOVACIÓN ====================
    if (ACTIVATION_EVENTS.includes(eventType)) {
      // Determinar el plan
      const planValue = resource.plan_id ? (PAYPAL_PLAN_MAP[resource.plan_id] || null) : null
      const customId = resource.custom_id // ID del usuario de Emprexa
      const subscriptionId = resource.id

      console.log(`✅ Procesando ACTIVACIÓN`)
      console.log(`   Plan resuelto: ${planValue || 'DESCONOCIDO (plan_id: ' + resource.plan_id + ')'}`)
      console.log(`   User ID: ${customId || 'NO PRESENTE'}`)
      console.log(`   Subscription ID: ${subscriptionId}`)

      if (!planValue) {
        console.error(`⚠️ plan_id "${resource.plan_id}" no está mapeado en PAYPAL_PLAN_MAP. NO se actualizará el plan.`)
        console.error(`   Plan IDs conocidos:`, Object.keys(PAYPAL_PLAN_MAP))
        // Aún así respondemos 200 para que PayPal no reintente
        return new Response(JSON.stringify({ received: true, warning: 'Unknown plan_id' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Intentar actualizar por custom_id (preferido)
      if (customId) {
        const updateData = {
          plan: planValue,
          paypal_subscription_id: subscriptionId,
          plan_updated_at: new Date().toISOString()
        }
        
        console.log(`🔄 Actualizando perfil por custom_id: ${customId}`)
        console.log(`   Datos:`, JSON.stringify(updateData))

        const { data, error, count } = await supabaseClient
          .from('profiles')
          .update(updateData)
          .eq('id', customId)
          .select('id, plan, paypal_subscription_id')

        if (error) {
          console.error(`❌ Error actualizando por custom_id:`, error.message, error.details, error.hint)
        } else if (!data || data.length === 0) {
          console.error(`⚠️ No se encontró perfil con id: ${customId}. Intentando fallback por email...`)
          
          // Fallback: buscar por email del suscriptor
          const email = resource.subscriber?.email_address
          if (email) {
            console.log(`🔄 Intentando actualizar por email: ${email}`)
            const { data: emailData, error: emailError } = await supabaseClient
              .from('profiles')
              .update(updateData)
              .eq('email', email)
              .select('id, plan, paypal_subscription_id')

            if (emailError) {
              console.error(`❌ Error actualizando por email:`, emailError.message)
            } else if (emailData && emailData.length > 0) {
              console.log(`✅ Perfil actualizado exitosamente por email:`, emailData[0])
            } else {
              console.error(`❌ CRÍTICO: No se encontró perfil ni por custom_id ni por email`)
            }
          } else {
            console.error(`❌ CRÍTICO: No hay custom_id válido ni email de suscriptor para actualizar`)
          }
        } else {
          console.log(`✅ Perfil actualizado exitosamente:`, data[0])
        }
      } else {
        // Sin custom_id - intentar por email
        const email = resource.subscriber?.email_address
        if (email) {
          console.log(`⚠️ No hay custom_id, intentando por email: ${email}`)
          const { data, error } = await supabaseClient
            .from('profiles')
            .update({
              plan: planValue,
              paypal_subscription_id: subscriptionId,
              plan_updated_at: new Date().toISOString()
            })
            .eq('email', email)
            .select('id, plan, paypal_subscription_id')

          if (error) {
            console.error(`❌ Error actualizando por email:`, error.message)
          } else if (data && data.length > 0) {
            console.log(`✅ Perfil actualizado por email:`, data[0])
          } else {
            console.error(`❌ No se encontró perfil con email: ${email}`)
          }
        } else {
          console.error(`❌ CRÍTICO: No hay custom_id ni email. No se puede identificar al usuario.`)
          console.error(`   Payload completo del subscriber:`, JSON.stringify(resource.subscriber))
        }
      }
    }
    // ==================== DEGRADACIÓN ====================
    else if (DEGRADATION_EVENTS.includes(eventType)) {
      const subscriptionId = resource.id
      console.log(`🔻 Procesando DEGRADACIÓN para suscripción: ${subscriptionId}`)

      // Primero intentar por paypal_subscription_id
      const { data, error } = await supabaseClient
        .from('profiles')
        .update({
          plan: 'free',
          plan_updated_at: new Date().toISOString()
        })
        .eq('paypal_subscription_id', subscriptionId)
        .select('id, plan, email')

      if (error) {
        console.error(`❌ Error degradando suscripción:`, error.message)
      } else if (!data || data.length === 0) {
        console.warn(`⚠️ No se encontró perfil con paypal_subscription_id: ${subscriptionId}`)
        
        // Fallback: intentar por custom_id si existe
        const customId = resource.custom_id
        if (customId) {
          console.log(`🔄 Intentando degradar por custom_id: ${customId}`)
          const { data: customData, error: customError } = await supabaseClient
            .from('profiles')
            .update({
              plan: 'free',
              plan_updated_at: new Date().toISOString()
            })
            .eq('id', customId)
            .select('id, plan, email')

          if (customError) {
            console.error(`❌ Error degradando por custom_id:`, customError.message)
          } else if (customData && customData.length > 0) {
            console.log(`✅ Perfil degradado por custom_id:`, customData[0])
          } else {
            console.error(`❌ No se encontró perfil para degradar`)
          }
        }
      } else {
        console.log(`✅ Perfil degradado exitosamente:`, data[0])
      }
    }
    // ==================== EVENTO NO MANEJADO ====================
    else {
      console.log(`ℹ️ Evento no procesado: ${eventType}`)
      console.log(`   Resource ID: ${resource.id}`)
      console.log(`   Resource status: ${resource.status}`)
    }

    console.log(`\n✅ Webhook procesado exitosamente`)
    console.log(`${'='.repeat(60)}\n`)

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error(`\n❌ ERROR FATAL en Webhook:`, error.message)
    console.error(`   Stack:`, error.stack)
    console.error(`${'='.repeat(60)}\n`)
    
    // IMPORTANTE: Retornamos 200 incluso en error para evitar que PayPal
    // reintente infinitamente y genere spam de errores
    return new Response(JSON.stringify({ received: true, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
