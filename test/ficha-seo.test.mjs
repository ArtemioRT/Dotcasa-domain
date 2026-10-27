import test from "node:test";
import assert from "node:assert/strict";
import { FichaSeo } from "../src/services/FichaSeo.js";

const ficha = (prop, norm) =>
  FichaSeo.datos(prop, norm, "https://dotcasa.com.mx/x");

const contry = ficha(
  {
    Estado: "Nuevo León",
    Ciudad: "Monterrey",
    Colonia: "Contry",
    Precio: 4_200_000,
    N_Habitaciones: 3,
    N_Banos: 2.5,
    "M^2_Construccion": 180,
  },
  ["casa", "venta", "nuevo-leon", "monterrey", "contry"],
);

test("título de ficha con recámaras y precio corto", () => {
  assert.equal(contry.titulo, "Casa en Venta en Contry, Monterrey · 3 rec · $4.2M | DotCasa");
});

test("descripción de ficha", () => {
  assert.equal(
    contry.metaDescripcion,
    "Casa de 3 recámaras y 2.5 baños en Contry, Monterrey. 180 m² de construcción. $4,200,000. Contacta directo por WhatsApp.",
  );
  assert.ok(contry.metaDescripcion.length <= 155);
});

test("renta: precio al mes", () => {
  const d = ficha(
    { Ciudad: "Monterrey", Colonia: "El Vergel", Precio: 18_000, N_Habitaciones: 3 },
    ["casa", "renta", "nuevo-leon", "monterrey", "el-vergel"],
  );
  // Con "3 rec" serían 68 caracteres: se quita la recámara y queda el precio
  assert.equal(d.titulo, "Casa en Renta en El Vergel, Monterrey · $18,000/mes | DotCasa");
  assert.match(d.metaDescripcion, /\$18,000 al mes\./);
});

test("nombres largos se acortan sin pasar de 65", () => {
  const d = ficha(
    { Ciudad: "San Pedro Garza García", Colonia: "Valle de San Angel Sector Francés", Precio: 12_500_000, N_Habitaciones: 4 },
    ["casa", "venta", "nuevo-leon", "san-pedro-garza-garcia", "valle-de-san-angel-sector-frances"],
  );
  assert.ok(d.titulo.length <= 65, d.titulo);
});

test("terreno sin recámaras", () => {
  const d = ficha(
    { Ciudad: "Santiago", Colonia: "Los Cavazos", Precio: 850_000, "M^2_Terreno": 1000 },
    ["terreno", "venta", "nuevo-leon", "santiago", "los-cavazos"],
  );
  assert.equal(d.titulo, "Terreno en Venta en Los Cavazos, Santiago · $850K | DotCasa");
  assert.equal(
    d.metaDescripcion,
    "Terreno en venta en Los Cavazos, Santiago. 1,000 m² de terreno. $850,000. Contacta directo por WhatsApp.",
  );
});
