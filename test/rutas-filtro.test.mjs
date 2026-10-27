import test from "node:test";
import assert from "node:assert/strict";
import { esSegmentoFiltro } from "../src/services/utils/utils.js";
import { SitemapRoute } from "../src/routes/SiteMap.route.js";

test("segmentos de filtro", () => {
  for (const s of ["3-recamaras", "1-recamaras", "hasta-1-millon", "hasta-3-millones", "hasta-15-mil", "desde-5-millones", "desde-10-millones", "desde-30-mil"])
    assert.ok(esSegmentoFiltro(s), s);
  for (const s of ["6-recamaras", "casa-venta-contry-1234x5678", "del-valle", "hasta-tres-millones", "desde-abajo"])
    assert.ok(!esSegmentoFiltro(s), s);
});

test("sitemap: la ruta con recámaras de colonia no se trata como ficha", () => {
  assert.equal(
    SitemapRoute.canonica("/casa/venta/nuevo-leon/monterrey/del-valle/3-recamaras"),
    "/casa/venta/nuevo-leon/monterrey/del-valle/3-recamaras",
  );
});
