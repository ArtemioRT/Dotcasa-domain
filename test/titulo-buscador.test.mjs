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

test("sin operación no pone 'desde' (mezclaría rentas y ventas)", () => {
  const d = datos(
    { tipo: "casa", estado: "nuevo-leon", ciudad: "monterrey" },
    { total: 45, desde: 15_000, lista: [] },
  );
  assert.doesNotMatch(d.titulo, /desde/);
  assert.doesNotMatch(d.metaDescripcion, /desde/);
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
