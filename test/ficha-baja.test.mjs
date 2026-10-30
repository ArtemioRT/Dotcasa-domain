import test from "node:test";
import assert from "node:assert/strict";
import {
  estadoFicha,
  ubicacionFicha,
  candidatosListado,
  listadoMasCercano,
  listadosDeArriba,
} from "../src/services/FichaBaja.js";
import { AppRouter } from "../src/routes/AppRouter.route.js";

test("estado de la ficha según Estatus", () => {
  assert.equal(estadoFicha({ Estatus: "Activo" }), "activa");
  assert.equal(estadoFicha({ Estatus: "Finalizado" }), "baja");
  assert.equal(estadoFicha({ Estatus: "Vendida" }), "baja");
  assert.equal(estadoFicha({ Estatus: "Borrador" }), "oculta");
  assert.equal(estadoFicha({ Estatus: "En pausa" }), "oculta");
  assert.equal(estadoFicha({}), "oculta");
});

test("ubicación: de la propiedad si existe, si no de la URL", () => {
  const norm = ["casa", "venta", "nuevo-leon", "monterrey", "cumbres", "x-1x2"];
  assert.deepEqual(ubicacionFicha(null, norm), {
    tipo: "casa", op: "venta", estado: "nuevo-leon", ciudad: "monterrey", colonia: "cumbres",
  });
  const prop = {
    tipo_slug: "departamento", operacion_slug: "renta", estado_slug: "nuevo-leon",
    ciudad_slug: "monterrey", colonia_slug: "monterrey-centro",
  };
  // colonia duplicada -> la oficial
  assert.equal(ubicacionFicha(prop, norm).colonia, "centro");
  assert.equal(ubicacionFicha(prop, norm).tipo, "departamento");
});

test("candidatos del más parecido al más general", () => {
  const rutas = candidatosListado({
    tipo: "casa", op: "venta", estado: "nuevo-leon", ciudad: "san-nicolas-de-los-garza", colonia: "anahuac",
  }).map((c) => c.ruta);
  assert.deepEqual(rutas, [
    "/casa/venta/nuevo-leon/san-nicolas-de-los-garza/anahuac",
    "/casa/nuevo-leon/san-nicolas-de-los-garza/anahuac",
    "/venta/nuevo-leon/san-nicolas-de-los-garza/anahuac",
    "/nuevo-leon/san-nicolas-de-los-garza/anahuac",
    "/casa/venta/nuevo-leon/san-nicolas-de-los-garza",
    "/casa/nuevo-leon/san-nicolas-de-los-garza",
    "/venta/nuevo-leon/san-nicolas-de-los-garza",
    "/casa/venta/nuevo-leon",
    "/nuevo-leon/san-nicolas-de-los-garza",
    "/casa/venta",
  ]);
});

test("tipo desconocido o estado inválido: solo lo que sí existe", () => {
  const rutas = candidatosListado({
    tipo: "local", op: "renta", estado: "mendoza", ciudad: "mendoza", colonia: "x",
  }).map((c) => c.ruta);
  assert.deepEqual(rutas, []);
  const soloTipo = candidatosListado({ tipo: "casa", op: "venta" }).map((c) => c.slug);
  assert.deepEqual(soloTipo, ["casa-venta"]);
});

test("elige el primero que existe; sin ninguno /propiedades", async () => {
  const u = { tipo: "casa", op: "venta", estado: "nuevo-leon", ciudad: "monterrey", colonia: "cumbres" };
  const hay = new Set(["casa-venta-nuevo-leon-monterrey"]);
  assert.equal(
    await listadoMasCercano(u, async (s) => hay.has(s)),
    "/casa/venta/nuevo-leon/monterrey",
  );
  assert.equal(await listadoMasCercano(u, async () => false), "/propiedades");
  // Bubble no respondió: se toma el más parecido
  assert.equal(
    await listadoMasCercano(u, async () => undefined),
    "/casa/venta/nuevo-leon/monterrey/cumbres",
  );
});

test("listados de arriba: quita filtro, lugar y segmentos colgantes", () => {
  const r = (ruta) => listadosDeArriba(ruta.split("/").filter(Boolean)).map((c) => c.ruta);
  assert.deepEqual(r("/casa/venta/nuevo-leon/monterrey/cumbres"), [
    "/casa/venta/nuevo-leon/monterrey", "/casa/venta/nuevo-leon", "/casa/venta", "/casa",
  ]);
  assert.deepEqual(r("/casa/venta/nuevo-leon/monterrey/cumbres/3-recamaras")[0],
    "/casa/venta/nuevo-leon/monterrey/cumbres");
  assert.deepEqual(r("/casa/venta/cp/64000"), ["/casa/venta", "/casa"]);
  assert.deepEqual(r("/cp/64000"), []);
});

