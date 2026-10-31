import test from "node:test";
import assert from "node:assert/strict";
import { destinoPorQuery, partesDeRuta } from "../src/services/QueryRuta.js";
import { Utils } from "../src/services/utils/utils.js";

// Índice como el de BubbleManager.indiceRutas: slug -> ruta (solo con propiedades)
const R = (slug, campos, total = 10) => [slug, { slug, total_propiedades: total, ...campos }];
const NL = "nuevo-leon";
const indice = new Map([
  R("nuevo-leon", { estado: NL }, 1253),
  R("nuevo-leon-monterrey", { estado: NL, ciudad: "monterrey" }, 633),
  R("nuevo-leon-general-escobedo", { estado: NL, ciudad: "general-escobedo" }, 21),
  R("nuevo-leon-san-nicolas-de-los-garza", { estado: NL, ciudad: "san-nicolas-de-los-garza" }, 36),
  R("nuevo-leon-san-pedro-garza-garcia", { estado: NL, ciudad: "san-pedro-garza-garcia" }, 157),
  R("nuevo-leon-santiago", { estado: NL, ciudad: "santiago" }, 116),
  R("nuevo-leon-santa-catarina", { estado: NL, ciudad: "santa-catarina" }, 64),
  R("nuevo-leon-san-pedro-garza-garcia-del-valle", { estado: NL, ciudad: "san-pedro-garza-garcia", colonia: "del-valle" }, 40),
  R("casa-renta-nuevo-leon-monterrey", { tipo: "casa", operacion: "renta", estado: NL, ciudad: "monterrey" }, 23),
  R("casa-venta-nuevo-leon-monterrey", { tipo: "casa", operacion: "venta", estado: NL, ciudad: "monterrey" }, 180),
  R("departamento-renta-nuevo-leon-monterrey", { tipo: "departamento", operacion: "renta", estado: NL, ciudad: "monterrey" }, 143),
  R("renta-nuevo-leon-santiago", { operacion: "renta", estado: NL, ciudad: "santiago" }, 5),
  R("casa-venta-nuevo-leon", { tipo: "casa", operacion: "venta", estado: NL }, 368),
  R("casa", { tipo: "casa" }, 900),
]);
const ir = (u) => {
  const x = new URL("https://dotcasa.com.mx" + u);
  const norm = x.pathname.split("/").filter(Boolean).map(Utils.normalizar);
  return destinoPorQuery(norm, x.searchParams, indice);
};

test("anuncio de rentas: /nuevo-leon?tipo=casa&operacion=renta&ciudad=Monterrey", () => {
  assert.equal(ir("/nuevo-leon?tipo=casa&operacion=renta&ciudad=Monterrey"), "/casa/renta/nuevo-leon/monterrey");
});

test("conserva gclid, utm y filtros de precio", () => {
  assert.equal(
    ir("/nuevo-leon?tipo=casa&operacion=venta&ciudad=Monterrey&precio_max=5000000&gclid=abc&utm_source=google"),
    "/casa/venta/nuevo-leon/monterrey?precio_max=5000000&gclid=abc&utm_source=google",
  );
});

test("tipo en plural y con acentos/mayúsculas", () => {
  assert.equal(ir("/nuevo-leon?tipo=Departamentos&operacion=Renta&ciudad=Monterrey"), "/departamento/renta/nuevo-leon/monterrey");
});

test("ciudad corta: Escobedo, San Nicolás, San Pedro", () => {
  assert.equal(ir("/propiedades?ciudad=Escobedo"), "/nuevo-leon/general-escobedo");
  assert.equal(ir("/nuevo-leon?ciudad=San%20Nicol%C3%A1s"), "/nuevo-leon/san-nicolas-de-los-garza");
  assert.equal(ir("/buscador?ciudad=San%20Pedro"), "/nuevo-leon/san-pedro-garza-garcia");
  assert.equal(ir("/propiedades?ciudad=Santiago"), "/nuevo-leon/santiago");
  assert.equal(ir("/propiedades?ciudad=Santa%20Catarina&estado=Nuevo%20Le%C3%B3n"), "/nuevo-leon/santa-catarina");
});

test("ruta con nombre corto (sin query) -> oficial; no sube a una más general", () => {
  assert.equal(ir("/nuevo-leon/escobedo"), "/nuevo-leon/general-escobedo");
  assert.equal(ir("/nuevo-leon/no-existe"), null);
  assert.equal(ir("/nuevo-leon/monterrey"), null);
});

test("colonia sin ciudad: Del Valle -> su página en San Pedro", () => {
  assert.equal(ir("/nuevo-leon?colonia=Del%20Valle"), "/nuevo-leon/san-pedro-garza-garcia/del-valle");
});

test("si la ruta exacta no existe sube a la más cercana y lo demás queda en la query", () => {
  assert.equal(ir("/nuevo-leon?tipo=casa&operacion=renta&ciudad=Santiago"), "/renta/nuevo-leon/santiago?tipo=casa");
  // y esa URL ya no vuelve a redirigir (sin ciclos)
  assert.equal(ir("/renta/nuevo-leon/santiago?tipo=casa"), null);
});

test("varios valores se quedan en la query; contradicciones no se tocan", () => {
  assert.equal(ir("/nuevo-leon/monterrey?colonia=Cumbres,Contry"), null);
  assert.equal(ir("/nuevo-leon?estado=jalisco"), null);
  assert.equal(ir("/nuevo-leon/monterrey?precio_max=3000000"), null);
});

test("ya limpia: no redirige", () => {
  assert.equal(ir("/casa/renta/nuevo-leon/monterrey?tipo=casa"), "/casa/renta/nuevo-leon/monterrey");
  assert.equal(ir("/casa/venta/nuevo-leon/monterrey"), null);
});

test("partes de ruta: no toca fichas, cp ni segmentos de filtro", () => {
  assert.equal(partesDeRuta(["casa", "venta", "cp", "64000"]), null);
  assert.equal(partesDeRuta(["casa", "venta", "nuevo-leon", "monterrey", "centro", "3-recamaras"]), null);
  assert.equal(partesDeRuta(["acerca-de-nosotros"]), null);
  assert.deepEqual(partesDeRuta(["renta", "nuevo-leon"]), { tipo: "", operacion: "renta", estado: "nuevo-leon", ciudad: "", colonia: "" });
});
