import { config } from "../../controllers/config/config.js";

export const Utils = {
  normalizar: (texto) => {
    let t = texto;
    try {
      t = decodeURIComponent(texto);
    } catch (e) {}
    return t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_\s]+/g, "-");
  },

  // Slug limpio para URLs: sin acentos, minúsculas y solo [a-z0-9-]
  // ("Rincón de la Montaña" → "rincon-de-la-montana", "Cdad. Mante" → "cdad-mante").
  slugify: (texto) =>
    Utils.normalizar(String(texto ?? ""))
      .replace(/ñ/g, "n")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),

  // Colonia oficial cuando hay dos nombres para la misma ("monterrey-centro"
  // y "centro" en Monterrey): la URL vieja hace 301 a la oficial y las fichas
  // se arman con la oficial. Ver config.COLONIAS_IGUALES.
  coloniaOficial: (estado, ciudad, colonia) =>
    config.COLONIAS_IGUALES[`${estado}/${ciudad}/${colonia}`] ?? colonia,

  // Segmentos ya normalizados -> segmentos de la URL oficial: plural al
  // singular (/casas -> /casa) y colonia duplicada a la oficial. Devuelve el
  // mismo arreglo si no hay nada que cambiar.
  rutaOficial: (norm) => {
    const nueva = [...norm];
    if (config.PLURALES[nueva[0]]) nueva[0] = config.PLURALES[nueva[0]];
    for (let i = 0; i + 2 < nueva.length; i++)
      if (config.ESTADOS.has(nueva[i])) {
        nueva[i + 2] = Utils.coloniaOficial(
          nueva[i],
          nueva[i + 1],
          nueva[i + 2],
        );
        break;
      }
    return nueva.some((n, i) => n !== norm[i]) ? nueva : norm;
  },

  escapeXml: (texto) => {
    return texto
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },
};
