import test from "node:test";
import assert from "node:assert/strict";
import { ReporteAds, rango, armarGoogle, armarMeta } from "../src/services/ReporteAds.js";

const req = (ruta, headers = {}) =>
  new Request("https://dotcasa.com.mx" + ruta, { headers });
const ADMIN = { "X-DotCasa-Admin": "secreto" };

test("sin el header de admin responde 401 y no llama a nadie", async () => {
  globalThis.fetch = async () => assert.fail("no debe llamar afuera");
  const res = await ReporteAds.handle(req("/__dotcasa/reportes/google"), { ADMIN_REPORTES_TOKEN: "secreto" });
  assert.equal(res.status, 401);
});

test("rutas ajenas no las toma", async () => {
  assert.equal(await ReporteAds.handle(req("/otra"), {}), null);
});

test("sin secretos de Google avisa qué falta (200 para que Bubble lo muestre)", async () => {
  const res = await ReporteAds.handle(req("/__dotcasa/reportes/google", ADMIN), { ADMIN_REPORTES_TOKEN: "secreto" });
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.ok, false);
  assert.equal(j.error, "sin_configurar");
  assert.ok(j.faltan.includes("GOOGLE_ADS_DEVELOPER_TOKEN"));
});

test("rango por defecto: 30 días terminando ayer; respeta fechas válidas", () => {
  const hoy = new Date("2026-10-28T12:00:00Z");
  assert.deepEqual(rango(new URL("https://x/"), hoy), { desde: "2026-09-28", hasta: "2026-10-27" });
  assert.deepEqual(
    rango(new URL("https://x/?desde=2026-10-10&hasta=2026-10-01"), hoy),
    { desde: "2026-10-01", hasta: "2026-10-10" },
  );
});

test("Google: suma conversiones por acción y las pega a cada palabra clave", () => {
  const r = armarGoogle(
    [
      { segments: { conversionActionName: "Click WhatsApp" }, metrics: { conversions: 3, allConversions: 4 } },
      { segments: { conversionActionName: "Click WhatsApp" }, metrics: { conversions: 1, allConversions: 1 } },
      { segments: { conversionActionName: "Click Email" }, metrics: { conversions: 0, allConversions: 2 } },
    ],
    [
      {
        campaign: { name: "Monterrey" }, adGroup: { name: "Casas" },
        adGroupCriterion: { resourceName: "k1", keyword: { text: "casas en venta monterrey", matchType: "PHRASE" } },
        metrics: { impressions: "100", clicks: "10", costMicros: "45670000", conversions: 2 },
      },
    ],
    [
      { adGroupCriterion: { resourceName: "k1" }, segments: { conversionActionName: "Click WhatsApp" }, metrics: { allConversions: 2 } },
      { adGroupCriterion: { resourceName: "k1" }, segments: { conversionActionName: "Click Email" }, metrics: { allConversions: 1 } },
    ],
  );
  assert.deepEqual(r.conversiones[0], { accion: "Click WhatsApp", conversiones: 4, todas: 5 });
  assert.equal(r.palabras[0].costo, 45.67);
  assert.deepEqual(r.palabras[0].por_accion, { "Click WhatsApp": 2, "Click Email": 1 });
});

test("Meta: campaña > conjunto > anuncio con acciones de contacto", () => {
  const [a] = armarMeta([
    {
      campaign_name: "Leads MTY", adset_name: "Intereses casas", ad_name: "Video 1",
      impressions: "1000", reach: "800", clicks: "40", spend: "120.5",
      actions: [
        { action_type: "link_click", value: "30" },
        { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "5" },
      ],
    },
  ]);
  assert.equal(a.conjunto, "Intereses casas");
  assert.equal(a.clics_enlace, 30);
  assert.equal(a.conversaciones, 5);
  assert.equal(a.gasto, 120.5);
});

test("Google completo con fetch simulado y texto seguro para <script>", async () => {
  const llamadas = [];
  globalThis.fetch = async (url, init) => {
    llamadas.push(String(url));
    if (String(url).includes("oauth2")) return Response.json({ access_token: "tok" });
    const q = JSON.parse(init.body).query;
    if (q.includes("FROM campaign"))
      return Response.json({ results: [{ segments: { conversionActionName: "Click Email" }, metrics: { conversions: 1, allConversions: 1 } }] });
    if (q.includes("ad_group_criterion.resource_name")) return Response.json({ results: [] });
    return Response.json({ results: [{ campaign: { name: "</script>x" }, adGroup: { name: "g" }, adGroupCriterion: { resourceName: "k", keyword: { text: "t", matchType: "EXACT" } }, metrics: {} }] });
  };
  const env = {
    ADMIN_REPORTES_TOKEN: "secreto",
    GOOGLE_ADS_DEVELOPER_TOKEN: "d", GOOGLE_ADS_CLIENT_ID: "c", GOOGLE_ADS_CLIENT_SECRET: "s",
    GOOGLE_ADS_REFRESH_TOKEN: "r", GOOGLE_ADS_CUSTOMER_ID: "123-456-7890",
  };
  const res = await ReporteAds.handle(req("/__dotcasa/reportes/google?desde=2026-10-01&hasta=2026-10-27", ADMIN), env);
  const texto = await res.text();
  assert.ok(!texto.includes("</script>"));
  const j = JSON.parse(texto);
  assert.equal(j.ok, true);
  assert.equal(j.palabras[0].campana, "</script>x");
  assert.ok(llamadas.some((u) => u.includes("/customers/1234567890/googleAds:search")));
});
