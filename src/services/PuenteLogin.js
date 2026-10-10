import { config } from "../controllers/config/config.js";

// Login con Google usando el plugin de Bubble. Google solo deja a Bubble
// regresar a su propio dominio (app.dotcasa.com.mx), así que el login se hace
// ahí y luego se pasa la sesión a dotcasa.com.mx:
//
// 1. En dotcasa.com.mx el botón de Google manda a app.dotcasa.com.mx/login?google=yes
//    y ahí el plugin inicia sesión con Google.
// 2. Bubble crea un CodigoGoogle de un solo uso (5 min) y manda a
//    dotcasa.com.mx/__dotcasa/puente?t=CODIGO (con v=test en version-test).
// 3. Aquí le pedimos al backend workflow puente_login un magic link para ese
//    código y mandamos al navegador a ese link en dotcasa.com.mx. Bubble
//    inicia la sesión ahí, con cookies de dotcasa.com.mx.
//
// puente_login solo acepta llamadas con el secreto BUBBLE_API_TOKEN.
const RUTA = "/__dotcasa/puente";

// Si algo falla volvemos a /login con ?google_error=<motivo> para poder
// diagnosticar (status de Bubble, sin_link, link_ajeno, red, config).
const redirigir = (destino) =>
  new Response(null, {
    status: 302,
    headers: { Location: destino, "Cache-Control": "no-store" },
  });

export const PuenteLogin = {
  RUTA,

  async handle(request, env) {
    const url = new URL(request.url);
    const version = url.searchParams.get("v") === "test" ? "/version-test" : "";
    const login = "https://" + config.DOMINIO + version + "/login";
    const codigo = url.searchParams.get("t");
    const fallo = (motivo) =>
      redirigir(login + "?google_error=" + encodeURIComponent(motivo));
    if (!codigo) return fallo("sin_codigo");
    if (!env.BUBBLE_BASE_URL || !env.BUBBLE_API_TOKEN) return fallo("config");

    const bubble = new URL(env.BUBBLE_BASE_URL);
    try {
      const res = await fetch(
        bubble.origin + version + "/api/1.1/wf/puente_login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + env.BUBBLE_API_TOKEN,
          },
          body: JSON.stringify({ t: codigo }),
        },
      );
      if (!res.ok) return fallo(String(res.status));
      const link = (await res.json().catch(() => null))?.response?.link;
      if (!link) return fallo("sin_link");

      // Solo seguimos links de Bubble o del propio sitio, y siempre en dotcasa.com.mx
      const destino = new URL(link, bubble.origin);
      if (
        destino.hostname !== bubble.hostname &&
        destino.hostname !== config.DOMINIO
      )
        return fallo("link_ajeno");
      destino.protocol = "https:";
      destino.host = config.DOMINIO;
      return redirigir(destino.toString());
    } catch (e) {
      return fallo("red");
    }
  },
};
