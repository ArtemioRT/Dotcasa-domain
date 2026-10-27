import test from "node:test";
import assert from "node:assert/strict";
import { ListadoSeo } from "../src/services/ListadoSeo.js";

const datos = (ruta, props) =>
  ListadoSeo.datos(ruta, props, "https://dotcasa.com.mx/x");
const titulo = (ruta, props) => datos(ruta, props).titulo;

const colorines = {
  tipo: "casa",
  operacion: "venta",
  estado: "nuevo-leon",
  ciudad: "san-pedro-garza-garcia",
  colonia: "colorines",
};
const propColorines = {
  Estado: "Nuevo León",
  Ciudad: "San Pedro Garza García",
  Colonia: "Colorines",
};

test("colonia: conteo, ciudad corta y precio desde", () => {
  assert.equal(
    titulo(colorines, { total: 48, desde: 9_000_000, lista: [propColorines] }),
    "48 Casas en Venta en Colorines, San Pedro desde $9M | DotCasa",
  );
});

test("colonia: descripción con ciudad completa y WhatsApp", () => {
  assert.equal(
    datos(colorines, { total: 48, desde: 9_000_000, lista: [propColorines] })
      .metaDescripcion,
    "Encuentra 48 casas en venta en Colorines, San Pedro Garza García. Precios desde $9M. Fotos, ubicación y contacto directo por WhatsApp.",
  );
});

test("municipio: acentos y mayúsculas, sin estado si no cabe", () => {
  const t = titulo(
    { tipo: "casa", operacion: "venta", estado: "nuevo-leon", ciudad: "san-pedro-garza-garcia" },
    { total: 33, desde: 3_450_000, lista: [{ Estado: "Nuevo León", Ciudad: "San Pedro Garza García" }] },
  );
  assert.equal(t, "33 Casas en Venta en San Pedro Garza García desde $3.5M | DotCasa");
  assert.ok(t.length <= 65);
});

test("ciudad corta con estado cuando cabe", () => {
  assert.equal(
    titulo({ tipo: "casa", operacion: "venta", estado: "nuevo-leon", ciudad: "monterrey" }, { total: 400, desde: 1_200_000, lista: [] }),
    "400 Casas en Venta en Monterrey, Nuevo Leon desde $1.2M | DotCasa",
  );
});

test("renta: precio al mes", () => {
  assert.match(
    titulo({ tipo: "casa", operacion: "renta", estado: "nuevo-leon", ciudad: "apodaca" }, { total: 70, desde: 12_000, lista: [] }),
    /^70 Casas en Renta en Apodaca(, Nuevo Leon)? desde \$12,000\/mes \| DotCasa$/,
  );
});

test("mixta (venta y renta): usa el precio de venta guardado en la ruta", () => {
  const d = datos(
    { tipo: "casa", estado: "nuevo-leon", ciudad: "monterrey", precio_desde_venta: 2_900_000, precio_desde_renta: 15_000 },
    { total: 45, desde: 15_000, lista: [] },
  );
  assert.match(d.titulo, /desde \$2\.9M \| DotCasa$/);
  assert.match(d.metaDescripcion, /Precios desde \$2\.9M\./);
});

test("mixta solo con rentas: precio de renta al mes", () => {
  const d = datos(
    { tipo: "oficina", estado: "nuevo-leon", ciudad: "apodaca", precio_desde_renta: 9_500 },
    { total: 4, lista: [] },
  );
  assert.match(d.titulo, /desde \$9,500\/mes \| DotCasa$/);
});

test("sin lista del Worker (municipio-, fraccionamiento) usa el precio de la ruta", () => {
  const d = datos(
    { tipo: "casa", operacion: "venta", estado: "nuevo-leon", ciudad: "garcia", precio_desde_venta: 1_850_000, total_propiedades: 12 },
    null,
  );
  assert.match(d.titulo, /^12 Casas en Venta en Garcia.* desde \$1\.9M \| DotCasa$/);
});

test("renta larga: el precio se compacta antes de quitarlo", () => {
  const t = titulo(
    { tipo: "departamento", operacion: "renta", estado: "nuevo-leon", ciudad: "san-pedro-garza-garcia" },
    { total: 39, desde: 12_000, lista: [{ Estado: "Nuevo León", Ciudad: "San Pedro Garza García" }] },
  );
  assert.ok(t.length <= 65, t);
  assert.match(t, /desde \$12(,000|K)\/mes \| DotCasa$/);
});

