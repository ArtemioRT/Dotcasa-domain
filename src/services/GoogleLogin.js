import { config } from "../controllers/config/config.js";

// Login con Google sin el plugin de Bubble. El botón (o One Tap) de la página
// le pide a Google un token y lo manda aquí. Validamos el token con Google y
// le pedimos al backend workflow google_login de Bubble que cree la cuenta si
// no existe y le asigne una contraseña temporal. La página inicia sesión con
// esa contraseña ("Log the user in"), así que la sesión queda en dotcasa.com.mx.
//
// Necesita el secreto BUBBLE_API_TOKEN (Settings > API de Bubble), porque
// google_login solo acepta llamadas autenticadas.
const RUTA = "/__dotcasa/google";
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
    const bubble = new URL(env.BUBBLE_BASE_URL).origin;
    const j = await consultar(bubble + version + "/api/1.1/wf/google_login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + env.BUBBLE_API_TOKEN,
      },
      body: JSON.stringify(usuario),
    }).catch(() => null);
    const password = j?.response?.password;
    if (!password) return respuesta({ error: "bubble" }, 502);

    return respuesta({ email: j.response.email || usuario.email, password });
  },
};
