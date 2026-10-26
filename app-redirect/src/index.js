// Worker de app.dotcasa.com.mx: manda a las personas y a los buscadores al
// dominio público con un 301 (misma ruta y misma query).
//
//   app.dotcasa.com.mx/detalle_propiedad/<slug> -> dotcasa.com.mx/detalle_propiedad/<slug>
//   (el Worker principal hace ahí el segundo 301 a la URL nueva de la ficha)
//   app.dotcasa.com.mx/<cualquier-otra-ruta>    -> dotcasa.com.mx/<cualquier-otra-ruta>
//
// app.dotcasa.com.mx es también el ORIGEN del Worker principal (dotcasa-domain
// le pide a Bubble las páginas ahí). Si este Worker redirigiera esas llamadas
// habría un ciclo y el sitio dejaría de funcionar. Por eso:
//
//   1. El Worker principal manda el header X-Dotcasa-Origen con el secreto
//      ORIGEN_TOKEN en cada llamada a Bubble. Con ese header se deja pasar.
//   2. Si este Worker no tiene ORIGEN_TOKEN configurado, no redirige nada
//      (falla abierto): peor que no redirigir sería tumbar el sitio.
//   3. Solo se redirigen navegaciones (GET/HEAD que piden HTML). Las llamadas
//      de Bubble (API, scripts, POST, websockets) pasan tal cual.
//   4. Los flujos que todavía viven en app. no se tocan (ver SIN_REDIRIGIR).

const PUBLICO = "https://dotcasa.com.mx";
const HEADER_ORIGEN = "X-Dotcasa-Origen";

// Rutas que se quedan en app.dotcasa.com.mx. Se comparan por prefijo, ya
// normalizadas (minúsculas, con "_" como "-").
const SIN_REDIRIGIR = [
  "/login", // login con Google de respaldo (PuenteLogin.js) y plugin de Bubble
  "/reset-pw",
  "/enviar-reseteo-contrasena",
  "/invitacion",
  "/desuscripcion",
  "/version-test",
  "/__dotcasa",
  "/api/",
  "/package/",
  "/robots.txt", // lo sirve Bubble: debe seguir dejando ver el noindex
];

const normalizar = (ruta) => ruta.toLowerCase().replace(/_/g, "-");

const esNavegacion = (request) => {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (request.headers.get("Upgrade")) return false;
  const accept = request.headers.get("Accept") || "";
  return accept.includes("text/html");
};

const exceptuada = (ruta) => {
  const r = normalizar(ruta);
  return SIN_REDIRIGIR.map(normalizar).some((p) =>
    p.endsWith("/") ? r.startsWith(p) : r === p || r.startsWith(p + "/"),
  );
};

export default {
  async fetch(request, env) {
    const pasar = () => fetch(request);

    // Sin secreto no se redirige (evita el ciclo con el Worker principal)
    if (!env.ORIGEN_TOKEN) return pasar();
    if (request.headers.get(HEADER_ORIGEN) === env.ORIGEN_TOKEN) return pasar();
    if (!esNavegacion(request)) return pasar();

    const url = new URL(request.url);
    if (exceptuada(url.pathname)) return pasar();

    return new Response(null, {
      status: 301,
      headers: {
        Location: PUBLICO + url.pathname + url.search,
        // Una hora: si hay que revertir, el navegador no lo guarda por años
        "Cache-Control": "public, max-age=3600",
      },
    });
  },
};
