import test from "node:test";
import assert from "node:assert/strict";
import { ListadoSeo } from "../src/services/ListadoSeo.js";

const titulo = (ruta, props) =>
  ListadoSeo.datos(ruta, props, "https://dotcasa.com.mx/x").titulo;

test("ciudad: conteo + tipo + operación + ciudad, estado", () => {
  assert.equal(
    titulo({ tipo: "casa", operacion: "venta", estado: "nuevo-leon", ciudad: "monterrey" }, { total: 400, lista: [] }),
    "400 casas en venta en monterrey nuevo leon",
  );
});

test("nombres de la propiedad en minúsculas y sin acentos", () => {
  const t = titulo(
    { tipo: "departamento", operacion: "renta", estado: "nuevo-leon", ciudad: "san-pedro-garza-garcia" },
    { total: 70, lista: [{ Estado: "Nuevo León", Ciudad: "San Pedro Garza García" }] },
  );
  assert.equal(t, "70 departamentos en renta en san pedro garza garcia nuevo leon");
});

test("singular con 1 resultado y miles con coma", () => {
  assert.match(
    titulo({ tipo: "casa", operacion: "venta", estado: "nuevo-leon", ciudad: "apodaca" }, { total: 1, lista: [] }),
    /^1 casa en venta en apodaca/,
  );
  assert.match(
    titulo({ tipo: "casa", operacion: "venta", estado: "nuevo-leon" }, { total: 1253, lista: [] }),
    /^1,253 casas en venta en nuevo leon/,
  );
});

test("sin conteo cae al título de la ruta", () => {
  assert.equal(
    titulo({ tipo: "casa", operacion: "venta", estado: "nuevo-leon", ciudad: "monterrey", titulo_seo: "Casas en venta en Monterrey | DotCasa" }, { total: 0, lista: [] }),
    "Casas en venta en Monterrey | DotCasa",
  );
});
