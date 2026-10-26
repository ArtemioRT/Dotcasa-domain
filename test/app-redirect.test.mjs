import test from "node:test";
import assert from "node:assert/strict";
import { AppRedirect } from "../src/services/AppRedirect.js";
import { AppRouter } from "../src/routes/AppRouter.route.js";

const HTML = { Accept: "text/html,application/xhtml+xml" };
const ORIGEN = { [AppRedirect.HEADER_ORIGEN]: AppRedirect.VALOR_ORIGEN };

// fetch(request) = "pasar al origen"; aquí solo se marca la respuesta
globalThis.fetch = async () => new Response("origen", { status: 200 });

const req = (host, ruta, { headers = HTML, method = "GET" } = {}) =>
  new Request(`https://${host}${ruta}`, { method, headers });
const app = (ruta, opts) => AppRedirect.handle(req("app.dotcasa.com.mx", ruta, opts));

const es301 = (res, destino) => {
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("Location"), destino);
};
const pasa = async (res) => {
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "origen");
};

test("detalle_propiedad va al mismo path en el dominio público", () => {
  es301(
    app("/detalle_propiedad/casa-venta-contry-monterrey-123x456"),
    "https://dotcasa.com.mx/detalle_propiedad/casa-venta-contry-monterrey-123x456",
  );
});

test("home, listados y query se conservan; HEAD también", () => {
  es301(app("/"), "https://dotcasa.com.mx/");
  es301(
    app("/casa/venta/nuevo-leon/monterrey?recamaras=3"),
    "https://dotcasa.com.mx/casa/venta/nuevo-leon/monterrey?recamaras=3",
  );
  es301(app("/propiedades", { method: "HEAD", headers: HTML }), "https://dotcasa.com.mx/propiedades");
});

test("otros hosts no los toca (sigue el router normal)", () => {
  assert.equal(AppRedirect.handle(req("dotcasa.com.mx", "/propiedades")), null);
  assert.equal(AppRedirect.handle(req("www.dotcasa.com.mx", "/")), null);
});

test("la llamada del propio Worker a Bubble (con el header) pasa", async () => {
  await pasa(await app("/detalle_propiedad/x", { headers: { ...HTML, ...ORIGEN } }));
});

test("un valor distinto del header no pasa", () => {
  es301(
    app("/propiedades", { headers: { ...HTML, [AppRedirect.HEADER_ORIGEN]: "otro" } }),
    "https://dotcasa.com.mx/propiedades",
  );
});

test("lo que no es navegación pasa: POST, JSON, scripts, sin Accept", async () => {
  await pasa(await app("/propiedades", { method: "POST" }));
  await pasa(await app("/propiedades", { headers: { Accept: "application/json" } }));
  await pasa(await app("/propiedades", { headers: { Accept: "*/*" } }));
  await pasa(await app("/propiedades", { headers: {} }));
});

test("flujos que se quedan en app.", async () => {
  for (const ruta of [
    "/login?google=yes",
    "/reset_pw?token=1",
    "/enviar_reseteo_contrasena",
    "/invitacion/abc",
    "/desuscripcion",
    "/version-test/index",
    "/__dotcasa/puente?t=1",
    "/api/1.1/wf/google_enlace",
    "/package/run_js/x",
    "/robots.txt",
  ])
    await pasa(await app(ruta));
});

test("rutas parecidas a las exceptuadas sí redirigen", () => {
  es301(app("/login-ayuda"), "https://dotcasa.com.mx/login-ayuda");
  es301(app("/apis"), "https://dotcasa.com.mx/apis");
});

test("el router atiende app. antes que nada (301 y paso)", async () => {
  es301(
    await AppRouter.route(req("app.dotcasa.com.mx", "/detalle_propiedad/x"), {}),
    "https://dotcasa.com.mx/detalle_propiedad/x",
  );
  await pasa(await AppRouter.route(req("app.dotcasa.com.mx", "/login"), {}));
});

test("el router manda a Bubble el header de origen", async () => {
  let visto = null;
  globalThis.fetch = async (url, init) => {
    visto = { url: String(url), header: new Headers(init?.headers).get(AppRedirect.HEADER_ORIGEN) };
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  await AppRouter.route(req("dotcasa.com.mx", "/propiedades"), {
    BUBBLE_BASE_URL: "https://app.dotcasa.com.mx",
  });
  assert.match(visto.url, /^https:\/\/app\.dotcasa\.com\.mx\/buscador/);
  assert.equal(visto.header, AppRedirect.VALOR_ORIGEN);
});
