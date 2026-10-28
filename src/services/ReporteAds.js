// Reporte de anuncios para el panel de admin (admin_master de Bubble).
//
//   GET /__dotcasa/reportes/google?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
//   GET /__dotcasa/reportes/meta?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
//
// Solo responde con el header X-DotCasa-Admin igual al secreto
// ADMIN_REPORTES_TOKEN. Bubble lo llama desde su servidor (API Connector, header
// privado), así que el secreto nunca llega al navegador.
//
// Google Ads (API REST): conversiones por acción (Click WhatsApp, Click Email...)
// y palabras clave por campaña y grupo de anuncios, con sus conversiones.
// Secretos: GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID,
// GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CUSTOMER_ID y,
// si la cuenta está bajo un MCC, GOOGLE_ADS_LOGIN_CUSTOMER_ID.
//
// Meta (Marketing API): campaña > conjunto > anuncio con alcance, clics, gasto y
// las acciones de contacto. Secretos: META_ACCESS_TOKEN (token de usuario del
// sistema con ads_read) y META_AD_ACCOUNT_ID.
//
// La respuesta es JSON con "<" escapado, para poder ponerla tal cual dentro de
// un <script> en el elemento HTML de Bubble.

const RUTA_GOOGLE = "/__dotcasa/reportes/google";
const RUTA_META = "/__dotcasa/reportes/meta";
const GOOGLE_VERSION = "v26";
const META_VERSION = "v26.0";
const CACHE_SEGUNDOS = 900;

const GOOGLE_SECRETOS = [
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_REFRESH_TOKEN",
  "GOOGLE_ADS_CUSTOMER_ID",
];
const META_SECRETOS = ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"];

// Acciones de Meta que mostramos como columnas (nombre en la API -> nuestro).
const META_ACCIONES = {
  link_click: "clics_enlace",
  "onsite_conversion.messaging_conversation_started_7d": "conversaciones",
  lead: "leads",
  "offsite_conversion.fb_pixel_lead": "leads_pixel",
  "offsite_conversion.fb_pixel_contact": "contactos_pixel",
};

const json = (datos, status = 200) =>
  new Response(JSON.stringify(datos).replace(/</g, "\\u003c"), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const fecha = (d) => d.toISOString().slice(0, 10);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Rango pedido o los últimos 30 días completos (sin hoy).
export const rango = (url, hoy = new Date()) => {
  let desde = url.searchParams.get("desde") || "";
  let hasta = url.searchParams.get("hasta") || "";
  if (!FECHA.test(hasta)) hasta = fecha(new Date(hoy.getTime() - 864e5));
  if (!FECHA.test(desde))
    desde = fecha(new Date(Date.parse(hasta) - 29 * 864e5));
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  return { desde, hasta };
};

const faltan = (env, lista) => lista.filter((k) => !env[k]);
const soloDigitos = (v) => String(v || "").replace(/\D/g, "");
const num = (v) => Number(v || 0);

/* ---------------------------- Google Ads ---------------------------- */

const tokenGoogle = async (env) => {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.GOOGLE_ADS_CLIENT_ID,
      client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
    }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token)
    throw new Error("oauth_" + res.status + (j?.error ? "_" + j.error : ""));
  return j.access_token;
};

const gaql = async (env, token, query) => {
  const cliente = soloDigitos(env.GOOGLE_ADS_CUSTOMER_ID);
  const version = env.GOOGLE_ADS_API_VERSION || GOOGLE_VERSION;
  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token,
    "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN,
  };
  if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)
    headers["login-customer-id"] = soloDigitos(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  const filas = [];
  let pageToken;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(
      `https://googleads.googleapis.com/${version}/customers/${cliente}/googleAds:search`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(pageToken ? { query, pageToken } : { query }),
      },
    );
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      const det = j?.error?.details?.[0]?.errors?.[0]?.message || j?.error?.message || "";
      throw new Error("google_ads_" + res.status + (det ? ": " + det : ""));
    }
    filas.push(...(j?.results || []));
    pageToken = j?.nextPageToken;
    if (!pageToken) break;
  }
  return filas;
};

export const armarGoogle = (filasConv, filasKw, filasKwConv) => {
  const conversiones = {};
  for (const f of filasConv) {
    const nombre = f.segments?.conversionActionName || "(sin nombre)";
    const c = (conversiones[nombre] ||= { accion: nombre, conversiones: 0, todas: 0 });
    c.conversiones += num(f.metrics?.conversions);
    c.todas += num(f.metrics?.allConversions);
  }

  const kws = new Map();
  for (const f of filasKw) {
    const k = f.adGroupCriterion?.resourceName;
    if (!k) continue;
    kws.set(k, {
      campana: f.campaign?.name || "",
      grupo: f.adGroup?.name || "",
      palabra: f.adGroupCriterion?.keyword?.text || "",
      concordancia: f.adGroupCriterion?.keyword?.matchType || "",
      impresiones: num(f.metrics?.impressions),
      clics: num(f.metrics?.clicks),
      costo: Math.round(num(f.metrics?.costMicros) / 1e4) / 100,
      conversiones: num(f.metrics?.conversions),
      por_accion: {},
    });
  }
  for (const f of filasKwConv) {
    const kw = kws.get(f.adGroupCriterion?.resourceName);
    const nombre = f.segments?.conversionActionName;
    if (!kw || !nombre) continue;
    kw.por_accion[nombre] = (kw.por_accion[nombre] || 0) + num(f.metrics?.allConversions);
  }

  const redondear = (n) => Math.round(n * 100) / 100;
  return {
    conversiones: Object.values(conversiones)
      .map((c) => ({ ...c, conversiones: redondear(c.conversiones), todas: redondear(c.todas) }))
      .sort((a, b) => b.todas - a.todas),
    palabras: [...kws.values()].sort(
      (a, b) => a.campana.localeCompare(b.campana) || a.grupo.localeCompare(b.grupo) || b.clics - a.clics,
    ),
  };
};