test("singular con 1 resultado y miles con coma", () => {
  assert.match(
    titulo({ tipo: "casa", operacion: "venta", estado: "nuevo-leon", ciudad: "apodaca" }, { total: 1, lista: [] }),
    /^1 Casa en Venta en Apodaca/,
  );
  assert.match(
    titulo({ tipo: "casa", operacion: "venta", estado: "nuevo-leon" }, { total: 1253, lista: [] }),
    /^1,253 Casas en Venta en Nuevo Leon/,
  );
});

test("sin conteo cae al título de la ruta", () => {
  assert.equal(
    titulo({ tipo: "casa", operacion: "venta", estado: "nuevo-leon", ciudad: "monterrey", titulo_seo: "Casas en venta en Monterrey | DotCasa" }, { total: 0, lista: [] }),
    "Casas en venta en Monterrey | DotCasa",
  );
});

test("ruta con recámaras", () => {
  const d = datos(
    { tipo: "casa", operacion: "venta", estado: "nuevo-leon", ciudad: "monterrey", recamaras: 3, url_publica: "/casa/venta/nuevo-leon/monterrey/3-recamaras", slug: "casa-venta-nuevo-leon-monterrey-3-recamaras" },
    { total: 42, desde: 1_900_000, lista: [{ Estado: "Nuevo León", Ciudad: "Monterrey" }] },
  );
  // 66 caracteres con la marca: se queda el precio y se quita la marca
  assert.equal(d.titulo, "42 Casas en Venta con 3 Recámaras en Monterrey desde $1.9M");
  assert.match(d.metaDescripcion, /^Encuentra 42 casas en venta con 3 recámaras en Monterrey, Nuevo León\. Precios desde \$1\.9M\./);
  // sin breadcrumb_json: migas armadas con la URL
  assert.match(d.cabeza, /"name":"3 recámaras","item":"https:\/\/dotcasa\.com\.mx\/casa\/venta\/nuevo-leon\/monterrey\/3-recamaras"/);
  assert.match(d.cabeza, /"name":"Monterrey"/);
});

test("ruta de precio máximo: 'hasta' en el título y 'desde' en la descripción", () => {
  const d = datos(
    { tipo: "casa", operacion: "venta", estado: "nuevo-leon", ciudad: "monterrey", precio_max: 3_000_000, url_publica: "/casa/venta/nuevo-leon/monterrey/hasta-3-millones" },
    { total: 60, desde: 1_200_000, lista: [{ Estado: "Nuevo León", Ciudad: "Monterrey" }] },
  );
  assert.equal(d.titulo, "60 Casas en Venta hasta $3M en Monterrey, Nuevo León | DotCasa");
  assert.match(d.metaDescripcion, /casas en venta de hasta \$3M en Monterrey, Nuevo León\. Precios desde \$1\.2M\./);
});

test("tipo + colonia sin operación", () => {
  const d = datos(
    { tipo: "casa", estado: "nuevo-leon", ciudad: "san-pedro-garza-garcia", colonia: "del-valle", url_publica: "/casa/nuevo-leon/san-pedro-garza-garcia/del-valle", precio_desde_venta: 8_500_000 },
    { total: 9, lista: [{ Estado: "Nuevo León", Ciudad: "San Pedro Garza García", Colonia: "Del Valle" }] },
  );
  assert.match(d.titulo, /^9 Casas (en Venta y Renta )?en Del Valle(, San Pedro)? desde \$8\.5M/);
  assert.match(d.cabeza, /"name":"Del Valle","item":"https:\/\/dotcasa\.com\.mx\/casa\/nuevo-leon\/san-pedro-garza-garcia\/del-valle"/);
});

test("ruta de precio mínimo: 'desde' del filtro, sin repetir el precio más bajo", () => {
  const d = datos(
    { tipo: "casa", operacion: "venta", estado: "nuevo-leon", ciudad: "monterrey", precio_min: 10_000_000, url_publica: "/casa/venta/nuevo-leon/monterrey/desde-10-millones" },
    { total: 40, desde: 10_500_000, lista: [{ Estado: "Nuevo León", Ciudad: "Monterrey" }] },
  );
  assert.equal(d.titulo, "40 Casas en Venta desde $10M en Monterrey, Nuevo León | DotCasa");
  assert.doesNotMatch(d.metaDescripcion, /Precios desde/);
  assert.match(d.cabeza, /"name":"Desde \$10M"/);
});

test("con filtros extra en la URL el título va sin el total de la ruta", () => {
  const d = ListadoSeo.datos(
    { tipo: "quinta", operacion: "venta", url_publica: "/quinta/venta", total_propiedades: 20, titulo_seo: "quintas en venta en mexico | DotCasa" },
    { total: 20, desde: 1_500_000, lista: [] },
    "https://dotcasa.com.mx/quinta/venta",
    { sinConteo: true },
  );
  assert.doesNotMatch(d.titulo, /20/);
});
