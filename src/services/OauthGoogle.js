import { config } from "../controllers/config/config.js";

// Login con Google cuando Bubble vive en app.dotcasa.com.mx y el sitio se ve
// en dotcasa.com.mx. Google regresa a app.dotcasa.com.mx/api/1.1/oauth_redirect
// y Bubble rechaza volver a dotcasa.com.mx ("Redirect URL invalid"). Para que
// este Worker reciba ese regreso, app.dotcasa.com.mx debe estar en Proxied y
// tener la ruta app.dotcasa.com.mx/*oauth_redirect* apuntando a este Worker.
//
// 1. regreso(): cambia la página de regreso del state a app.dotcasa.com.mx para
//    que Bubble la acepte, y le pasa la llamada a Bubble.
// 2. Bubble inicia la sesión y devuelve sus cookies. Las guardamos en cookies
//    temporales de todo dotcasa.com.mx y mandamos al navegador a RUTA_FIN.
// 3. fin(): ya en dotcasa.com.mx, pone las cookies de Bubble como cookies de
//    dotcasa.com.mx (igual que en cualquier otra respuesta del Worker), borra
//    las temporales y lleva a la página donde se inició el login.
const RUTA_FIN = "/__dotcasa/oauth-fin";
const COOKIE = "dotcasa_oauth";
const TROZO = 3500; // un cookie aguanta ~4 KB
const MAX_TROZOS = 8;

const b64 = (texto) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(texto)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const desdeB64 = (texto) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(texto.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
      c.charCodeAt(0),
    ),
  );

const esPublico = (host) =>
  host === config.DOMINIO || host === "www." + config.DOMINIO;

// Solo rutas de dotcasa.com.mx: nunca mandamos a otro sitio.
const destinoSeguro = (texto) => {
  try {
    const u = new URL(texto, "https://" + config.DOMINIO);
    if (!esPublico(u.hostname)) return "/";
    return u.pathname + u.search + u.hash;
  } catch (e) {
    return "/";
  }
};

const cookieTemporal = (nombre, valor, maxAge) =>
  `${nombre}=${valor}; Domain=${config.DOMINIO}; Path=${RUTA_FIN}; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`;

export const OauthGoogle = {
  RUTA_FIN,

  esRegreso(url, env) {
    if (!env.BUBBLE_BASE_URL) return false;
    if (url.hostname !== new URL(env.BUBBLE_BASE_URL).hostname) return false;
    return /^(\/version-[^/]+)?\/api\/1\.1\/oauth_redirect$/.test(url.pathname);
  },

  async regreso(request, env) {
    const bubble = new URL(env.BUBBLE_BASE_URL);
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, bubble);

    // state viene como JSON codificado: {"used_redirect_url":"https://dotcasa.com.mx/login",...}
    let state = null;
    let regresoOriginal = null;
    try {
      state = JSON.parse(decodeURIComponent(url.searchParams.get("state")));
    } catch (e) {}
    if (state && typeof state.used_redirect_url === "string") {
      const usada = new URL(state.used_redirect_url);
      if (esPublico(usada.hostname)) {
        regresoOriginal = usada.pathname + usada.search + usada.hash;
        usada.protocol = bubble.protocol;
        usada.host = bubble.host;
        state.used_redirect_url = usada.toString();
        target.searchParams.set(
          "state",
          encodeURIComponent(JSON.stringify(state)),
        );
      }
    }

    const headers = new Headers(request.headers);
    headers.set("Host", bubble.hostname);
    const res = await fetch(target.toString(), {
      method: request.method,
      headers,
      redirect: "manual",
    });

    // Login iniciado desde app.dotcasa.com.mx o error de Bubble: tal cual.
    if (!regresoOriginal || res.status >= 400) return res;

    const cookies = res.headers.getSetCookie();
    const location = res.headers.get("Location");
    let destino = regresoOriginal;
    if (location) {
      const l = new URL(location, bubble);
      if (l.hostname === bubble.hostname)
        destino = l.pathname + l.search + l.hash;
    }

    const paquete = b64(JSON.stringify({ d: destino, c: cookies }));
    const trozos = [];
    for (let i = 0; i < paquete.length; i += TROZO)
      trozos.push(paquete.slice(i, i + TROZO));
    if (trozos.length > MAX_TROZOS) return res;

    const out = new Response(null, { status: 302 });
    out.headers.set("Location", "https://" + config.DOMINIO + RUTA_FIN);
    out.headers.set("Cache-Control", "no-store");
    trozos.forEach((t, i) =>
      out.headers.append("Set-Cookie", cookieTemporal(COOKIE + i, t, 300)),
    );
    return out;
  },

  fin(request) {
    const galletas = Object.fromEntries(
      (request.headers.get("Cookie") || "")
        .split(/;\s*/)
        .filter(Boolean)
        .map((c) => {
          const i = c.indexOf("=");
          return [c.slice(0, i), c.slice(i + 1)];
        }),
    );

    let paquete = "";
    let n = 0;
    while (n < MAX_TROZOS && galletas[COOKIE + n] !== undefined)
      paquete += galletas[COOKIE + n++];

    let datos = null;
    try {
      datos = JSON.parse(desdeB64(paquete));
    } catch (e) {}

    const out = new Response(null, { status: 302 });
    out.headers.set("Cache-Control", "no-store");
    out.headers.set("Location", datos ? destinoSeguro(datos.d) : "/");
    for (let i = 0; i < n; i++)
      out.headers.append("Set-Cookie", cookieTemporal(COOKIE + i, "", 0));
    if (datos && Array.isArray(datos.c))
      for (const c of datos.c)
        out.headers.append(
          "Set-Cookie",
          String(c).replace(/;\s*domain=[^;]*/i, ""),
        );
    return out;
  },
};
