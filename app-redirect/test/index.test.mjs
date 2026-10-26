import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const TOKEN = "secreto-de-prueba";
const HTML = { Accept: "text/html,application/xhtml+xml" };

// fetch(request) del Worker = "pasar al origen"; aquí se marca la respuesta
globalThis.fetch = async () => new Response("origen", { status: 200 });

const llamar = (ruta, { headers = HTML, method = "GET", env = { ORIGEN_TOKEN: TOKEN } } = {}) =>
  worker.fetch(
    new Request("https://app.dotcasa.com.mx" + ruta, { method, headers }),
    env,
  );

const es301 = async (res, destino) => {
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("Location"), destino);
};
const pasa = async (res) => {
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "origen");
};

test("detalle_propiedad va al mismo path en el dominio público", async () => {
  await es301(
    await llamar("/detalle_propiedad/casa-venta-contry-monterrey-123x456"),
    "https://dotcasa.com.mx/detalle_propiedad/casa-venta-contry-monterrey-123x456",
  );
});

test("home, listados y query se conservan", async () => {
  await es301(await llamar("/"), "https://dotcasa.com.mx/");
  await es301(
    await llamar("/casa/venta/nuevo-leon/monterrey?recamaras=3"),
    "https://dotcasa.com.mx/casa/venta/nuevo-leon/monterrey?recamaras=3",
  );
  await es301(await llamar("/buscador"), "https://dotcasa.com.mx/buscador");
});

test("HEAD también redirige", async () => {
  await es301(await llamar("/propiedades", { method: "HEAD" }), "https://dotcasa.com.mx/propiedades");
});

test("la llamada del Worker principal (con el secreto) pasa", async () => {
  await pasa(await llamar("/detalle_propiedad/x", { headers: { ...HTML, "X-Dotcasa-Origen": TOKEN } }));
});

test("un secreto equivocado no pasa", async () => {
  await es301(
    await llamar("/propiedades", { headers: { ...HTML, "X-Dotcasa-Origen": "otro" } }),
    "https://dotcasa.com.mx/propiedades",
  );
});

test("sin ORIGEN_TOKEN configurado no redirige nada (falla abierto)", async () => {
  await pasa(await llamar("/propiedades", { env: {} }));
});

test("lo que no es navegación pasa: POST, JSON, scripts", async () => {
  await pasa(await llamar("/propiedades", { method: "POST" }));
  await pasa(await llamar("/propiedades", { headers: { Accept: "application/json" } }));
  await pasa(await llamar("/propiedades", { headers: { Accept: "*/*" } }));
  await pasa(await llamar("/propiedades", { headers: {} }));
});

test("flujos que se quedan en app.", async () => {
  for (const ruta of [
    "/login?google=yes",
    "/reset_pw?token=1",
    "/invitacion/abc",
    "/desuscripcion",
    "/version-test/index",
    "/__dotcasa/puente?t=1",
    "/api/1.1/wf/google_enlace",
    "/package/run_js/x",
    "/robots.txt",
  ])
    await pasa(await llamar(ruta));
});

test("rutas parecidas a las exceptuadas sí redirigen", async () => {
  await es301(await llamar("/login-ayuda"), "https://dotcasa.com.mx/login-ayuda");
  await es301(await llamar("/apis"), "https://dotcasa.com.mx/apis");
});
