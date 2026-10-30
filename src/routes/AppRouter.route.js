import { config } from "../controllers/config/config.js";
import { BubbleManager } from "../controllers/dao/Bubble.manager.js";
import { Utils, esSegmentoFiltro } from "../services/utils/utils.js";
import { FichaSeo } from "../services/FichaSeo.js";
import { ListadoSeo } from "../services/ListadoSeo.js";
import { InicioSeo } from "../services/InicioSeo.js";
import { GoogleLogin } from "../services/GoogleLogin.js";
import { PuenteLogin } from "../services/PuenteLogin.js";
import { AppRedirect } from "../services/AppRedirect.js";
import {
  repetidas,
  deSesion,
  borrarVieja,
} from "../services/CookiesViejas.js";
import { SitemapRoute } from "./SiteMap.route.js";
import { urlFicha, idDeSlug } from "../services/UrlFicha.js";
import {
  estadoFicha,
  ubicacionFicha,
  listadoMasCercano,
  listadosDeArriba,
} from "../services/FichaBaja.js";
import { RobotsRoute } from "./Robots.route.js";
import { rutaCanonica } from "../services/RutaCanonica.js";
import { tituloDeRespaldo, tituloVacio } from "../services/TituloSeguro.js";

export class AppRouter {
  static async route(request, env) {
    // app.dotcasa.com.mx (el origen de Bubble): 301 al dominio público o paso
    // directo. Va primero para que nada del resto del router corra en ese host.
    const deApp = AppRedirect.handle(request);
    if (deApp) return deApp;

    // Login con Google directo en dotcasa.com.mx
    const entrada = new URL(request.url);
    if (
      entrada.hostname === config.DOMINIO &&
      entrada.pathname === GoogleLogin.RUTA
    )
      return GoogleLogin.handle(request, env);
    // Regreso del login con Google hecho en app.dotcasa.com.mx
    if (
      entrada.hostname === config.DOMINIO &&
      entrada.pathname === PuenteLogin.RUTA
    )
      return PuenteLogin.handle(request, env);

    const proxyRequest = async (nuevaRuta = null) => {
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
        // Esta llamada es nuestra: AppRedirect la deja pasar al origen en
        // lugar de mandarla con 301 al dominio público.
        init.headers.set(AppRedirect.HEADER_ORIGEN, AppRedirect.VALOR_ORIGEN);
        await comoBubble(init, baseUrl);
      }

      if (nuevaRuta) {
        target.pathname = nuevaRuta;
      }

      return fetch(target.toString(), init)
        .then(publicarRespuesta)
        .then(pulirHtml);
    };

