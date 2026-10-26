import test from "node:test";
import assert from "node:assert/strict";
import {
  tituloVacio,
  tituloDeRespaldo,
  tituloFinal,
  TITULO_GENERAL,
} from "../src/services/TituloSeguro.js";

test("detecta títulos vacíos", () => {
  for (const t of ["", "  ", "- DotCasa", " - DotCasa", "| DotCasa", "DotCasa", " en  en   · $ | DotCasa", "undefined | DotCasa", null, undefined])
    assert.equal(tituloVacio(t), true, JSON.stringify(t));
});

test("no marca como vacíos los títulos con contenido", () => {
  for (const t of ["Casa en Venta en Monterrey | DotCasa", "Departamento en Renta en Guadalupe · $18,000 | DotCasa", "Buscar Propiedades en Venta,Renta y Preventa | DotCasa", "Terreno | DotCasa"])
    assert.equal(tituloVacio(t), false, t);
});

test("respaldo de una ficha usa tipo, operación y ciudad", () => {
  assert.equal(
    tituloDeRespaldo("/casa/venta/nuevo-leon/monterrey/contry/casa-venta-contry-monterrey-1x2"),
    "Casa en Venta en Monterrey | DotCasa",
  );
  assert.equal(
    tituloDeRespaldo("/departamento/renta/nuevo-leon/san-pedro-garza-garcia/del-valle/x-1"),
    "Departamento en Renta en San Pedro Garza Garcia | DotCasa",
  );
});

test("respaldo de un listado usa el lugar que haya", () => {
  assert.equal(tituloDeRespaldo("/casa/venta/nuevo-leon/monterrey"), "Casa en Venta en Monterrey | DotCasa");
  assert.equal(tituloDeRespaldo("/casa/venta/nuevo-leon"), "Casa en Venta en Nuevo Leon | DotCasa");
  assert.equal(tituloDeRespaldo("/casa/venta"), "Casa en Venta en México | DotCasa");
});

test("fuera de fichas y listados usa el título general", () => {
  assert.equal(tituloDeRespaldo("/login"), TITULO_GENERAL);
  assert.equal(tituloDeRespaldo("/"), TITULO_GENERAL);
});

test("tituloFinal conserva el de Bubble si tiene contenido", () => {
  assert.equal(tituloFinal("Casa en Venta en Contry | DotCasa", "/x"), "Casa en Venta en Contry | DotCasa");
  assert.equal(tituloFinal("- DotCasa", "/casa/venta/nuevo-leon/monterrey/c/s-1"), "Casa en Venta en Monterrey | DotCasa");
});
