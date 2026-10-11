import { config } from "../controllers/config/config.js";

// Los magic links que arma un backend workflow de Bubble salen con el host de
// Bubble (app.dotcasa.com.mx o *.bubbleapps.io). Aquí se pasan a
// dotcasa.com.mx, con la versión que pidió la página, para que Bubble inicie
// la sesión con cookies de dotcasa.com.mx.
//
// Devuelve null si el link no es de Bubble ni del propio sitio: nunca mandamos
// al navegador a un host ajeno.
export const enlacePublico = (link, bubble, version) => {
  let destino;
  try {
    destino = new URL(link, bubble.origin);
  } catch (e) {
    return null;
  }
  const host = destino.hostname;
  if (
    host !== bubble.hostname &&
    host !== config.DOMINIO &&
    !host.endsWith(".bubbleapps.io")
  )
    return null;
  destino.protocol = "https:";
  destino.host = config.DOMINIO;
  destino.pathname =
    version + destino.pathname.replace(/^\/version-[^/]+(?=\/)/, "");
  return destino.toString();
};
