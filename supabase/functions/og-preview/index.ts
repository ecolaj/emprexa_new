import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const postId = url.searchParams.get('id')
    const userId = url.searchParams.get('userId')
    const referer = req.headers.get('referer') || ''
    
    // Default metadata
    let title = "Emprexa - Red de Impacto Social"
    let description = "Únete a la comunidad que está cambiando el mundo. Documenta y comparte tu impacto social."
    let image = "https://emprexa.net/logo512.png" 
    let redirectUrl = `https://emprexa.net/`

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    if (postId) {
      redirectUrl = `https://emprexa.net/?view=post&id=${postId}`
      // Fetch post info
      const { data: post, error } = await supabase
        .from('posts')
        .select(`
          title,
          content,
          images,
          profiles (name)
        `)
        .eq('id', postId)
        .single()

      if (post && !error) {
        title = post.title || `Post de ${post.profiles?.name || 'Emprexa'}`
        description = post.content?.substring(0, 160) || "Mira esta iniciativa de impacto en Emprexa."
        if (post.images && post.images.length > 0) {
          image = post.images[0]
        }
      }
    } else if (userId) {
      redirectUrl = `https://emprexa.net/?view=PROFILE&userId=${userId}`
      // Fetch profile info
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('name, bio, avatar')
        .eq('id', userId)
        .single()

      if (profile && !error) {
        title = `${profile.name} en Emprexa`
        description = profile.bio?.substring(0, 160) || `Mira el perfil de impacto social de ${profile.name}.`
        if (profile.avatar) {
          image = profile.avatar
        }
      }
    }


    // HTML response with OG tags and auto-redirect
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Primary Meta Tags -->
    <title>${title}</title>
    <meta name="title" content="${title}">
    <meta name="description" content="${description}">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${req.url}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image}">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${req.url}">
    <meta property="twitter:title" content="${title}">
    <meta property="twitter:description" content="${description}">
    <meta property="twitter:image" content="${image}">

    <!-- Redirección para usuarios reales -->
    <script>
        window.location.href = "${redirectUrl}";
    </script>
    
    <!-- Meta refresh como backup por si falla el JS -->
    <meta http-equiv="refresh" content="0;url=${redirectUrl}">
</head>
<body style="background: #0f172a; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
    <div style="text-align: center;">
        <div style="width: 40px; height: 40px; border: 4px solid #3b82f6; border-top-color: transparent; border-radius: 50%; animate: spin 1s linear infinite; margin: 0 auto 20px;"></div>
        <p>Redirigiendo a Emprexa...</p>
    </div>
    <style>
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</body>
</html>
`

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=UTF-8' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
