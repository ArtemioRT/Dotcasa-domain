import { config } from "../controllers/config/config.js";
import { BubbleManager } from "../controllers/dao/Bubble.manager.js";
import { Utils } from "../services/utils/utils.js";

export class SitemapRoute {
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
      { key: "activa", constraint_type: "equals", value: true },
    ]);

    const rutasUnicas = new Set();
    for (const r of rutas) if (r.url_publica) rutasUnicas.add(r.url_publica);
    for (const p of props) if (p.url_publica) rutasUnicas.add(p.url_publica);

    const urls = [...rutasUnicas]
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
