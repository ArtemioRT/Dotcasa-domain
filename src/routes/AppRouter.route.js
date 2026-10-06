import { config } from "../controllers/config/config.js";
import { BubbleManager } from "../controllers/dao/Bubble.manager.js";
import { Utils } from "../services/utils/utils.js";
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

      return fetch(target.toString(), init).then(publicarRespuesta);
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

    if (request.method !== "GET" && request.method !== "HEAD") {
      return proxyRequest();
    }

    const url = new URL(request.url);

    if (url.pathname === "/sitemap.xml") {
      return SitemapRoute.handle(request, env);
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return proxyRequest();

    const norm = parts.map(Utils.normalizar);
    const primero = norm[0];

    const redirigir = (nuevaRuta) =>
      Response.redirect(url.origin + nuevaRuta + url.search, 301);

    const noEncontrado = () => proxyRequest("/pagina-no-encontrada-404");

    const listado = async (slug) => {
      if (!(await BubbleManager.rutaExiste(slug, request, env)))
        return noEncontrado();
      return proxyRequest("/buscador/" + slug);
    };

    // En la ficha (6 segmentos) el último es el Slug_text de Bubble: se deja
    // tal cual porque la página detalle_propiedad lo busca exacto.
    const esFicha = config.TIPOS.has(primero) && norm.length === 6;
    const canonica =
      "/" + (esFicha ? [...norm.slice(0, 5), parts[5]] : norm).join("/");
    const esCanonica = url.pathname === canonica;

    if (config.TIPOS.has(primero)) {
      if (!esCanonica) return redirigir(canonica);
      if (norm.length === 1) return listado(primero);
      if (!config.OPS.has(norm[1])) return noEncontrado();

      if (norm[2] === "cp" || norm[2] === "fraccionamiento") {
        if (norm.length !== 4) return noEncontrado();
        if (norm[2] === "cp" && !config.CP_REGEX.test(norm[3]))
          return noEncontrado();
        return listado(norm.join("-"));
      }

      if (norm.length === 6)
        return proxyRequest("/detalle_propiedad/" + parts[5]);
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

    if (norm.length === 1) {
      if (config.CP_REGEX.test(primero)) return redirigir("/cp/" + primero);
      if (config.ESTADOS.has(primero)) {
        if (!esCanonica) return redirigir(canonica);
        return listado(primero);
      }
    }

    // Ficha por la URL vieja /detalle_propiedad/<Slug_text>:
    // si la propiedad ya tiene url_publica bonita, redirige (301) a ella.
    if (primero === "detalle_propiedad" && parts.length === 2) {
      const bonita = await BubbleManager.urlBonita(parts[1], request, env);
      if (bonita && bonita !== url.pathname) return redirigir(bonita);
    }

    return proxyRequest();
  }
}
