import test from "node:test";
import assert from "node:assert/strict";
import { rutaCanonica } from "../src/services/RutaCanonica.js";

test("la raíz se queda como /", () => {
  assert.equal(rutaCanonica("/"), "/");
});

test("quita el / final", () => {
  assert.equal(rutaCanonica("/acerca_de_nosotros/"), "/acerca_de_nosotros");
  assert.equal(rutaCanonica("/casa/venta/nuevo-leon/"), "/casa/venta/nuevo-leon");
});

test("/index es la home", () => {
  assert.equal(rutaCanonica("/index"), "/");
  assert.equal(rutaCanonica("/Index/"), "/");
});

test("no toca rutas ya limpias ni las fichas", () => {
  const ficha = "/casa/venta/nuevo-leon/monterrey/centro/casa-en-venta-ABC123";
  assert.equal(rutaCanonica(ficha), ficha);
  assert.equal(rutaCanonica("/propiedades"), "/propiedades");
});

test("junta barras repetidas", () => {
  assert.equal(rutaCanonica("//propiedades//"), "/propiedades");
});
