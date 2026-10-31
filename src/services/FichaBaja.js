import { config } from "../controllers/config/config.js";
import { Utils } from "./utils/utils.js";

// Ficha de una propiedad que ya no está: se borró en Bubble o se marcó como
// "Finalizado" (vendida / dada de baja). En vez de un 404, 301 al listado
// más cercano que tenga propiedades, para que lo ganado en Google pase a una
// página que no muere (la de su colonia, o la de su ciudad si la colonia ya
// no tiene nada).
//
// Borrador o en pausa no entran aquí: la propiedad puede volver y el agente
// la revisa en su URL; esa ficha se ve, pero sin indexar.

const ACTIVO = "activo";
const FINALIZADO = /^(finalizad|vendid|baja)/;

// "activa" | "baja" (Finalizado) | "oculta" (Borrador, En pausa, ...)
export const estadoFicha = (p) => {
  const e = Utils.normalizar(String(p?.Estatus ?? p?.estatus ?? ""));
  if (e === ACTIVO) return "activa";
  if (FINALIZADO.test(e)) return "baja";
  return "oculta";
};

// Ubicación de la ficha: de la propiedad si existe, si no de la URL
// (/tipo/op/estado/ciudad/colonia/<slug>). Segmentos ya normalizados.
export const ubicacionFicha = (prop, norm = []) => {
  const de = (campo, i) =>
    Utils.normalizar(String(prop?.[campo] ?? norm[i] ?? ""));
  const estado = de("estado_slug", 2);
  const ciudad = de("ciudad_slug", 3);
  return {
    tipo: de("tipo_slug", 0),
    op: de("operacion_slug", 1),
    estado,
    ciudad,
    colonia: Utils.coloniaOficial(estado, ciudad, de("colonia_slug", 4)),
  };
};

// Listados candidatos, del más parecido al más general. Cada uno con su ruta
// pública y el slug con que se busca en la tabla ruta de Bubble.
export const candidatosListado = ({ tipo, op, estado, ciudad, colonia }) => {
  const t = config.TIPOS.has(tipo) ? tipo : "";
  const o = config.OPS.has(op) ? op : "";
  const e = config.ESTADOS.has(estado) ? estado : "";
  const c = e ? ciudad : "";
  const col = c ? colonia : "";
  const opciones = [
    [t, o, e, c, col],
    [o, e, c, col],
    [t, o, e, c],
    [o, e, c],
    [e, c, col],
    [t, o, e],
    [e, c],
    [t, o],
  ];
  const vistos = new Set();
  const out = [];
  for (const partes of opciones) {
    // Si falta un segmento intermedio la ruta no existe tal cual: se salta
    const idx = partes.findIndex((x) => !x);
    if (idx !== -1) continue;
    const ruta = "/" + partes.join("/");
    if (vistos.has(ruta)) continue;
    vistos.add(ruta);
    out.push({ ruta, slug: partes.join("-") });
  }
  return out;
};

// Primer candidato que existe con propiedades. existe(slug) -> true | false |
// undefined (Bubble no respondió: se toma como que sí, para no mandar a la
// home una ficha que tiene listado). Sin ninguno: /propiedades.
export const listadoMasCercano = async (ubicacion, existe) => {
  const cands = candidatosListado(ubicacion);
  const res = await Promise.all(cands.map((c) => existe(c.slug)));
  const i = res.findIndex((r) => r !== false);
  return i === -1 ? "/propiedades" : cands[i].ruta;
};

// Ubicación que trae un slug viejo de ficha, con ayuda del índice de rutas
// (BubbleManager.indiceRutas). En "casa-venta-<colonia>-<ciudad>-<ID>" la
// colonia y la ciudad no se pueden separar a ojo, pero sí comparando contra
// las rutas que existen: se busca la colonia+ciudad más larga que aparezca en
// el slug (también las colonias con otro nombre de config.COLONIAS_IGUALES,
// p. ej. "predio-aldape-san-nicolas-de-los-garza"); si no hay, solo la ciudad.
// Devuelve { tipo, op, estado, ciudad, colonia } (vacío lo que no se sepa).
export const ubicacionDeTexto = (slug, indice) => {
  let s = Utils.normalizar(String(slug ?? "")).replace(/-?\d+x\d+$/, "");
  const out = { tipo: "", op: "", estado: "", ciudad: "", colonia: "" };
  const tipo = [...config.TIPOS]
    .sort((a, b) => b.length - a.length)
    .find((t) => s === t || s.startsWith(t + "-"));
  if (tipo) {
    out.tipo = tipo;
    s = s.slice(tipo.length + 1);
    const op = [...config.OPS].find((o) => s === o || s.startsWith(o + "-"));
    if (op) {
      out.op = op;
      s = s.slice(op.length + 1);
    }
  }
  if (!s || !indice?.size) return out;
  const aparece = (clave) =>
    s === clave ||
    s.startsWith(clave + "-") ||
    s.endsWith("-" + clave) ||
    s.includes("-" + clave + "-");

  const rutas = [...indice.values()].filter(
    (r) => r && !r.tipo && !r.operacion && r.estado && r.ciudad,
  );
  // colonia+ciudad (con los nombres alternos de config.COLONIAS_IGUALES)
  const colonias = [];
  for (const r of rutas)
    if (r.colonia)
      colonias.push({ clave: `${r.colonia}-${r.ciudad}`, r, colonia: r.colonia });
  for (const [k, oficial] of Object.entries(config.COLONIAS_IGUALES)) {
    const [estado, ciudad, otra] = k.split("/");
    const r = rutas.find(
      (x) => x.estado === estado && x.ciudad === ciudad && x.colonia === oficial,
    );
    if (r) colonias.push({ clave: `${otra}-${ciudad}`, r, colonia: oficial });
  }
  const col = colonias
    .filter((c) => aparece(c.clave))
    .sort((a, b) => b.clave.length - a.clave.length)[0];
  if (col) {
    out.estado = col.r.estado;
    out.ciudad = col.r.ciudad;
    out.colonia = col.colonia;
    return out;
  }
  const ciu = rutas
    .filter((r) => !r.colonia && aparece(r.ciudad))
    .sort((a, b) => b.ciudad.length - a.ciudad.length)[0];
  if (ciu) {
    out.estado = ciu.estado;
    out.ciudad = ciu.ciudad;
  }
  return out;
};
