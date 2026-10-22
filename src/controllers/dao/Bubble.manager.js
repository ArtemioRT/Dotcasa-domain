import { Logger } from "../../services/utils/logger.js";
import { config } from "../config/config.js";
import { Utils } from "../../services/utils/utils.js";
export class BubbleManager {
  static _getBaseUrl(request, env) {
    return env.BUBBLE_BASE_URL || new URL(request.url).origin;
  }

  static async rutaExiste(slug, request, env) {
    const baseUrl = this._getBaseUrl(request, env);
    const api = new URL(`/api/1.1/obj/${config.BUBBLE.API_TIPO}`, baseUrl);

    api.search =
      "?limit=1&constraints=" +
      encodeURIComponent(
        JSON.stringify([
          {
            key: config.BUBBLE.API_CAMPO_SLUG,
            constraint_type: "equals",
            value: slug,
          },
          {
            key: config.BUBBLE.API_CAMPO_TOTAL,
            constraint_type: "greater than",
            value: 0,
          },
        ]),
      );

    try {
      const r = await fetch(api.toString(), {
        cf: { cacheTtl: config.BUBBLE.CACHE_SEGUNDOS, cacheEverything: true },
      });
      if (!r.ok) return true;

      const j = await r.json();
      return (j.response?.results?.length ?? 0) > 0;
    } catch (e) {
      Logger.error(
        `Error verificando ruta en Bubble (Slug: ${slug})`,
        e.message,
      );
      return true;
    }
  }

  // Devuelve el slug real (tal cual está en Bubble) de la ruta que corresponde
  // a un slug ya normalizado, o null si no existe o no tiene propiedades.
  // Las rutas de Bubble guardan acentos ("nuevo-león-monterrey") y la URL
  // pública no ("nuevo-leon-monterrey"); si la búsqueda exacta no la encuentra
  // se usa un índice normalizado → real de todas las rutas.
  static async resolverRuta(slug, request, env) {
    if (await this.rutaExiste(slug, request, env)) return slug;
    const indice = await this.indiceRutas(request, env);
    if (!indice) return null;
    return indice.get(slug) ?? null;
  }

  static _indice = null;
  static _indiceHasta = 0;

  static async indiceRutas(request, env) {
    if (this._indice && Date.now() < this._indiceHasta) return this._indice;
    const constraints = [
      {
        key: config.BUBBLE.API_CAMPO_TOTAL,
        constraint_type: "greater than",
        value: 0,
      },
    ];
    const baseUrl = this._getBaseUrl(request, env);
    const pagina = async (cursor) => {
      const api = new URL(`/api/1.1/obj/${config.BUBBLE.API_TIPO}`, baseUrl);
      api.search =
        "?limit=100&cursor=" +
        cursor +
        "&constraints=" +
        encodeURIComponent(JSON.stringify(constraints));
      const r = await fetch(api.toString(), {
        cf: { cacheTtl: 3600, cacheEverything: true },
      });
      if (!r.ok) throw new Error("Bubble " + r.status);
      return (await r.json()).response;
    };
    try {
      // Primera página para saber cuántas hay; las demás en paralelo
      const primera = await pagina(0);
      const resultados = [...(primera?.results ?? [])];
      const total = resultados.length + (primera?.remaining ?? 0);
      const cursores = [];
      for (let c = resultados.length; c < total; c += 100) cursores.push(c);
      const resto = await Promise.all(cursores.map(pagina));
      for (const p of resto) resultados.push(...(p?.results ?? []));

      const indice = new Map();
      for (const r of resultados) {
        const real = r[config.BUBBLE.API_CAMPO_SLUG];
        if (typeof real === "string" && real) {
          const clave = Utils.normalizar(real);
          if (!indice.has(clave)) indice.set(clave, real);
        }
      }
      this._indice = indice;
      this._indiceHasta = Date.now() + config.BUBBLE.CACHE_SEGUNDOS * 1000;
      return indice;
    } catch (e) {
      Logger.error("Error armando el índice de rutas", e.message);
      return this._indice; // el anterior, si había
    }
  }

  // Busca la propiedad por su Slug_text (llega codificado en la URL, p. ej.
  // con %20). Devuelve null si no existe y undefined si la API falla, para
  // no mandar a 404 una ficha real cuando Bubble tiene un mal momento.
  static async propiedadPorSlug(slugText, request, env) {
    let valor = slugText;
    try {
      valor = decodeURIComponent(slugText);
    } catch (e) {}

    const baseUrl = this._getBaseUrl(request, env);
    const api = new URL(`/api/1.1/obj/${config.BUBBLE.API_TIPO_PROP}`, baseUrl);

    api.search =
      "?limit=1&constraints=" +
      encodeURIComponent(
        JSON.stringify([
          {
            key: config.BUBBLE.API_CAMPO_SLUGTEXT,
            constraint_type: "equals",
            value: valor,
          },
        ]),
      );

    try {
      const r = await fetch(api.toString(), {
        cf: { cacheTtl: config.BUBBLE.CACHE_SEGUNDOS, cacheEverything: true },
      });
      if (!r.ok) return undefined;

      const j = await r.json();
      return j.response?.results?.[0] ?? null;
    } catch (e) {
      Logger.error(
        `Error buscando propiedad en Bubble (Slug_text: ${valor})`,
        e.message,
      );
      return undefined;
    }
  }

  // Busca la propiedad por su unique id de Bubble (el "1234x5678" del final
  // del slug). Igual que arriba: null si no existe, undefined si la API falla.
  static async propiedadPorId(id, request, env) {
    const baseUrl = this._getBaseUrl(request, env);
    const api = new URL(
      `/api/1.1/obj/${config.BUBBLE.API_TIPO_PROP}/${encodeURIComponent(id)}`,
      baseUrl,
    );
    try {
      const r = await fetch(api.toString(), {
        cf: { cacheTtl: config.BUBBLE.CACHE_SEGUNDOS, cacheEverything: true },
      });
      if (r.status === 404 || r.status === 400) return null;
      if (!r.ok) return undefined;
      const j = await r.json();
      return j.response ?? null;
    } catch (e) {
      Logger.error(`Error buscando propiedad en Bubble (ID: ${id})`, e.message);
      return undefined;
    }
  }

  static async traerTodo(request, env, tipo, constraints) {
    const baseUrl = this._getBaseUrl(request, env);
    const items = [];
    let cursor = 0;

    for (let i = 0; i < config.BUBBLE.SITEMAP_MAX_PAGINAS; i++) {
      const api = new URL(`/api/1.1/obj/${tipo}`, baseUrl);
      api.search =
        "?limit=100&cursor=" +
        cursor +
        "&constraints=" +
        encodeURIComponent(JSON.stringify(constraints));

      try {
        const r = await fetch(api.toString(), {
          cf: { cacheTtl: 3600, cacheEverything: true },
        });
        if (!r.ok) {
          Logger.error(
            `Bubble respondió ${r.status} para tipo: ${tipo}`,
            (await r.text()).slice(0, 300),
          );
          break;
        }

        const j = await r.json();
        const results = j.response?.results ?? [];
        items.push(...results);

        if (results.length === 0 || (j.response?.remaining ?? 0) === 0) break;
        cursor += results.length;
      } catch (e) {
        Logger.error(
          `Error trayendo datos de Bubble para tipo: ${tipo}`,
          e.message,
        );
        break;
      }
    }
    return items;
  }
}
