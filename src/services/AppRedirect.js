import { config } from "../controllers/config/config.js";

// 301 de app.dotcasa.com.mx al dominio público (misma ruta y query).
//
//   app.dotcasa.com.mx/detalle_propiedad/<slug> -> dotcasa.com.mx/detalle_propiedad/<slug>
//   (ahí el router hace el segundo 301 a la URL nueva de la ficha)
//   app.dotcasa.com.mx/<otra-ruta>              -> dotcasa.com.mx/<otra-ruta>
//
// app.dotcasa.com.mx es también el ORIGEN de este mismo Worker (le pide a
// Bubble las páginas ahí). Para no redirigirse a sí mismo:
//   1. proxyRequest manda el header X-Dotcasa-Origen en cada llamada a Bubble;
//      con ese header la petición pasa tal cual al origen.
//   2. Solo se redirigen navegaciones (GET/HEAD que piden HTML). La API,
//      scripts, POST y websockets pasan.
//   3. Los flujos que siguen viviendo en app. no se tocan (SIN_REDIRIGIR).
//
// Se activa agregando la ruta app.dotcasa.com.mx/* al Worker en Cloudflare
// (Settings > Domains & Routes). Quitando esa ruta se apaga.

const HEADER_ORIGEN = "X-Dotcasa-Origen";
const VALOR_ORIGEN = "dotcasa-domain";

// Se quedan en app.dotcasa.com.mx. Se comparan por prefijo, ya normalizadas
// (minúsculas, "_" como "-").
const SIN_REDIRIGIR = [
  "/login", // login con Google de respaldo (PuenteLogin.js) y plugin de Bubble
  "/reset_pw",
  "/enviar_reseteo_contrasena",
  "/invitacion",
  "/desuscripcion",
  "/version-test",
  "/__dotcasa",
  "/api/",
  "/package/",
  "/robots.txt", // lo sirve Bubble: debe seguir dejando ver el noindex
];

const normalizar = (ruta) => ruta.toLowerCase().replace(/_/g, "-");
const PREFIJOS = SIN_REDIRIGIR.map(normalizar);

const esNavegacion = (request) => {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (request.headers.get("Upgrade")) return false;
  return (request.headers.get("Accept") || "").includes("text/html");
};

const exceptuada = (ruta) => {
  const r = normalizar(ruta);
  return PREFIJOS.some((p) =>
    p.endsWith("/") ? r.startsWith(p) : r === p || r.startsWith(p + "/"),
  );
};

export const AppRedirect = {
  HEADER_ORIGEN,
  VALOR_ORIGEN,

  // null si la petición no es de app.dotcasa.com.mx (sigue el router normal).
  // Si lo es, siempre responde aquí: 301 o paso directo al origen.
  handle(request) {
    const url = new URL(request.url);
    if (url.hostname !== config.APP_HOST) return null;

    const pasar = () => fetch(request);
    if (request.headers.get(HEADER_ORIGEN) === VALOR_ORIGEN) return pasar();
    if (!esNavegacion(request) || exceptuada(url.pathname)) return pasar();

    return new Response(null, {
      status: 301,
      headers: {
        Location: "https://" + config.DOMINIO + url.pathname + url.search,
        // Una hora: si hay que revertir, el navegador no lo guarda por años
        "Cache-Control": "public, max-age=3600",
      },
    });
  },
};