const reporteGoogle = async (env, { desde, hasta }) => {
  const token = await tokenGoogle(env);
  const entre = `segments.date BETWEEN '${desde}' AND '${hasta}'`;
  const [conv, kw, kwConv] = await Promise.all([
    gaql(env, token,
      `SELECT segments.conversion_action_name, metrics.conversions, metrics.all_conversions
       FROM campaign WHERE ${entre}`),
    gaql(env, token,
      `SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text,
              ad_group_criterion.keyword.match_type, metrics.impressions,
              metrics.clicks, metrics.cost_micros, metrics.conversions
       FROM keyword_view WHERE ${entre} AND metrics.impressions > 0`),
    gaql(env, token,
      `SELECT ad_group_criterion.resource_name, segments.conversion_action_name,
              metrics.all_conversions
       FROM keyword_view WHERE ${entre} AND metrics.all_conversions > 0`),
  ]);
  return armarGoogle(conv, kw, kwConv);
};

/* ------------------------------- Meta ------------------------------- */

export const armarMeta = (filas) =>
  filas
    .map((f) => {
      const fila = {
        campana: f.campaign_name || "",
        conjunto: f.adset_name || "",
        anuncio: f.ad_name || "",
        impresiones: num(f.impressions),
        alcance: num(f.reach),
        clics: num(f.clicks),
        gasto: num(f.spend),
      };
      for (const nombre of Object.values(META_ACCIONES)) fila[nombre] = 0;
      for (const a of f.actions || []) {
        const nuestro = META_ACCIONES[a.action_type];
        if (nuestro) fila[nuestro] += num(a.value);
      }
      return fila;
    })
    .sort(
      (a, b) =>
        a.campana.localeCompare(b.campana) ||
        a.conjunto.localeCompare(b.conjunto) ||
        b.gasto - a.gasto,
    );

const reporteMeta = async (env, { desde, hasta }) => {
  const cuenta = "act_" + soloDigitos(env.META_AD_ACCOUNT_ID);
  const version = env.META_API_VERSION || META_VERSION;
  const params = new URLSearchParams({
    level: "ad",
    fields: "campaign_name,adset_name,ad_name,impressions,reach,clicks,spend,actions",
    time_range: JSON.stringify({ since: desde, until: hasta }),
    limit: "500",
    access_token: env.META_ACCESS_TOKEN,
  });
  let url = `https://graph.facebook.com/${version}/${cuenta}/insights?${params}`;
  const filas = [];
  for (let i = 0; url && i < 10; i++) {
    const res = await fetch(url);
    const j = await res.json().catch(() => null);
    if (!res.ok) throw new Error("meta_" + res.status + (j?.error?.message ? ": " + j.error.message : ""));
    filas.push(...(j?.data || []));
    url = j?.paging?.next || null;
  }
  return { anuncios: armarMeta(filas) };
};

/* ------------------------------ Ruteo ------------------------------- */

const FUENTES = {
  [RUTA_GOOGLE]: { secretos: GOOGLE_SECRETOS, reporte: reporteGoogle },
  [RUTA_META]: { secretos: META_SECRETOS, reporte: reporteMeta },
};

export const ReporteAds = {
  RUTAS: Object.keys(FUENTES),

  async handle(request, env) {
    const url = new URL(request.url);
    const fuente = FUENTES[url.pathname];
    if (!fuente) return null;
    if (request.method !== "GET") return json({ error: "metodo" }, 405);
    if (!env.ADMIN_REPORTES_TOKEN) return json({ error: "sin_token_admin" }, 500);
    if (request.headers.get("X-DotCasa-Admin") !== env.ADMIN_REPORTES_TOKEN)
      return json({ error: "no_autorizado" }, 401);

    const periodo = rango(url);
    const base = { ok: false, fuente: url.pathname.split("/").pop(), ...periodo };
    const sinConfigurar = faltan(env, fuente.secretos);
    // 200 para que Bubble muestre el aviso en el panel en vez de un error.
    if (sinConfigurar.length) return json({ ...base, error: "sin_configurar", faltan: sinConfigurar });

    const cache = globalThis.caches?.default;
    const llave = new Request(`https://cache.dotcasa${url.pathname}?d=${periodo.desde}&h=${periodo.hasta}`);
    if (cache) {
      const guardada = await cache.match(llave);
      if (guardada) return guardada;
    }
    try {
      const datos = await fuente.reporte(env, periodo);
      const res = json({ ...base, ok: true, ...datos });
      if (cache) {
        const copia = new Response(res.clone().body, res);
        copia.headers.set("Cache-Control", "max-age=" + CACHE_SEGUNDOS);
        await cache.put(llave, copia);
      }
      return res;
    } catch (e) {
      console.log("reporte_ads", base.fuente, String(e?.message || e));
      return json({ ...base, error: String(e?.message || e) });
    }
  },
};
