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

// Listado que se quedó sin propiedades (la colonia vendió todo): rutas de
// arriba, de la más cercana a la más general. Quita el filtro final
// (/3-recamaras) o el último lugar, y no deja colgando "cp", "municipio" ni
// "fraccionamiento".
//   /casa/venta/nuevo-leon/monterrey/cumbres -> /casa/venta/nuevo-leon/monterrey,
//   /casa/venta/nuevo-leon, /casa/venta, /casa
export const listadosDeArriba = (norm) => {
  const COLGANTES = new Set(["cp", "municipio", "fraccionamiento"]);
  const segs = [...norm];
  const out = [];
  while (segs.length > 1) {
    segs.pop();
    while (segs.length && COLGANTES.has(segs[segs.length - 1])) segs.pop();
    if (segs.length) out.push(segs.join("/"));
  }
  return out.map((r) => ({ ruta: "/" + r, slug: r.split("/").join("-") }));
};
