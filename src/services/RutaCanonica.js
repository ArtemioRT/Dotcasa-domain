// Ruta que va en <link rel="canonical"> y og:url: la versión limpia de la URL.
//   - sin parámetros (?recamaras=3 ...): el pathname no los trae
//   - sin "/" final: /acerca_de_nosotros/ es la misma página que /acerca_de_nosotros
//   - "/index" es la home: su canonical es "/"
// La raíz se queda como "/".
export const rutaCanonica = (pathname) => {
  const limpia = pathname.replace(/\/{2,}/g, "/").replace(/(.)\/+$/, "$1");
  return limpia.toLowerCase() === "/index" ? "/" : limpia;
};
