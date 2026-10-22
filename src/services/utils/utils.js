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

  escapeXml: (texto) => {
    return texto
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },
};
