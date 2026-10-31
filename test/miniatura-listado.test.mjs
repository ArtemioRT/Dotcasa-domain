import test from "node:test";
import assert from "node:assert/strict";
import { ListadoSeo, fotoPrincipal } from "../src/services/ListadoSeo.js";

const ruta = {
  tipo: "casa",
  operacion: "venta",
  estado: "nuevo-leon",
  ciudad: "monterrey",
  colonia: "contry",
};
const prop = (id, fotos) => ({
  _id: id,
  tipo_slug: "casa",
  operacion_slug: "venta",
  estado_slug: "nuevo-leon",
  ciudad_slug: "monterrey",
  colonia_slug: "contry",
  Tipo_de_inmueble: "Casa",
  Tipo_de_operacion: "Venta",
  Ciudad: "Monterrey",
  Colonia: "Contry",
  Estado: "Nuevo León",
  URL_Fotografia_lugar: fotos,
});

test("foto principal: primera URL, con https si viene sin protocolo", () => {
  assert.equal(fotoPrincipal({ URL_Fotografia_lugar: ["//cdn.x/a.webp", "https://b"] }), "https://cdn.x/a.webp");
  assert.equal(fotoPrincipal({ URL_Fotografia_lugar: [] }), null);
  assert.equal(fotoPrincipal({}), null);
});

test("listado: miniatura de la primera propiedad con foto, en schema", () => {
  const d = ListadoSeo.datos(
    ruta,
    {
      total: 2,
      lista: [prop("1x1", []), prop("2x2", ["https://storage.googleapis.com/f/a.webp"])],
    },
    "https://dotcasa.com.mx/casa/venta/nuevo-leon/monterrey/contry",
  );
  assert.equal(d.imagen, "https://storage.googleapis.com/f/a.webp");
  assert.match(d.cabeza, /"image":"https:\/\/storage.googleapis.com\/f\/a.webp"/);
  assert.match(d.cabeza, /"primaryImageOfPage"/);
});

test("listado sin fotos: sin miniatura", () => {
  const d = ListadoSeo.datos(ruta, { total: 1, lista: [prop("1x1", [])] }, "https://x");
  assert.equal(d.imagen, null);
  assert.doesNotMatch(d.cabeza, /primaryImageOfPage/);
});

test("ruta con thumbnail de Bubble: tiene prioridad y va en la miga actual", () => {
  const d = ListadoSeo.datos(
    {
      ...ruta,
      thumbnail: "https://storage.googleapis.com/f/ruta.webp",
      breadcrumb_json: JSON.stringify({
        itemListElement: [
          { name: "Casas", item: "https://dotcasa.com.mx/casa" },
          { name: "Contry", item: "https://dotcasa.com.mx/casa/venta/nuevo-leon/monterrey/contry", image: "https://storage.googleapis.com/f/ruta.webp" },
        ],
      }),
    },
    { total: 1, lista: [prop("2x2", ["https://storage.googleapis.com/f/a.webp"])] },
    "https://x",
  );
  assert.equal(d.imagen, "https://storage.googleapis.com/f/ruta.webp");
  const migas = JSON.parse(d.cabeza.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.equal(migas["@type"], "BreadcrumbList");
  assert.equal(migas.itemListElement[0].image, undefined);
  assert.equal(migas.itemListElement[1].image, "https://storage.googleapis.com/f/ruta.webp");
});

test("migas sin imagen en Bubble: la última recibe la miniatura del listado", () => {
  const d = ListadoSeo.datos(
    { ...ruta, url_publica: "/casa/venta/nuevo-leon/monterrey/contry" },
    { total: 1, lista: [prop("2x2", ["https://storage.googleapis.com/f/a.webp"])] },
    "https://x",
  );
  const migas = JSON.parse(d.cabeza.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.equal(migas.itemListElement.at(-1).image, "https://storage.googleapis.com/f/a.webp");
});
