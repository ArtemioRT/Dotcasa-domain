import { config } from "../controllers/config/config.js";
import { Utils } from "./utils/utils.js";

// Links con los filtros en la query (anuncios de Google Ads, links viejos, el
// buscador general): /nuevo-leon?tipo=casa&operacion=renta&ciudad=Monterrey.
// La página del listado toma su título, conteo y lista de la RUTA, así que esa
// URL se veía como "todas las propiedades de Nuevo León". Aquí se calcula la
// ruta limpia más específica que tenga propiedades con lo que trae la ruta +
// la query (/casa/renta/nuevo-leon/monterrey) y lo que se metió a la ruta se
// quita de la query. Todo lo demás (precio_max, recamaras, gclid, utm_*) se
// queda tal cual.
//
// También corrige nombres cortos de ciudad que no son los de las rutas
// (/nuevo-leon/escobedo -> /nuevo-leon/general-escobedo), que daban 404.

const ALIAS_TIPO = {
  depto: "departamento",
  deptos: "departamento",
  depa: "departamento",
  depas: "departamento",
  local: "local-comercial",
  locales: "local-comercial",
  bodega: "bodega-comercial",
  bodegas: "bodega-comercial",
  nave: "nave-industrial",
  naves: "nave-industrial",
};
const ALIAS_OP = {
  compra: "venta",
  comprar: "venta",
  vender: "venta",
  rentar: "renta",
  alquiler: "renta",
  alquilar: "renta",
};
const ALIAS_ESTADO = {
  nl: "nuevo-leon",
  "n-l": "nuevo-leon",
  cdmx: "ciudad-de-mexico",
  df: "ciudad-de-mexico",
  "distrito-federal": "ciudad-de-mexico",
  edomex: "estado-de-mexico",
  "edo-mex": "estado-de-mexico",
  mexico: "estado-de-mexico",
  qro: "queretaro",
  "quintana-roo-mexico": "quintana-roo",
};

// Llaves de la query que esto entiende (singular y el plural viejo)
const LLAVES = {
  tipo: ["tipo", "tipos"],
  operacion: ["operacion", "operaciones"],
  estado: ["estado", "estados"],
  ciudad: ["ciudad", "ciudades"],
  colonia: ["colonia", "colonias"],
};

const lista = (sp, llaves) =>
  llaves
    .flatMap((k) => sp.getAll(k))
    .flatMap((v) => String(v).split(","))
    .map((v) => v.trim())
    .filter(Boolean);

const tipoDe = (v) => {
  const s = Utils.slugify(v);
  const t = config.PLURALES[s] ?? ALIAS_TIPO[s] ?? s;
  return config.TIPOS.has(t) ? t : null;
};
const opDe = (v) => {
  const s = Utils.slugify(v);
  const o = ALIAS_OP[s] ?? s;
  return config.OPS.has(o) ? o : null;
};
const estadoDe = (v) => {
  const s = Utils.slugify(v);
  const e = ALIAS_ESTADO[s] ?? s;
  return config.ESTADOS.has(e) ? e : null;
};

// Ruta actual -> sus partes. null si no es un listado simple (cp, municipio,
// fraccionamiento, segmento de filtro, ficha...).
export function partesDeRuta(norm) {
  const p = { tipo: "", operacion: "", estado: "", ciudad: "", colonia: "" };
  if (
    norm.length === 0 ||
    (norm.length === 1 && (norm[0] === "propiedades" || norm[0] === "buscador"))
  )
    return p;
  let i = 0;
  if (config.TIPOS.has(norm[i])) p.tipo = norm[i++];
  if (config.OPS.has(norm[i])) p.operacion = norm[i++];
  if (i === 0 && !config.ESTADOS.has(norm[0])) return null;
  if (i < norm.length) {
    if (!config.ESTADOS.has(norm[i])) return null;
    p.estado = norm[i++];
    if (i < norm.length) p.ciudad = norm[i++];
    if (i < norm.length) p.colonia = norm[i++];
  }
  if (i !== norm.length) return null;
  return p;
}

const armar = (x) => {
  const s = [];
  if (x.tipo) s.push(x.tipo);
  if (x.operacion) s.push(x.operacion);
  if (x.estado) {
    s.push(x.estado);
    if (x.ciudad) {
      s.push(x.ciudad);
      if (x.colonia) s.push(x.colonia);
    }
  }
  return s;
};

// Rutas generales de ubicación (sin tipo ni operación) del índice
const ubicaciones = (indice) =>
  [...indice.values()].filter((r) => r && !r.tipo && !r.operacion);
const total = (r) => Number(r?.[config.BUBBLE.API_CAMPO_TOTAL] ?? 0);
const mejor = (rutas) =>
  rutas.sort((a, b) => total(b) - total(a))[0] ?? null;

