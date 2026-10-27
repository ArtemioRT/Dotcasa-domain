// Piezas de texto que comparten los títulos y descripciones de fichas y
// listados.

// Google corta el título cerca de los 600 px (unos 60-65 caracteres). Se usa
// el primer candidato que quepa; si ninguno cabe, el más corto.
export const LIMITE_TITULO = 65;
export const LIMITE_DESCRIPCION = 155;

export const mejorTitulo = (candidatos) => {
  const lista = candidatos.filter(Boolean);
  return (
    lista.find((t) => t.length <= LIMITE_TITULO) ??
    lista.reduce((a, b) => (b.length < a.length ? b : a))
  );
};

export const recortar = (t, max = LIMITE_DESCRIPCION) =>
  t.length > max ? t.slice(0, max - 3).trimEnd() + "..." : t;

// Precio para títulos: $4.2M, $9M, $850K en venta; $18,000/mes en renta
// ($18K/mes con compacto, cuando el título no da para más).
export const precioCorto = (n, opSlug, { compacto = false } = {}) => {
  if (!(n > 0)) return null;
  if (opSlug === "renta")
    return compacto && n >= 10_000
      ? `$${String(Math.round(n / 100) / 10).replace(/\.0$/, "")}K/mes`
      : `$${Math.round(n).toLocaleString("en-US")}/mes`;
  if (n >= 1_000_000) {
    const m = Math.round(n / 100_000) / 10;
    return `$${String(m).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
};

// Precio completo para descripciones: $4,200,000 o $18,000 al mes.
export const precioLargo = (n, opSlug) =>
  n > 0
    ? `$${Math.round(n).toLocaleString("en-US")}` +
      (opSlug === "renta" ? " al mes" : "")
    : null;

// Como busca la gente los municipios de nombre largo ("casas en San Pedro").
const CIUDADES_CORTAS = {
  "san-pedro-garza-garcia": "San Pedro",
  "san-nicolas-de-los-garza": "San Nicolás",
  "general-escobedo": "Escobedo",
  "ciudad-general-escobedo": "Escobedo",
  "guadalupe-nuevo-leon": "Guadalupe",
};

export const ciudadCorta = (slug, nombre) =>
  CIUDADES_CORTAS[slug] ?? nombre;

// Bubble vuelve a escribir el <title> con JavaScript al cargar la página
// (detalle_propiedad: "... · $$20K | DotCasa"; buscador: el H1 sin marca) y
// Google indexa la página ya dibujada. Este script deja el título del Worker
// y lo restaura cada vez que Bubble lo cambia.
export const fijarTitulo = (titulo) =>
  `<script>(function(){var t=${JSON.stringify(titulo).replace(/</g, "\\u003c")};function f(){if(document.title!==t)document.title=t}f();new MutationObserver(f).observe(document.head||document.documentElement,{subtree:true,childList:true,characterData:true})})()</script>`;

// "Locales comerciales" -> "Locales Comerciales"
export const mayusculaInicial = (t) =>
  String(t ?? "").replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
