import { Logger } from "../../services/utils/logger.js";
import { config } from "../config/config.js";
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
        if (!r.ok) break;

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
