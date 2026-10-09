import { config } from "../controllers/config/config.js";
import { BubbleManager } from "../controllers/dao/Bubble.manager.js";
import { Utils } from "../services/utils/utils.js";
import { FichaSeo } from "../services/FichaSeo.js";
import { InicioSeo } from "../services/InicioSeo.js";
import { SitemapRoute } from "./SiteMap.route.js";

export class AppRouter {
  static async route(request, env) {
    const proxyRequest = (nuevaRuta = null) => {
      const target = new URL(request.url);

      const init = {
        method: request.method,
        headers: new Headers(request.headers),
        body: request.body, // Fundamental para que los POST envíen datos a Bubble
        redirect: "manual",
      };

      if (env.BUBBLE_BASE_URL) {
        const baseUrl = new URL(env.BUBBLE_BASE_URL);
        target.protocol = baseUrl.protocol;
        target.hostname = baseUrl.hostname;
        target.port = baseUrl.port;
        init.headers.set("Host", baseUrl.hostname);
      }

      if (nuevaRuta) {
        target.pathname = nuevaRuta;
      }

      return fetch(target.toString(), init)
        .then(publicarRespuesta)
        .then(pulirHtml);
    };

    // Si Bubble vive en otro host (p. ej. app.dotcasa.com.mx), sus redirecciones
    // y cookies traen ese host. Lo cambiamos por el dominio público.
    const publicarRespuesta = (res) => {
      if (!env.BUBBLE_BASE_URL) return res;
      const bubbleHost = new URL(env.BUBBLE_BASE_URL).hostname;
      const publico = new URL(request.url);
      if (bubbleHost === publico.hostname) return res;

      const location = res.headers.get("Location");
      const cookies = res.headers.getSetCookie();
      const cookieConDominio = cookies.some((c) => /;\s*domain=/i.test(c));
      if (!location && !cookieConDominio) return res;

      const out = new Response(res.body, res);
      if (location) {
        const destino = new URL(location, env.BUBBLE_BASE_URL);
        if (destino.hostname === bubbleHost) {
          destino.protocol = publico.protocol;
          destino.host = publico.host;
          out.headers.set("Location", destino.toString());
        }
      }
      if (cookieConDominio) {
        out.headers.delete("Set-Cookie");
        for (const c of cookies)
          out.headers.append("Set-Cookie", c.replace(/;\s*domain=[^;]*/i, ""));
      }
      return out;
    };

    // Bubble escribe su propio host (app.dotcasa.com.mx) en la página: scripts,
    // links y la llamada a /api/1.1/init/data. Desde dotcasa.com.mx el navegador
    // la bloquea por CORS, así que lo cambiamos por el dominio público; esas
    // rutas también pasan por este Worker hacia Bubble.
    const conHostPublico = (rewriter) => {
      if (!env.BUBBLE_BASE_URL) return rewriter;
      const bubbleHost = new URL(env.BUBBLE_BASE_URL).host;
      const publico = new URL(request.url).host;
      if (bubbleHost === publico) return rewriter;
      const aPublico = (s) => s.split(bubbleHost).join(publico);

      let guion = "";
      return rewriter
        .on("*", {
          element: (e) => {
            for (const [nombre, valor] of [...e.attributes])
              if (valor.includes(bubbleHost))
                e.setAttribute(nombre, aPublico(valor));
          },
        })
        .on("script", {
          // El texto llega en pedazos; se junta para no partir el host a la mitad.
          text: (t) => {
            guion += t.text;
            if (!t.lastInTextNode) return t.remove();
            t.replace(aPublico(guion), { html: true });
            guion = "";
          },
        });
    };

    // Bubble pone su propio canonical apuntando a app.dotcasa.com.mx; lo
    // cambiamos por la URL pública sin www. También quitamos X-Powered-By y
    // declaramos el charset en el header.
    const pulirHtml = (res) => {
      const tipo = res.headers.get("Content-Type") || "";
      const esHtml = tipo.startsWith("text/html");
      if (!esHtml && !res.headers.has("X-Powered-By")) return res;

      const out = new Response(res.body, res);
      out.headers.delete("X-Powered-By");
      if (!esHtml) return out;
      if (!/charset=/i.test(tipo))
        out.headers.set("Content-Type", tipo + "; charset=utf-8");
      if (request.method !== "GET" || res.status !== 200) return out;

      const canonica =
        "https://" + config.DOMINIO + new URL(request.url).pathname;
      return conHostPublico(new HTMLRewriter())
        .on('link[rel="canonical"]', { element: (e) => e.remove() })
        .on('meta[property="og:url"]', {
          element: (e) => e.setAttribute("content", canonica),
        })
        .on("head", {
          element: (e) =>
            e.append(`<link rel="canonical" href="${canonica}">`, {
              html: true,
            }),
        })
        .transform(out);
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      return proxyRequest();
    }

    const url = new URL(request.url);

    // Una sola versión del sitio: https y sin www
    if (
      url.hostname === "www." + config.DOMINIO ||
      (url.hostname === config.DOMINIO && url.protocol === "http:")
    ) {
      return Response.redirect(
        "https://" + config.DOMINIO + url.pathname + url.search,
        301,
      );
    }

    if (url.pathname === "/sitemap.xml") {
      return SitemapRoute.handle(request, env);
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 0)
      return proxyRequest().then((res) =>
        request.method === "GET" ? InicioSeo.inyectar(res) : res,
      );

    const norm = parts.map(Utils.normalizar);
    const primero = norm[0];

    const redirigir = (nuevaRuta) =>
      Response.redirect(url.origin + nuevaRuta + url.search, 301);

    // Se ve la página 404 de Bubble, pero con estado 404 para que Google no
    // la indexe como si fuera una página real.
    const noEncontrado = () =>
      proxyRequest("/pagina-no-encontrada-404").then(
        (res) => new Response(res.body, { status: 404, headers: res.headers }),
      );

    // Con filtros (?precio_max=..., ?recamaras=...) la página sirve, pero Google
    // solo debe indexar la versión limpia.
    const sinIndexarSiFiltra = (res) => {
      if (!url.search) return res;
      const out = new Response(res.body, res);
      out.headers.set("X-Robots-Tag", "noindex, follow");
      return out;
    };

    const listado = async (slug) => {
      if (!(await BubbleManager.rutaExiste(slug, request, env)))
        return noEncontrado();
      return proxyRequest("/buscador/" + slug).then(sinIndexarSiFiltra);
    };

    // En la ficha (6 segmentos) el último es el Slug_text de Bubble: se deja
    // tal cual porque la página detalle_propiedad lo busca exacto.
    // Buscador general: se ve como /propiedades, Bubble sigue usando la página buscador
    if (url.pathname === "/buscador" || url.pathname === "/buscador/")
      return redirigir("/propiedades");
    if (primero === "propiedades") {
      if (norm.length !== 1) return noEncontrado();
      if (url.pathname !== "/propiedades") return redirigir("/propiedades");
      return proxyRequest("/buscador").then(sinIndexarSiFiltra);
    }

    const esFicha = config.TIPOS.has(primero) && norm.length === 6;
    const canonica =
      "/" + (esFicha ? [...norm.slice(0, 5), parts[5]] : norm).join("/");
    const esCanonica = url.pathname === canonica;

    if (config.TIPOS.has(primero)) {
      if (!esCanonica) return redirigir(canonica);
      if (norm.length === 1) return listado(primero);
      // Tipo por ubicación, venta y renta juntas: /casa/estado, /casa/estado/municipio
      if (config.ESTADOS.has(norm[1])) {
        if (norm.length > 3) return noEncontrado();
        return listado(norm.join("-"));
      }
      if (!config.OPS.has(norm[1])) return noEncontrado();

      if (norm[2] === "cp" || norm[2] === "fraccionamiento") {
        if (norm.length !== 4) return noEncontrado();
        if (norm[2] === "cp" && !config.CP_REGEX.test(norm[3]))
          return noEncontrado();
        return listado(norm.join("-"));
      }

      if (norm.length === 6) {
        const [res, prop] = await Promise.all([
          proxyRequest("/detalle_propiedad/" + parts[5]),
          BubbleManager.propiedadPorSlug(parts[5], request, env),
        ]);
        const html = (res.headers.get("Content-Type") || "").startsWith(
          "text/html",
        );
        if (!prop || !html || res.status !== 200 || request.method !== "GET")
          return res;
        const datos = FichaSeo.datos(
          prop,
          norm,
          "https://" + config.DOMINIO + canonica,
        );
        return FichaSeo.inyectar(res, datos);
      }
      if (norm.length <= 5) return listado(norm.join("-"));

      return noEncontrado();
    }

    // Listados de todos los tipos por operación:
    // /venta, /venta/estado, /venta/estado/municipio, /venta/estado/municipio/colonia
    if (config.OPS.has(primero)) {
      if (norm.length > 4) return noEncontrado();
      if (!esCanonica) return redirigir(canonica);
      // Mientras Bubble no tenga la ruta "venta", seguimos mandando a /casa/venta
      if (
        norm.length === 1 &&
        !(await BubbleManager.rutaExiste(primero, request, env))
      )
        return redirigir("/casa/" + primero);
      return listado(norm.join("-"));
    }

    if (primero === "cp") {
      if (norm.length !== 2 || !config.CP_REGEX.test(norm[1]))
        return noEncontrado();
      if (!esCanonica) return redirigir(canonica);
      return listado("cp-" + norm[1]);
    }

    if (primero === "municipio") {
      if (norm.length !== 2) return noEncontrado();
      if (!esCanonica) return redirigir(canonica);
      return listado("municipio-" + norm[1]);
    }

    // Todo tipo y toda operación por ubicación:
    // /estado, /estado/municipio, /estado/municipio/colonia
    if (config.ESTADOS.has(primero)) {
      if (norm.length > 3) return noEncontrado();
      if (!esCanonica) return redirigir(canonica);
      return listado(norm.join("-"));
    }

    if (norm.length === 1 && config.CP_REGEX.test(primero))
      return redirigir("/cp/" + primero);

    // Ficha por la URL vieja /detalle_propiedad/<Slug_text>:
    // si la propiedad ya tiene url_publica bonita, redirige (301) a ella.
    if (primero === "detalle-propiedad" && parts.length === 2) {
      const bonita = await BubbleManager.urlBonita(parts[1], request, env);
      if (bonita && bonita !== url.pathname) return redirigir(bonita);
    }

    return proxyRequest();
  }
}
