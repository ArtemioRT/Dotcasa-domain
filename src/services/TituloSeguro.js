import { config } from "../controllers/config/config.js";

// Red de seguridad: el <title> nunca debe quedar vacío ni reducido a
// "- DotCasa". Si Bubble lo entrega sin datos (propiedad sin colonia, precio
// vacío, página aún sin cargar...), se usa un título de respaldo armado con lo
// que diga la URL: "Casa en Venta en Monterrey | DotCasa".

const TIPOS = {
  casa: "Casa",
  departamento: "Departamento",
  terreno: "Terreno",
  rancho: "Rancho",
  cabana: "Cabaña",
  quinta: "Quinta",
  oficina: "Oficina",
  "local-comercial": "Local comercial",
  "bodega-comercial": "Bodega comercial",
  "nave-industrial": "Nave industrial",
  "bodega-industrial": "Bodega industrial",
  edificio: "Edificio",
};
const OPERACIONES = { venta: "Venta", renta: "Renta", preventa: "Preventa" };

export const TITULO_GENERAL = "Propiedades en Venta y Renta en México | DotCasa";

const mayusculas = (s) =>
  s.replace(/-/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase());

// ¿El título quedó sin contenido real? Se quitan la marca, los separadores,
// el signo de pesos y los conectores sueltos ("en", "de"): si no queda ni una
// letra o número, está vacío ("", "- DotCasa", "| DotCasa", " en  en  · $ | DotCasa").
export const tituloVacio = (texto) => {
  const resto = String(texto ?? "")
    .replace(/dotcasa/gi, " ")
    .replace(/\b(en|de|la|el|undefined|null|nan)\b/gi, " ")
    .replace(/[\s\-–—|·$,.:;/]+/g, "");
  return resto === "";
};

// Título de respaldo a partir de la ruta. En una ficha o listado usa tipo,
// operación y lugar; en cualquier otra página, el título general.
export const tituloDeRespaldo = (pathname) => {
  let partes = [];
  try {
    partes = decodeURIComponent(pathname)
      .split("/")
      .filter(Boolean)
      .map((p) => p.toLowerCase());
  } catch (e) {}
  const tipo = TIPOS[partes[0]];
  const op = OPERACIONES[partes[1]];
  if (!tipo || !op) return TITULO_GENERAL;
  // /tipo/op/estado/ciudad/colonia/slug: el lugar más específico que haya,
  // sin pasar de la colonia (el último segmento de una ficha es el slug).
  const lugares = partes.slice(2, 5).filter((p) => !config.CP_REGEX?.test(p));
  const lugar = lugares.length ? mayusculas(lugares[lugares.length - 1]) : "";
  const ciudad =
    partes.length >= 4 ? mayusculas(partes[3]) : lugar || "México";
  return `${tipo} en ${op} en ${ciudad} | DotCasa`;
};

// Decide el título que queda: el de Bubble si tiene contenido, si no el de respaldo.
export const tituloFinal = (actual, pathname) =>
  tituloVacio(actual) ? tituloDeRespaldo(pathname) : actual;
