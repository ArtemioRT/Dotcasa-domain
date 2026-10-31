import test from "node:test";
import assert from "node:assert/strict";
import { ubicacionDeTexto, candidatosListado } from "../src/services/FichaBaja.js";
import { Utils } from "../src/services/utils/utils.js";

const R = (slug, campos, total = 10) => [slug, { slug, total_propiedades: total, ...campos }];
const NL = "nuevo-leon";
const indice = new Map([
  R("nuevo-leon-san-nicolas-de-los-garza", { estado: NL, ciudad: "san-nicolas-de-los-garza" }, 36),
  R("nuevo-leon-san-nicolas-de-los-garza-residencial-anahuac-sector-1", { estado: NL, ciudad: "san-nicolas-de-los-garza", colonia: "residencial-anahuac-sector-1" }, 1),
  R("nuevo-leon-san-nicolas-de-los-garza-anahuac", { estado: NL, ciudad: "san-nicolas-de-los-garza", colonia: "anahuac" }, 2),
  R("nuevo-leon-general-escobedo", { estado: NL, ciudad: "general-escobedo" }, 21),
  R("nuevo-leon-monterrey", { estado: NL, ciudad: "monterrey" }, 633),
  R("nuevo-leon-monterrey-cumbres", { estado: NL, ciudad: "monterrey", colonia: "cumbres" }, 20),
  R("casa-venta-nuevo-leon-monterrey", { tipo: "casa", operacion: "venta", estado: NL, ciudad: "monterrey" }, 180),
]);

test("Predio Aldape (nombre viejo de la colonia) -> Residencial Anáhuac Sector 1", () => {
  assert.deepEqual(
    ubicacionDeTexto("departamento-venta-predio-aldape-san-nicolas-de-los-garza-1791828024486x135810743194983980", indice),
    { tipo: "departamento", op: "venta", estado: NL, ciudad: "san-nicolas-de-los-garza", colonia: "residencial-anahuac-sector-1" },
  );
  // y la URL /…/san-nicolas-de-los-garza/predio-aldape pasa a la oficial
  assert.deepEqual(
    Utils.rutaOficial(["departamento", "venta", NL, "san-nicolas-de-los-garza", "predio-aldape"]),
    ["departamento", "venta", NL, "san-nicolas-de-los-garza", "residencial-anahuac-sector-1"],
  );
});

test("colonia que ya no existe: se queda con la ciudad (no /propiedades)", () => {
  assert.deepEqual(
    ubicacionDeTexto("departamento-venta-joyas-de-anahuac-ciudad-general-escobedo", indice),
    { tipo: "departamento", op: "venta", estado: NL, ciudad: "general-escobedo", colonia: "" },
  );
});

test("la colonia+ciudad más larga gana (Anáhuac vs Residencial Anáhuac Sector 1)", () => {
  const u = ubicacionDeTexto("casa-venta-residencial-anahuac-sector-1-san-nicolas-de-los-garza-123x456", indice);
  assert.equal(u.colonia, "residencial-anahuac-sector-1");
  assert.equal(ubicacionDeTexto("casa-venta-anahuac-san-nicolas-de-los-garza", indice).colonia, "anahuac");
});

test("slug que no empieza con tipo también se ubica", () => {
  assert.deepEqual(
    ubicacionDeTexto("privanza-marsella-cumbres-monterrey", indice),
    { tipo: "", op: "", estado: NL, ciudad: "monterrey", colonia: "cumbres" },
  );
});

test("sin nada reconocible: vacío (el router responde 404)", () => {
  assert.deepEqual(ubicacionDeTexto("algo-raro", indice), { tipo: "", op: "", estado: "", ciudad: "", colonia: "" });
});

test("con la ubicación del slug hay candidatos de colonia antes que /propiedades", () => {
  const u = ubicacionDeTexto("departamento-venta-predio-aldape-san-nicolas-de-los-garza-1x2", indice);
  const c = candidatosListado(u).map((x) => x.ruta);
  assert.equal(c[0], "/departamento/venta/nuevo-leon/san-nicolas-de-los-garza/residencial-anahuac-sector-1");
  assert.ok(c.includes("/nuevo-leon/san-nicolas-de-los-garza"));
});
