import { config } from "../controllers/config/config.js";
import { Utils } from "./utils/utils.js";

// URL pública de una ficha armada por el Worker a partir de los campos de la
// propiedad, sin depender del Slug_text de Bubble (que trae mayúsculas,
// espacios y acentos):
//   /casa/venta/nuevo-leon/monterrey/rincon-de-la-montana/
//     casa-venta-rincon-de-la-montana-monterrey-1765299061895x848461617867522000
// Los segmentos de ubicación usan Utils.normalizar, igual que los listados,
// para que las migas apunten a páginas que existen. Devuelve null si faltan
// datos (entonces se usa la url_publica de Bubble).
export const urlFicha = (p) => {
  if (!p?._id) return null;
  const tipo = Utils.normalizar(p.tipo_slug ?? "");
  const op = Utils.normalizar(p.operacion_slug ?? "");
  const estado = Utils.normalizar(p.estado_slug ?? "");
  const ciudad = Utils.normalizar(p.ciudad_slug ?? "");
  const colonia = Utils.normalizar(p.colonia_slug ?? "");
  if (!config.TIPOS.has(tipo) || !config.OPS.has(op)) return null;
  if (!estado || !ciudad || !colonia) return null;

  const nombre = Utils.slugify(`${tipo} ${op} ${colonia} ${ciudad}`);
  return `/${tipo}/${op}/${estado}/${ciudad}/${colonia}/${nombre}-${p._id}`;
};

// El unique id de Bubble al final del slug ("...-1765299061895x8484...")
export const idDeSlug = (slug) => {
  let s = slug ?? "";
  try {
    s = decodeURIComponent(s);
  } catch (e) {}
  return s.match(/(\d+x\d+)$/)?.[1] ?? null;
};