    // El navegador cree que la app vive en dotcasa.com.mx (ver conHostPublico),
    // pero Bubble solo acepta llamadas de su propio dominio: registro, login y
    // demás acciones de servidor fallan con su error genérico. Le mandamos
    // Origin, Referer, X-Bubble-R y las URLs del cuerpo con el host de Bubble.
    // X-Bubble-R es la dirección de la página que manda el cliente de Bubble en
    // cada llamada; si no coincide con Origin/Referer, cerrar sesión falla.
    const comoBubble = async (init, baseUrl) => {
      const publico = new URL(request.url).origin;
      if (publico === baseUrl.origin) return;
      const aBubble = (s) => s.split(publico).join(baseUrl.origin);

      for (const nombre of ["Origin", "Referer", "X-Bubble-R"]) {
        const valor = init.headers.get(nombre);
        if (valor && valor.startsWith(publico))
          init.headers.set(nombre, aBubble(valor));
      }

      const tipo = init.headers.get("Content-Type") || "";
      const esTexto = /json|x-www-form-urlencoded|text\/plain/i.test(tipo);
      if (!init.body || !esTexto) return;
      const cuerpo = await request.text();
      init.body = cuerpo.includes(publico) ? aBubble(cuerpo) : cuerpo;
      init.headers.delete("Content-Length");
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
      // Copias viejas (domain=dotcasa.com.mx) que hay que borrar: las de las
      // cookies de sesión que Bubble pone ahora y las que el navegador mandó
      // repetidas. Ver CookiesViejas.js.
      const viejas = new Set([
        ...(cookieConDominio ? deSesion(cookies) : []),
        ...repetidas(request.headers.get("Cookie")),
      ]);
      if (!location && !cookieConDominio && !viejas.size) return res;

      const out = new Response(res.body, res);
      if (location) {
        const destino = new URL(location, env.BUBBLE_BASE_URL);
        if (destino.hostname === bubbleHost) {
          destino.protocol = publico.protocol;
          destino.host = publico.host;
          out.headers.set("Location", destino.toString());
        }
      }
      if (cookieConDominio || viejas.size) {
        out.headers.delete("Set-Cookie");
        // Primero se borra la copia vieja y después va la cookie nueva.
        for (const nombre of viejas)
          out.headers.append(
            "Set-Cookie",
            borrarVieja(nombre, publico.hostname),
          );
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
    // cambiamos por la URL pública limpia (sin www, sin parámetros, sin "/" final;
    // /index es "/"; ver RutaCanonica.js). También quitamos X-Powered-By y
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

      const ruta = new URL(request.url).pathname;
      let tituloActual = "";
      let tituloConTexto = false;
      const escaparTitulo = (x) =>
        x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const canonica = "https://" + config.DOMINIO + rutaCanonica(ruta);
      return conHostPublico(new HTMLRewriter())
        // Bubble trae <meta id="dotcasa-origen" name="robots" content="noindex">
        // para que app.dotcasa.com.mx (el origen) no compita con el dominio
        // público. Aquí se quita, salvo en /version-test, que no debe indexarse.
        .on("meta#dotcasa-origen", {
          element: (e) => {
            if (!ruta.startsWith("/version-test")) e.remove();
          },
        })
        // El título nunca queda vacío ni en "- DotCasa" (ver TituloSeguro.js).
        // El texto llega en pedazos: se junta y, en el último, se decide. Si el
        // <title> no trae texto, el respaldo se pone antes de cerrarlo.
        .on("title", {
          element: (e) => {
            tituloActual = "";
            tituloConTexto = false;
            e.onEndTag((fin) => {
              if (!tituloConTexto)
                fin.before(escaparTitulo(tituloDeRespaldo(ruta)), {
                  html: true,
                });
            });
          },
          text: (t) => {
            tituloConTexto = true;
            tituloActual += t.text;
            if (!t.lastInTextNode) return t.remove();
            const final = tituloVacio(tituloActual)
              ? escaparTitulo(tituloDeRespaldo(ruta))
              : tituloActual;
            t.replace(final, { html: true });
          },
        })
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

    // robots.txt propio, sin pasar por Bubble (ver Robots.route.js)
    if (url.pathname === "/robots.txt") return RobotsRoute.handle();

    if (url.pathname === "/sitemap.xml") {
      return SitemapRoute.handle(request, env);
    }

    // Filtros del buscador en la query (utm, gclid, etc. no cuentan). Cuando
    // la búsqueda no tiene ruta propia (/quinta/venta?precio_min=5000000) el
    // listado usa la ruta más cercana, que tiene su propio total (20) aunque
    // la búsqueda dé 15. Precio y recámaras se suman a la ruta para contar
    // aquí con las mismas reglas que Bubble y el título lleva el conteo real
    // y el filtro: "15 Quintas en Venta desde $5M en México | DotCasa".
    // Con otros filtros (?banos=, ?construccion_min=...) el conteo de aquí no
    // es el de la búsqueda (completa: false): el navegador (HTML S) cambia
    // el número por el de "¡Tenemos N propiedades!".
    const FILTROS_QUERY = ["precio_min", "precio_max", "recamaras", "banos",
      "construccion_min", "construccion_max", "terreno_min", "terreno_max",
      "antiguedad", "tipo", "operacion", "estado", "ciudad", "colonia", "cp",
      "tipos", "operaciones", "estados", "ciudades", "colonias"];
    const conFiltrosDeQuery = (ruta, sp) => {
      const vista = { ...ruta };
      let conFiltros = false;
      let completa = true;
      for (const k of FILTROS_QUERY) {
        const v = (sp.get(k) ?? "").trim();
        if (v === "" || v === "0" || v === "0-0") continue;
        conFiltros = true;
        const n = Number(v.replace(/,/g, ""));
        if (k === "recamaras" && Number.isInteger(n) && n > 0) vista.recamaras = n;
        else if ((k === "precio_min" || k === "precio_max") && n > 0) vista[k] = n;
        else completa = false;
      }
      return { vista: conFiltros ? vista : ruta, conFiltros, completa };
    };
    // Título, descripción, schema... del listado (ver ListadoSeo.js) para la
    // ruta y los filtros de la query (q, de conFiltrosDeQuery).
    // exacto: el número del título es el de la búsqueda.
    const datosDeListado = (ruta, q, props, canonica) => {
      if (!q.conFiltros || !props)
        return ListadoSeo.datos(ruta, props, canonica, { exacto: !q.conFiltros });
      // El total es el de la búsqueda aunque sea 0 (sin esto se usaría el
      // guardado en la ruta).
      return ListadoSeo.datos(
        { ...q.vista, [config.BUBBLE.API_CAMPO_TOTAL]: props.total },
        props,
        canonica,
        { exacto: q.completa },
      );
    };

    // Título del listado para otra URL del buscador, sin cargar la página: la
    // persona cambia filtros, el buscador cambia la URL (replaceState) y el
    // HTML S de Bubble pide aquí el título nuevo. Mismo cálculo que listado().
    // /__dc/titulo?u=/quinta/venta%3Fprecio_min%3D5000000
    //   -> { "titulo": "15 Quintas en Venta desde $5M en México | DotCasa", "exacto": true }
    if (url.pathname === "/__dc/titulo") {
      const responder = (cuerpo, status = 200) =>
        new Response(JSON.stringify(cuerpo), {
          status,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=60",
            "X-Robots-Tag": "noindex",
          },
        });
      let destino;
      try {
        destino = new URL(url.searchParams.get("u") || "/", url.origin);
      } catch (e) {
        return responder({ titulo: null }, 400);
      }
      const segs = destino.pathname.split("/").filter(Boolean).map(Utils.normalizar);
      const ruta = segs.length
        ? await BubbleManager.resolverRuta(segs.join("-"), request, env)
        : null;
      if (!ruta?._id) return responder({ titulo: null }, 404);
      const q = conFiltrosDeQuery(ruta, destino.searchParams);
      const props = await BubbleManager.propiedadesDeRuta(q.vista, request, env);
      const d = datosDeListado(
        ruta,
        q,
        props,
        "https://" + config.DOMINIO + destino.pathname,
      );
      return responder({ titulo: d.titulo, exacto: d.exacto });
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

    // Una sola versión de cada URL: /casas/venta/... (plural) va a
    // /casa/venta/..., y una colonia duplicada ("monterrey-centro") va a la
    // oficial ("centro"). Ver config.PLURALES y config.COLONIAS_IGUALES.
    {
      const nueva = Utils.rutaOficial(norm);
      if (nueva !== norm) {
        // En la ficha el último segmento (su slug) se deja tal cual
        if (config.TIPOS.has(nueva[0]) && nueva.length === 6)
          nueva[5] = parts[5];
        return redirigir("/" + nueva.join("/"));
      }
    }

    // Se ve la página 404 de Bubble, pero con estado 404 para que Google no
    // la indexe como si fuera una página real.
    const noEncontrado = () =>
      proxyRequest("/pagina-no-encontrada-404").then(
        (res) => new Response(res.body, { status: 404, headers: res.headers }),
      );

    // Con filtros (?precio_max=..., ?recamaras=...) la página sirve, pero Google
    // solo debe indexar la versión limpia.
    const noIndexar = (res) => {
      const out = new Response(res.body, res);
      out.headers.set("X-Robots-Tag", "noindex, follow");
      return out;
    };
    const sinIndexarSiFiltra = (res) => (url.search ? noIndexar(res) : res);

    // Fichas: Bubble abre detalle_propiedad con cualquier slug que termine en
    // un ID real (/detalle_propiedad/x-<ID> da 200), o sea duplicados infinitos.
    // Se busca la propiedad por Slug_text y, si no aparece, por el ID del final.
    const sinCodificar = (s) => {
      try {
        return decodeURIComponent(s);
      } catch (e) {
        return s;
      }
    };
    // Si el slug termina en un ID se busca por ID (una sola consulta, sirve
    // para la URL nueva, la vieja y cualquier variante); si no, por Slug_text.
    // null = no existe · undefined = Bubble no respondió
    const buscarPropiedad = async (slug) => {
      const id = idDeSlug(slug);
      if (id) return BubbleManager.propiedadPorId(id, request, env);
      return BubbleManager.propiedadPorSlug(slug, request, env);
    };
    // URL pública de la ficha: la que arma el Worker (slug limpio) o, si a la
    // propiedad le faltan campos, su url_publica de Bubble. null si no hay.
    const rutaDeFicha = (p) => {
      const r = SitemapRoute.canonica(
        urlFicha(p) ?? p?.URL_publica ?? p?.url_publica,
      );
      const n = r ? r.split("/").filter(Boolean) : [];
      return n.length === 6 && config.TIPOS.has(n[0]) ? r : null;
    };
    // Bubble busca la ficha por su Slug_text exacto
    const paginaFicha = (p, slugUrl) =>
      proxyRequest(
        "/detalle_propiedad/" +
          (p?.Slug_text ? encodeURIComponent(p.Slug_text) : slugUrl),
      );
    const mismaRuta = (a, b) => sinCodificar(a) === sinCodificar(b);

    // Ficha que ya no existe (borrada) o "Finalizado": 301 al listado más
    // cercano con propiedades (su colonia, si no su ciudad...). Ver FichaBaja.js.
    // Sin query: los filtros de la URL vieja no aplican al listado.
    const existeListado = async (slug) => {
      const r = await BubbleManager.rutaPorSlug(slug, request, env);
      return r === undefined ? undefined : Boolean(r);
    };
    const fichaDeBaja = async (prop, norm) => {
      const destino = await listadoMasCercano(
        ubicacionFicha(prop, norm),
        existeListado,
      );
      return new Response(null, {
        status: 301,
        headers: {
          Location: url.origin + destino,
          // Un día: si la propiedad se reactiva, la ficha vuelve pronto
          "Cache-Control": "public, max-age=86400",
        },
      });
    };
    // Ubicación que trae el slug viejo "casa-venta-colonia-ciudad-ID": solo
    // tipo y operación son seguros (colonia y ciudad no se pueden separar).
    const ubicacionDeSlug = (slug) => {
      const s = Utils.normalizar(slug);
      const tipo = [...config.TIPOS]
        .sort((a, b) => b.length - a.length)
        .find((t) => s.startsWith(t + "-"));
      if (!tipo) return [];
      const op = [...config.OPS].find((o) =>
        s.startsWith(tipo + "-" + o + "-"),
      );
      return op ? [tipo, op] : [tipo];
    };

    // La URL va sin acentos pero la ruta en Bubble puede tenerlos
    // ("nuevo-león-monterrey"): a Bubble se le pasa su slug real.
    // Al HTML se le agregan título, descripción, H1, conteo, links a las
    // fichas y schema (ver ListadoSeo.js).
    // Listado que existe en Bubble pero hoy tiene 0 propiedades: 302 (no 301,
    // el inventario puede volver y la URL debe conservar lo ganado) al
    // listado de arriba que sí tenga. Una URL que nunca existió: 404.
    const listadoVacio = async (slug) => {
      const existio = await BubbleManager.rutaRegistrada(slug, request, env);
      if (!existio) return noEncontrado();
      for (const c of listadosDeArriba(norm)) {
        if ((await existeListado(c.slug)) !== false)
          return Response.redirect(url.origin + c.ruta, 302);
      }
      return Response.redirect(url.origin + "/propiedades", 302);
    };

    const listado = async (slug) => {
      const ruta = await BubbleManager.resolverRuta(slug, request, env);
      if (!ruta) return listadoVacio(slug);
      const real = ruta[config.BUBBLE.API_CAMPO_SLUG];
      const conDatos = request.method === "GET" && ruta._id;
      const q = conFiltrosDeQuery(ruta, url.searchParams);
      const [res, props] = await Promise.all([
        proxyRequest("/buscador/" + encodeURIComponent(real)),
        conDatos ? BubbleManager.propiedadesDeRuta(q.vista, request, env) : null,
      ]);
      const html = (res.headers.get("Content-Type") || "").startsWith(
        "text/html",
      );
      if (request.method !== "GET" || res.status !== 200 || !html || !ruta._id)
        return sinIndexarSiFiltra(res);
      const datos = datosDeListado(
        ruta,
        q,
        props,
        "https://" + config.DOMINIO + url.pathname,
      );
      const out = new Response(ListadoSeo.inyectar(res, datos).body, res);
      // Para revisar en el navegador (Network) si se armó la lista de fichas
      out.headers.set(
        "X-Dotcasa-Listado",
        props ? `ok ${props.total} propiedades` : "sin lista",
      );
      return sinIndexarSiFiltra(out);
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

    const esFicha =
      config.TIPOS.has(primero) && norm.length === 6 && !esSegmentoFiltro(norm[5]);
    const canonica =
      "/" + (esFicha ? [...norm.slice(0, 5), parts[5]] : norm).join("/");
    const esCanonica = url.pathname === canonica;

    if (config.TIPOS.has(primero)) {
      // La ficha se valida contra su URL real más abajo (un solo 301)
      if (!esCanonica && !esFicha) return redirigir(canonica);
      if (norm.length === 1) return listado(primero);
      // Tipo por ubicación, venta y renta juntas: /casa/estado, /casa/estado/municipio
      if (config.ESTADOS.has(norm[1])) {
        // /casa/estado/ciudad/colonia también existe (tipo + colonia)
        if (norm.length > 4) return noEncontrado();
        return listado(norm.join("-"));
      }
      if (!config.OPS.has(norm[1])) return noEncontrado();

      if (norm[2] === "cp" || norm[2] === "fraccionamiento") {
        if (norm.length !== 4) return noEncontrado();
        if (norm[2] === "cp" && !config.CP_REGEX.test(norm[3]))
          return noEncontrado();
        return listado(norm.join("-"));
      }

      // /casa/venta/estado/ciudad/colonia/3-recamaras: listado, no ficha
      if (norm.length === 6 && esSegmentoFiltro(norm[5]))
        return listado(norm.join("-"));
      if (norm.length === 6) {
        const prop = await buscarPropiedad(parts[5]);
        // Borrada o vendida: a su listado, no a un 404
        if (prop === null || (prop && estadoFicha(prop) === "baja"))
          return fichaDeBaja(prop, norm);
        const destino = prop && rutaDeFicha(prop);
        // Slug viejo o inventado, o ubicación que no es la suya: a su URL real
        if (destino && !mismaRuta(destino, url.pathname))
          return redirigir(destino);

        const res = await paginaFicha(prop, parts[5]);
        // Existe pero no tiene url_publica bonita, o está en borrador/pausa:
        // se ve (el agente la revisa), pero no se indexa
        if (prop && (!destino || estadoFicha(prop) === "oculta"))
          return noIndexar(res);
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
      // Si todavía no hay ruta "/venta" (o "/renta", "/preventa") con
      // propiedades, se abre el listado general filtrado por esa operación.
      // Antes se mandaba a "/casa/venta", lo que agregaba "casa" a los tipos
      // que la persona hubiera elegido (?tipo=departamento,terreno).
      if (
        norm.length === 1 &&
        !(await BubbleManager.rutaExiste(primero, request, env))
      ) {
        const filtros = new URLSearchParams(url.search);
        filtros.set("operacion", primero);
        const qs = filtros.toString().replace(/%2C/gi, ",");
        return Response.redirect(url.origin + "/propiedades?" + qs, 302);
      }
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

    // Ficha por la URL vieja /detalle_propiedad/<Slug_text o cualquier-cosa-ID>:
    // si la propiedad tiene url_publica bonita, 301 a ella; si se borró o está
    // "Finalizado", 301 a su listado (solo si el slug trae un ID; si no, 404);
    // si no tiene url bonita (borrador) o Bubble no respondió, se ve sin indexar.
    // /propiedad/<slug> es otro formato viejo de la ficha: mismo trato.
    if (primero === "detalle-propiedad" || primero === "propiedad") {
      const vieja = primero === "detalle-propiedad";
      if (parts.length !== 2)
        return vieja ? proxyRequest().then(noIndexar) : noEncontrado();
      const prop = await buscarPropiedad(parts[1]);
      if (prop === null)
        return idDeSlug(parts[1])
          ? fichaDeBaja(null, ubicacionDeSlug(parts[1]))
          : noEncontrado();
      if (prop && estadoFicha(prop) === "baja") return fichaDeBaja(prop, []);
      const destino = prop && rutaDeFicha(prop);
      if (destino) return redirigir(destino);
      return paginaFicha(prop, parts[1]).then(noIndexar);
    }

    return proxyRequest();
  }
}
