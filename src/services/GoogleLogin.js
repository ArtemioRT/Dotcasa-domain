import { config } from "../controllers/config/config.js";
import { enlacePublico } from "./EnlaceBubble.js";

// Login con Google sin salir de dotcasa.com.mx y sin el plugin de Bubble. El
// botón (o One Tap) de la página le pide a Google un token y lo manda aquí.
// Validamos el token con Google y le pedimos al backend workflow google_enlace
// de Bubble que cree la cuenta si no existe y arme un magic link de un solo
// uso. La página navega a ese link y Bubble inicia la sesión en dotcasa.com.mx.
//
// Aquí nunca sale una contraseña: el workflow ya no toca la del usuario.
//
// Si esto falla (Bubble sin google_enlace, token rechazado, etc.) la página
// usa el respaldo: el puente por app.dotcasa.com.mx (PuenteLogin.js).
//
// Necesita el secreto BUBBLE_API_TOKEN (Settings > API de Bubble), porque
// google_enlace solo acepta llamadas autenticadas.
const RUTA = "/__dotcasa/google";
const WORKFLOW = "google_enlace";
const EMISORES = ["accounts.google.com", "https://accounts.google.com"];

const respuesta = (datos, status = 200) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const consultar = async (url, init) => {
  const res = await fetch(url, init);
  if (!res.ok) return null;
  return res.json();
};

// Devuelve { email, nombre, foto } si el token es nuestro y el correo está verificado.
const validar = async ({ credential, access_token }) => {
  const tokeninfo = "https://oauth2.googleapis.com/tokeninfo?";
  if (credential) {
    const j = await consultar(
      tokeninfo + "id_token=" + encodeURIComponent(credential),
    );
    if (!j || j.aud !== config.GOOGLE_CLIENT_ID) return null;
    if (!EMISORES.includes(j.iss)) return null;
    if (String(j.email_verified) !== "true" || !j.email) return null;
    return { email: j.email, nombre: j.name || "", foto: j.picture || "" };
  }
  if (access_token) {
    const j = await consultar(
      tokeninfo + "access_token=" + encodeURIComponent(access_token),
    );
    if (!j || j.aud !== config.GOOGLE_CLIENT_ID) return null;
    if (String(j.email_verified) !== "true" || !j.email) return null;
    const perfil = await consultar(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: "Bearer " + access_token } },
    ).catch(() => null);
    return {
      email: j.email,
      nombre: perfil?.name || "",
      foto: perfil?.picture || "",
    };
  }
  return null;
};

export const GoogleLogin = {
  RUTA,

  async handle(request, env) {
    if (request.method !== "POST") return respuesta({ error: "metodo" }, 405);
    const origen = request.headers.get("Origin");
    if (origen && origen !== "https://" + config.DOMINIO)
      return respuesta({ error: "origen" }, 403);
    if (!env.BUBBLE_BASE_URL || !env.BUBBLE_API_TOKEN)
      return respuesta({ error: "configuracion" }, 500);

    let datos;
    try {
      datos = await request.json();
    } catch (e) {
      return respuesta({ error: "datos" }, 400);
    }

    const usuario = await validar(datos || {}).catch(() => null);
    if (!usuario) return respuesta({ error: "token" }, 401);

    const version =
      new URL(request.url).searchParams.get("v") === "test"
        ? "/version-test"
        : "";
    const bubble = new URL(env.BUBBLE_BASE_URL);
    const res = await fetch(
      bubble.origin + version + "/api/1.1/wf/" + WORKFLOW,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + env.BUBBLE_API_TOKEN,
        },
        body: JSON.stringify(usuario),
      },
    ).catch(() => null);
    if (!res) return respuesta({ error: "red" }, 502);
    // 404 = esta versión de Bubble todavía no tiene google_enlace.
    if (!res.ok) return respuesta({ error: "bubble_" + res.status }, 502);
    const json = await res.json().catch(() => null);
    const datosBubble = json?.response || {};
    // Nunca escribimos el link en el log: sirve para entrar a la cuenta.
    console.log(WORKFLOW, {
      status: res.status,
      campos: Object.keys(datosBubble),
    });
    if (!datosBubble.link) return respuesta({ error: "sin_link" }, 502);

    const link = enlacePublico(datosBubble.link, bubble, version);
    if (!link) return respuesta({ error: "link_ajeno" }, 502);
    return respuesta({ link });
  },
};
