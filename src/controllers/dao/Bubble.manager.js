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

  // La ruta con ese slug exacto y al menos una propiedad. null = no existe,
  // undefined = Bubble no respondió.
  static async rutaPorSlug(slug, request, env) {
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
      if (!r.ok) return undefined;
      const j = await r.json();
      return j.response?.results?.[0] ?? null;
    } catch (e) {
      Logger.error(`Error leyendo ruta en Bubble (Slug: ${slug})`, e.message);
      return undefined;
    }
  }

  // Devuelve la ruta (el registro completo de Bubble) que corresponde a un
  // slug ya normalizado, o null si no existe o no tiene propiedades.
  // Las rutas de Bubble pueden guardar acentos ("nuevo-león-monterrey") y la
  // URL pública no ("nuevo-leon-monterrey"); si la búsqueda exacta no la
  // encuentra se usa un índice normalizado → ruta de todas las rutas.
  // Si Bubble no responde se devuelve { slug } para no mandar a 404 una
  // página real (la página se ve, solo sin los textos SEO).
  static async resolverRuta(slug, request, env) {
    const exacta = await this.rutaPorSlug(slug, request, env);
    if (exacta) return exacta;
    const indice = await this.indiceRutas(request, env);
    if (indice?.has(slug)) return indice.get(slug);
    if (exacta === undefined) return { [config.BUBBLE.API_CAMPO_SLUG]: slug };
    return null;
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
          if (!indice.has(clave)) indice.set(clave, r);
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

  // Propiedades activas de un listado, con los mismos filtros que usa Bubble
  // para contar la ruta (actualizar_total_ruta): cada campo de la ruta contra
  // su *_slug en la propiedad. Devuelve { lista, total, desde } o null si
  // Bubble no respondió o la ruta tiene un filtro que aquí no se conoce.
  static async propiedadesDeRuta(ruta, request, env, cuantas = 24) {
    const campos = {
      tipo: "tipo_slug",
      operacion: "operacion_slug",
      estado: "estado_slug",
      ciudad: "ciudad_slug",
      colonia: "colonia_slug",
      cp: "Codigo_postal",
    };
    const slug = ruta?.[config.BUBBLE.API_CAMPO_SLUG] ?? "";
    // /municipio/x y /tipo/op/fraccionamiento/x filtran por campos que la
    // ruta no trae en tipo/operacion/estado/...: sin lista para no mostrar
    // propiedades que no son de esa página.
    const tipos = [...config.TIPOS].join("|");
    const ops = [...config.OPS].join("|");
    const conFiltroDesconocido =
      slug.startsWith("municipio-") ||
      new RegExp(`^(${tipos})-(${ops})-fraccionamiento-`).test(slug);
    if (!slug || conFiltroDesconocido) return null;
    const constraints = [
      { key: "Estatus", constraint_type: "equals", value: "Activo" },
    ];
    for (const [deRuta, deProp] of Object.entries(campos))
      if (ruta[deRuta])
        constraints.push({
          key: deProp,
          constraint_type: "equals",
          value: ruta[deRuta],
        });
    // Colonia oficial: también las propiedades que traen el nombre duplicado
    // (config.COLONIAS_IGUALES) mientras no se corrijan en Bubble.
    if (ruta.colonia) {
      const pre = `${ruta.estado}/${ruta.ciudad}/`;
      const otras = Object.entries(config.COLONIAS_IGUALES)
        .filter(([k, v]) => k.startsWith(pre) && v === ruta.colonia)
        .map(([k]) => k.slice(pre.length));
      if (otras.length) {
        const c = constraints.find((x) => x.key === "colonia_slug");
        c.constraint_type = "in";
        c.value = [ruta.colonia, ...otras];
      }
    }
    // Rutas con filtro (crear_ruta_filtro): mismas reglas que el buscador y
    // que actualizar_total_ruta en Bubble (recámaras exactas, precio ≤ tope).
    if (Number(ruta.recamaras) > 0)
      constraints.push({
        key: "N_Habitaciones",
        constraint_type: "equals",
        value: Number(ruta.recamaras),
      });
    if (Number(ruta.precio_max) > 0)
      constraints.push({
        key: "Precio",
        constraint_type: "less than",
        value: Number(ruta.precio_max) + 1,
      });
    if (constraints.length === 1) return null;

    const baseUrl = this._getBaseUrl(request, env);
    const consulta = async (extra, params) => {
      const api = new URL(
        `/api/1.1/obj/${config.BUBBLE.API_TIPO_PROP}`,
        baseUrl,
      );
      api.search =
        "?" +
        params +
        "&constraints=" +
        encodeURIComponent(JSON.stringify([...constraints, ...extra]));
      const r = await fetch(api.toString(), {
        cf: { cacheTtl: config.BUBBLE.CACHE_SEGUNDOS, cacheEverything: true },
      });
      if (!r.ok)
        throw new Error(
          `Bubble ${r.status}: ${(await r.text()).slice(0, 200)}`,
        );
      return (await r.json()).response;
    };
    // Cada consulta por separado: si el orden no le gusta a la Data API se
    // reintenta sin orden, y si falla la del precio no se pierde la lista.
    const intentar = async (extra, ...variantes) => {
      for (const params of variantes) {
        try {
          return await consulta(extra, params);
        } catch (e) {
          Logger.error(`Propiedades de la ruta ${slug} (${params})`, e.message);
        }
      }
      return null;
    };
    const [recientes, barata] = await Promise.all([
      intentar(
        [],
        `limit=${cuantas}&sort_field=Created%20Date&descending=true`,
        `limit=${cuantas}`,
      ),
      intentar(
        // En venta hay precios mal capturados (12,600 por 12.6 millones, o el
        // precio por m²): abajo de PRECIO_MINIMO_VENTA no cuentan para el "desde".
        [
          {
            key: "Precio",
            constraint_type: "greater than",
            value:
              ruta.operacion === "renta" ? 0 : config.BUBBLE.PRECIO_MINIMO_VENTA,
          },
        ],
        "limit=1&sort_field=Precio&descending=false",
      ),
    ]);
    if (!recientes) return null;
    const lista = recientes.results ?? [];
    return {
      lista,
      total: lista.length + (recientes.remaining ?? 0),
      desde: barata?.results?.[0]?.Precio ?? null,
    };
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