// ---- Router con la Data API de Bubble simulada ----
const RUTAS_CON_PROPS = new Set(["casa-venta-nuevo-leon-monterrey", "casa-venta"]);
// Existen en la tabla ruta pero hoy con 0 propiedades
const RUTAS_VACIAS = new Set(["casa-venta-nuevo-leon-monterrey-cumbres"]);
const PROPS = {
  "1x1": {
    _id: "1x1", Estatus: "Finalizado", tipo_slug: "casa", operacion_slug: "venta",
    estado_slug: "nuevo-leon", ciudad_slug: "monterrey", colonia_slug: "cumbres",
  },
  "2x2": {
    _id: "2x2", Estatus: "Borrador", tipo_slug: "casa", operacion_slug: "venta",
    estado_slug: "nuevo-leon", ciudad_slug: "monterrey", colonia_slug: "cumbres",
    Slug_text: "casa-venta-cumbres-monterrey-2x2",
  },
};
globalThis.fetch = async (input) => {
  const u = new URL(typeof input === "string" ? input : input.url);
  const json = (o, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
  if (u.pathname.startsWith("/api/1.1/obj/propiedades/")) {
    const id = decodeURIComponent(u.pathname.split("/").pop());
    return PROPS[id] ? json({ response: PROPS[id] }) : json({}, 404);
  }
  if (u.pathname === "/api/1.1/obj/ruta") {
    const c = JSON.parse(u.searchParams.get("constraints"));
    const slug = c.find((x) => x.key === "slug")?.value;
    const conTotal = c.some((x) => x.key === "total_propiedades");
    if (!slug) return json({ response: { results: [], remaining: 0 } }); // índice
    const hay = RUTAS_CON_PROPS.has(slug) || (!conTotal && RUTAS_VACIAS.has(slug));
    return json({ response: { results: hay ? [{ slug }] : [], remaining: 0 } });
  }
  // Página de Bubble (no HTML para que el test no necesite HTMLRewriter)
  return new Response("ficha", { status: 200, headers: { "Content-Type": "text/plain" } });
};
const env = { BUBBLE_BASE_URL: "https://app.dotcasa.com.mx" };
const get = (ruta) =>
  AppRouter.route(new Request("https://dotcasa.com.mx" + ruta, { headers: { Accept: "text/html" } }), env);

test("ficha borrada: 301 al listado más cercano (de la URL), sin query", async () => {
  const res = await get("/casa/venta/nuevo-leon/monterrey/cumbres/casa-venta-cumbres-9x9?utm=x");
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("Location"), "https://dotcasa.com.mx/casa/venta/nuevo-leon/monterrey");
});

test("ficha Finalizado: 301 a su listado", async () => {
  const res = await get("/casa/venta/nuevo-leon/monterrey/cumbres/casa-venta-cumbres-1x1");
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("Location"), "https://dotcasa.com.mx/casa/venta/nuevo-leon/monterrey");
});

test("ficha en borrador: se ve pero noindex", async () => {
  const res = await get("/casa/venta/nuevo-leon/monterrey/cumbres/casa-venta-cumbres-monterrey-2x2");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("X-Robots-Tag") ?? "", /noindex/);
});

test("/propiedad y /detalle_propiedad viejos: a la URL nueva o al listado", async () => {
  let res = await get("/propiedad/casa-venta-cumbres-monterrey-2x2");
  assert.equal(res.status, 301);
  assert.equal(
    res.headers.get("Location"),
    "https://dotcasa.com.mx/casa/venta/nuevo-leon/monterrey/cumbres/casa-venta-cumbres-monterrey-2x2",
  );
  res = await get("/detalle_propiedad/casa-venta-cumbres-1x1");
  assert.equal(res.headers.get("Location"), "https://dotcasa.com.mx/casa/venta/nuevo-leon/monterrey");
  // borrada: con el slug solo se sabe tipo y operación
  res = await get("/detalle_propiedad/casa-venta-algo-9x9");
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("Location"), "https://dotcasa.com.mx/casa/venta");
});

test("colonia sin inventario: 302 al listado de arriba; URL inventada: 404", async () => {
  let res = await get("/casa/venta/nuevo-leon/monterrey/cumbres");
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), "https://dotcasa.com.mx/casa/venta/nuevo-leon/monterrey");
  res = await get("/casa/venta/nuevo-leon/monterrey/colonia-que-no-existe");
  assert.equal(res.status, 404);
});

test("cada formato de listado vacío sube al de arriba correcto", () => {
  const casos = {
    "/casa/venta/3-recamaras": "/casa/venta",
    "/casa/venta/nuevo-leon/3-recamaras": "/casa/venta/nuevo-leon",
    "/casa/venta/nuevo-leon/monterrey/3-recamaras": "/casa/venta/nuevo-leon/monterrey",
    "/casa/venta/nuevo-leon/monterrey/cumbres/3-recamaras": "/casa/venta/nuevo-leon/monterrey/cumbres",
    "/casa/venta/hasta-3-millones": "/casa/venta",
    "/casa/renta/nuevo-leon/monterrey/hasta-15-mil": "/casa/renta/nuevo-leon/monterrey",
    "/quinta/venta/nuevo-leon/desde-5-millones": "/quinta/venta/nuevo-leon",
    "/casa/venta/cp/64000": "/casa/venta",
    "/casa/nuevo-leon/monterrey/cumbres": "/casa/nuevo-leon/monterrey",
    "/venta/nuevo-leon/monterrey/cumbres": "/venta/nuevo-leon/monterrey",
    "/nuevo-leon/monterrey/cumbres": "/nuevo-leon/monterrey",
    "/casa/venta/nuevo-leon": "/casa/venta",
    "/casa/venta": "/casa",
  };
  for (const [desde, arriba] of Object.entries(casos))
    assert.equal(listadosDeArriba(desde.split("/").filter(Boolean))[0]?.ruta, arriba, desde);
  // /cp/64000 y /nuevo-leon no tienen listado arriba: van a /propiedades
  assert.deepEqual(listadosDeArriba(["cp", "64000"]), []);
  assert.deepEqual(listadosDeArriba(["nuevo-leon"]), []);
});
