// Bubble pone sus cookies de sesión con "domain=<dominio de la app>". Cuando la
// app vivía en dotcasa.com.mx (antes de este Worker) eran cookies con
// domain=dotcasa.com.mx, y siguen en el navegador de quien visitó el sitio en
// esa época. Las de ahora llegan sin dominio (ver publicarRespuesta), y el
// navegador guarda las dos como cookies distintas con el mismo nombre.
//
// Con las dos copias, Bubble y su script leen a veces la vieja: no se puede
// iniciar ni cerrar sesión ("tu sesión ha cambiado/caducado") o el login no se
// queda. Aquí se arman los Set-Cookie que borran la copia vieja.

// u2main y u2main.sig llevan la sesión; u1main, el id del usuario.
const esDeSesion = (nombre) => /u[12]main(\.sig)?$/.test(nombre);

const nombreDe = (cookie) => cookie.split("=")[0].trim();

// Nombres de cookies de sesión que el navegador mandó más de una vez: señal
// segura de que tiene la copia vieja junto a la nueva.
export const repetidas = (cookieHeader) => {
  const vistas = new Set();
  const dobles = new Set();
  for (const par of (cookieHeader || "").split(";")) {
    const nombre = nombreDe(par);
    if (!nombre || !esDeSesion(nombre)) continue;
    if (vistas.has(nombre)) dobles.add(nombre);
    vistas.add(nombre);
  }
  return [...dobles];
};

// Nombres de las cookies de sesión que Bubble está poniendo en esta respuesta.
export const deSesion = (setCookies) =>
  setCookies.map(nombreDe).filter(esDeSesion);

// Set-Cookie que borra la copia con domain=<host>. No toca la cookie sin
// dominio: para el navegador es otra cookie.
export const borrarVieja = (nombre, host) =>
  `${nombre}=; Path=/; Domain=${host}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Secure`;