// Ciudad como la escribió la gente -> slug de la ruta ("escobedo" ->
// "general-escobedo", "san-nicolas" -> "san-nicolas-de-los-garza"). Primero
// exacta, luego la única (o la más grande) que empieza o termina igual.
function ciudadReal(estado, ciudad, rutas) {
  const delEstado = rutas.filter(
    (r) => r.ciudad && !r.colonia && (!estado || r.estado === estado),
  );
  const exacta = mejor(delEstado.filter((r) => r.ciudad === ciudad));
  if (exacta) return exacta;
  return mejor(
    delEstado.filter(
      (r) =>
        r.ciudad.endsWith("-" + ciudad) ||
        r.ciudad.startsWith(ciudad + "-") ||
        r.ciudad.includes("-" + ciudad + "-"),
    ),
  );
}
// Colonia sin ciudad (o sin estado): la ruta de colonia más grande con ese nombre
function coloniaReal(estado, ciudad, colonia, rutas) {
  return mejor(
    rutas.filter(
      (r) =>
        r.colonia === colonia &&
        (!estado || r.estado === estado) &&
        (!ciudad || r.ciudad === ciudad),
    ),
  );
}

// pathname: "/nuevo-leon"; sp: URLSearchParams; indice: Map slug -> ruta
// (BubbleManager.indiceRutas). Devuelve "/ruta?query" o null si no hay que
// redirigir.
export function destinoPorQuery(norm, sp, indice) {
  if (!indice || !indice.size) return null;
  const actual = partesDeRuta(norm);
  if (!actual) return null;

  // Valores de la query que se pueden meter a la ruta (uno solo por campo)
  const deQuery = {};
  const normal = { tipo: tipoDe, operacion: opDe, estado: estadoDe };
  for (const [campo, llaves] of Object.entries(LLAVES)) {
    const vals = [
      ...new Set(
        lista(sp, llaves).map((v) =>
          normal[campo] ? normal[campo](v) : Utils.slugify(v),
        ),
      ),
    ];
    if (vals.length !== 1 || !vals[0]) continue; // varios o raros: se quedan en la query
    if (actual[campo] && actual[campo] !== vals[0]) return null; // se contradicen
    deQuery[campo] = vals[0];
  }

  const f = { ...actual };
  for (const [k, v] of Object.entries(deQuery)) f[k] = v;

  // Ubicación: completar ciudad/estado y corregir nombres cortos
  const rutas = ubicaciones(indice);
  if (f.colonia && (!f.ciudad || !f.estado)) {
    const r = coloniaReal(f.estado, f.ciudad, f.colonia, rutas);
    if (r) {
      f.estado = r.estado;
      f.ciudad = r.ciudad;
    } else {
      delete deQuery.colonia; // no se sabe dónde está: se queda en la query
      f.colonia = actual.colonia;
    }
  }
  if (f.ciudad) {
    const r = ciudadReal(f.estado, f.ciudad, rutas);
    if (r) {
      f.estado = r.estado;
      f.ciudad = r.ciudad;
    } else if (deQuery.ciudad) {
      delete deQuery.ciudad;
      f.ciudad = actual.ciudad;
      if (!actual.ciudad) f.colonia = actual.colonia;
    }
  }
  if (f.colonia && f.ciudad && f.estado)
    f.colonia = Utils.coloniaOficial(f.estado, f.ciudad, f.colonia);

  // De la más específica a la más general (igual que DCRutas en Bubble):
  // primero se quita ubicación, luego tipo, al final operación.
  const locs = [];
  if (f.colonia && f.ciudad && f.estado)
    locs.push({ estado: f.estado, ciudad: f.ciudad, colonia: f.colonia });
  if (f.ciudad && f.estado) locs.push({ estado: f.estado, ciudad: f.ciudad });
  if (f.estado) locs.push({ estado: f.estado });
  locs.push({});
  const combos = [
    [f.tipo, f.operacion],
    ["", f.operacion],
    [f.tipo, ""],
    ["", ""],
  ];
  let elegida = null;
  for (const l of locs) {
    for (const [tipo, operacion] of combos) {
      const x = { tipo, operacion, estado: "", ciudad: "", colonia: "", ...l };
      const segs = armar(x);
      if (!segs.length || indice.has(segs.join("-"))) {
        elegida = x;
        break;
      }
    }
    if (elegida) break;
  }
  if (!elegida) return null;

  // Lo que la ruta elegida no usa se queda en la query como venía
  const q = new URLSearchParams(sp);
  for (const campo of Object.keys(LLAVES)) {
    if (deQuery[campo] && elegida[campo]) for (const k of LLAVES[campo]) q.delete(k);
  }
  const segs = armar(elegida);
  const ruta = segs.length ? "/" + segs.join("/") : "/propiedades";
  const qs = q.toString().replace(/%2C/gi, ",");
  const nueva = ruta + (qs ? "?" + qs : "");
  const vieja =
    (norm.length ? "/" + norm.join("/") : "/propiedades") +
    (sp.toString() ? "?" + sp.toString().replace(/%2C/gi, ",") : "");
  // Sin nada de la query metido a la ruta, solo se redirige para corregir
  // un nombre (escobedo -> general-escobedo); nunca para "subir" a una
  // ruta más general.
  const usoQuery = Object.keys(deQuery).some((c) => elegida[c]);
  if (!usoQuery) {
    const corregida = armar(f);
    const misma =
      corregida.length === segs.length &&
      corregida.every((s, i) => s === segs[i]);
    if (!misma || corregida.join("/") === norm.join("/")) return null;
  }
  return nueva === vieja ? null : nueva;
}
