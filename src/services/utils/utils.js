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

  escapeXml: (texto) => {
    return texto
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },
};
