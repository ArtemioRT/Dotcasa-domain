import { config } from "../controllers/config/config.js";
import { BubbleManager } from "../controllers/dao/Bubble.manager.js";
import { Utils } from "../services/utils/utils.js";

export class SitemapRoute {
  // Devuelve la misma ruta canónica que usa AppRouter (sin acentos, minúsculas),
  // o null si la URL no sirve para el sitemap (vacía, "//", cp inválido).
  static canonica(urlPublica) {
    if (!urlPublica) return null;
    const parts = urlPublica.split("/").filter(Boolean);
    const norm = parts.map(Utils.normalizar);
    if (norm.length === 0) return null;
    // Ficha de propiedad: el Slug_text final va tal cual (igual que AppRouter)
    if (config.TIPOS.has(norm[0]) && norm.length === 6)
      return "/" + [...norm.slice(0, 5), encodeURIComponent(parts[5])].join("/");
    for (let i = 0; i < norm.length; i++)
      if (norm[i] === "cp" && !config.CP_REGEX.test(norm[i + 1] ?? ""))
        return null;
    return "/" + norm.join("/");
  }

  static async handle(request, env) {
    const origin = new URL(request.url).origin;

    const rutas = await BubbleManager.traerTodo(
      request,
      env,
      config.BUBBLE.API_TIPO,
      [
        { key: "indexable", constraint_type: "equals", value: true },
        {
          key: config.BUBBLE.API_CAMPO_TOTAL,
          constraint_type: "greater than",
          value: 0,
        },
      ],
    );

    const props = await BubbleManager.traerTodo(request, env, "propiedades", [
      { key: "Estatus", constraint_type: "equals", value: "Activo" },
    ]);

    const rutasUnicas = new Set();
    const agregar = (urlPublica) => {
      const ruta = SitemapRoute.canonica(urlPublica);
      if (ruta) rutasUnicas.add(ruta);
    };
    for (const r of rutas)
      if (
        (r[config.BUBBLE.API_CAMPO_TOTAL] ?? 0) >=
        config.BUBBLE.SITEMAP_MIN_PROPIEDADES
      )
        agregar(r.url_publica);
    for (const p of props) agregar(p.URL_publica ?? p.url_publica);

    const urls = ["/", ...rutasUnicas]
      .map((p) => `  <url><loc>${Utils.escapeXml(origin + p)}</loc></url>`)
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

    return new Response(xml, {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  }
}
