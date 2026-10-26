# app-redirect

Worker de `app.dotcasa.com.mx`: 301 a `dotcasa.com.mx` con la misma ruta y query.
`/detalle_propiedad/<slug>` llega a `dotcasa.com.mx/detalle_propiedad/<slug>` y ahí el
Worker principal hace el segundo 301 a la URL nueva de la ficha.

`app.dotcasa.com.mx` es también el origen del Worker principal, así que este Worker
**no redirige** las llamadas que traen el header `X-Dotcasa-Origen` con el secreto
`ORIGEN_TOKEN`, ni lo que no sea una navegación (POST, API, scripts), ni los flujos
de `SIN_REDIRIGIR` (login de respaldo, reset de contraseña, `/version-test`, `robots.txt`...).
Si `ORIGEN_TOKEN` no está configurado, no redirige nada.

## Despliegue (el orden importa)

Si el Worker de redirección se publica antes de que el principal mande el header,
el sitio entra en ciclo de redirecciones.

1. Elegir un valor largo y aleatorio (`openssl rand -hex 32`).
2. Worker principal (raíz del repo): `npx wrangler secret put ORIGEN_TOKEN` y
   `npx wrangler deploy`. Esto solo agrega un header a las llamadas a Bubble.
3. Comprobar que dotcasa.com.mx sigue cargando normal.
4. Este Worker: `cd app-redirect && npx wrangler secret put ORIGEN_TOKEN` (mismo valor)
   y `npx wrangler deploy`.
5. Comprobar:
   ```
   curl -sI -H 'Accept: text/html' https://app.dotcasa.com.mx/propiedades | grep -iE '^HTTP|^location'
   curl -sI https://dotcasa.com.mx/propiedades | grep -iE '^HTTP'
   curl -sI -H 'Accept: text/html' https://app.dotcasa.com.mx/login | grep -iE '^HTTP'   # 200, se queda
   ```

Revertir: `npx wrangler delete` dentro de `app-redirect/` (o quitar la ruta en Cloudflare).
El 301 se guarda una hora en el navegador (`max-age=3600`).

Requisito: el registro DNS de `app` debe estar con proxy (nube naranja).

## Pruebas

`node --test app-redirect/test/index.test.mjs`

## Mientras tanto

Se mantiene el `noindex, follow` de Bubble y su `robots.txt` en `app.`
(permite rastrear, bloquea solo `/version-test/`) para que Google lea los 301.
