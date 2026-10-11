import { config } from "../controllers/config/config.js";
import { enlacePublico } from "./EnlaceBubble.js";

// Respaldo del login directo (GoogleLogin.js), para cuando ese no se puede usar.
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
// diagnosticar (status de Bubble, sin_link_t<largo>, no_json, link_ajeno,
// red, config).
const INTENTOS = 4;
const ESPERA_MS = 700;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
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
      // Bubble puede tardar un instante en ver el código recién creado; si
      // contesta sin link reintentamos (el código no se gasta si no lo encontró).
      let respuesta;
      for (let intento = 0; intento < INTENTOS; intento++) {
        if (intento) await esperar(ESPERA_MS);
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
        const json = await res.json().catch(() => null);
        if (!json) return fallo("no_json");
        respuesta = json.response || {};
        // Nunca escribimos el link en el log: sirve para entrar a la cuenta.
        console.log("puente_login", {
          intento,
          status: res.status,
          campos: Object.keys(respuesta),
          t_largo: respuesta.t_largo,
        });
        if (respuesta.link || respuesta.t_largo === 0) break;
      }
      // t_largo nos dice si Bubble recibió el código (0 = no le llegó).
      if (!respuesta.link)
        return fallo("sin_link_t" + (respuesta.t_largo ?? "x"));

      // Solo seguimos links de Bubble o del propio sitio, y siempre en
      // dotcasa.com.mx con la versión que pidió la página.
      const destino = enlacePublico(respuesta.link, bubble, version);
      if (!destino) return fallo("link_ajeno");
      return redirigir(destino);
    } catch (e) {
      return fallo("red");
    }
  },
};
