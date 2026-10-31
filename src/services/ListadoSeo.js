import { config } from "../controllers/config/config.js";
import { TIPOS, OPERACIONES } from "./FichaSeo.js";
import { urlFicha } from "./UrlFicha.js";
import { SitemapRoute } from "../routes/SiteMap.route.js";
import {
  LIMITE_DESCRIPCION,
  ciudadCorta,
  mayusculaInicial,
  mejorTitulo,
  precioCorto,
  recortar,
  fijarTitulo,
} from "./TextoSeo.js";

// Las páginas de listado (/departamento/renta/nuevo-leon/monterrey/...) usan
// la página "buscador" de Bubble, que tiene título y descripción fijos, no
// tiene H1 y dibuja las tarjetas con JavaScript (sin <a href>). Para Google
// eran cientos de páginas iguales y vacías. Aquí se escriben en el HTML
// inicial los textos de la ruta (titulo_seo, h1, texto_intro, que genera
// crear_rutas_propiedad en Bubble), el conteo real, los links a las fichas
// y el schema de BreadcrumbList e ItemList.

const escaparHtml = (t) =>
  String(t ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const jsonLd = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

const desdeSlug = (s) =>
  String(s ?? "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const limpio = (t) =>
  typeof t === "string" && t.trim() ? t.replace(/\s+/g, " ").trim() : null;

const pesos = (n) => "$" + Math.round(n).toLocaleString("en-US");

// Primera foto de la propiedad (URL_Fotografia_lugar: lista de URLs del
// bucket, a veces "//host/..." sin protocolo). null si no tiene.
export const fotoPrincipal = (p) => {
  const v = p?.URL_Fotografia_lugar ?? p?.url_fotografia_lugar;
  const u = (Array.isArray(v) ? v : [v]).find(
    (x) => typeof x === "string" && x.trim(),
  );
  if (!u) return null;
  const url = u.trim().startsWith("//") ? "https:" + u.trim() : u.trim();
  return /^https:\/\//.test(url) ? url : null;
};

// Migas para las rutas que Bubble crea sin breadcrumb_json (tipo + colonia,
// recámaras, precio): un nivel por cada segmento de la URL.
const migasDeRuta = (ruta, nombres) => {
  const url = typeof ruta.url_publica === "string" ? ruta.url_publica : "";
  const partes = url.split("/").filter(Boolean);
  if (!partes.length) return [];
  const etiqueta = (seg) => {
    if (TIPOS[seg]) return TIPOS[seg][1];
    if (OPERACIONES[seg]) return OPERACIONES[seg];
    if (seg === ruta.estado) return nombres.estado ?? desdeSlug(seg);
    if (seg === ruta.ciudad) return nombres.ciudad ?? desdeSlug(seg);
    if (seg === ruta.colonia) return nombres.colonia ?? desdeSlug(seg);
    const rec = /^(\d)-recamaras$/.exec(seg);
    if (rec) return `${rec[1]} ${rec[1] === "1" ? "recámara" : "recámaras"}`;
    const prec = Number(ruta.precio_max);
    if (/^hasta-/.test(seg) && prec > 0)
      return `Hasta ${precioCorto(prec, ruta.operacion)}`;
    const pmin = Number(ruta.precio_min);
    if (/^desde-/.test(seg) && pmin > 0)
      return `Desde ${precioCorto(pmin, ruta.operacion)}`;
    return desdeSlug(seg);
  };
  return partes.map((seg, i) => [
    etiqueta(seg),
    "https://" + config.DOMINIO + "/" + partes.slice(0, i + 1).join("/"),
  ]);
};

export const ListadoSeo = {
  // ruta: registro de Bubble. props: { lista, total, desde } o null.
  // canonica: URL pública completa del listado.
  // exacto: false si la URL trae filtros que aquí no se pudieron contar
  // (?banos=, ?construccion_min=...): el título lleva el total de la ruta y
  // el navegador lo corrige con el conteo real (ver fijarTitulo).
  datos(ruta, props, canonica, { exacto = true } = {}) {
    const tipoSlug = ruta.tipo ?? null;
    const opSlug = ruta.operacion ?? null;
    const [tipo, tipoPlural] = TIPOS[tipoSlug] ?? [];
    const op = opSlug
      ? (OPERACIONES[opSlug] ?? desdeSlug(opSlug)).toLowerCase()
      : null;

    // Nombres con acentos: de la primera propiedad; si no hay, del slug
    const p0 = props?.lista?.[0] ?? {};
    const nombre = (campo, slug) =>
      slug ? (limpio(p0[campo]) ?? desdeSlug(slug)) : null;
    const estado = nombre("Estado", ruta.estado);
    const ciudad = nombre("Ciudad", ruta.ciudad);
    const colonia = nombre("Colonia", ruta.colonia);
    const cp = ruta.cp ?? null;

    const lugar = colonia
      ? ` en ${colonia}, ${ciudad}`
      : ciudad
        ? ` en ${ciudad}, ${estado}`
        : estado
          ? ` en ${estado}`
          : cp
            ? ` en el código postal ${cp}`
            : " en México";
    const enOp = op ? ` en ${op}` : " en venta y renta";

    // Rutas con filtro (crear_ruta_filtro en Bubble): /3-recamaras,
    // /hasta-3-millones, /hasta-15-mil.
    const recamaras = Number(ruta.recamaras) > 0 ? Number(ruta.recamaras) : null;
    const precioMax = Number(ruta.precio_max) > 0 ? Number(ruta.precio_max) : null;
    // /desde-5-millones, /desde-30-mil
    const precioMin = Number(ruta.precio_min) > 0 ? Number(ruta.precio_min) : null;
    // Una búsqueda sin ruta propia (?precio_min=...&recamaras=...) puede
    // traer varios a la vez: "con 3 Recámaras de $2M a $5M".
    const rango =
      precioMin && precioMax
        ? ` de ${precioCorto(precioMin, opSlug)} a ${precioCorto(precioMax, opSlug)}`
        : null;
    const filtroTitulo =
      (recamaras
        ? ` con ${recamaras} ${recamaras === 1 ? "Recámara" : "Recámaras"}`
        : "") +
      (rango ??
        (precioMax
          ? ` hasta ${precioCorto(precioMax, opSlug)}`
          : precioMin
            ? ` desde ${precioCorto(precioMin, opSlug)}`
            : ""));
    const filtroTexto =
      (recamaras
        ? ` con ${recamaras} ${recamaras === 1 ? "recámara" : "recámaras"}`
        : "") +
      (rango ??
        (precioMax
          ? ` de hasta ${precioCorto(precioMax, opSlug)}`
          : precioMin
            ? ` desde ${precioCorto(precioMin, opSlug)}`
            : ""));

    const total = Number(
      props?.total || ruta[config.BUBBLE.API_CAMPO_TOTAL] || 0,
    );
    // Muy poco contenido (1 o 2 propiedades): se ve, pero sin indexar.
    // 0 es "no se sabe" (Bubble no respondió): ahí no se toca.
    const pocas = total > 0 && total < config.BUBBLE.SITEMAP_MIN_PROPIEDADES;
    const sustantivo = tipo
      ? (total === 1 ? tipo : tipoPlural).toLowerCase()
      : total === 1
        ? "propiedad"
        : "propiedades";
    // Precio "desde". Bubble lo guarda en cada ruta (actualizar_total_ruta):
    // precio_desde_venta (venta y preventa) y precio_desde_renta. Con una
    // operación se usa el mínimo que el Worker acaba de leer y, si no lo hay
    // (rutas municipio-, fraccionamiento o Bubble sin responder), el de la
    // ruta. En rutas de venta y renta juntas va el de venta; si la ruta solo
    // tiene rentas, el de renta.
    const numeroRuta = (campo) => {
      const n = Number(ruta[campo]);
      return n > 0 ? n : null;
    };
    const ventaRuta = numeroRuta("precio_desde_venta");
    const rentaRuta = numeroRuta("precio_desde_renta");
    const opPrecio =
      opSlug ?? (ventaRuta ? "venta" : rentaRuta ? "renta" : null);
    const minimo = opSlug
      ? (props?.desde ?? (opSlug === "renta" ? rentaRuta : ventaRuta))
      : (ventaRuta ?? rentaRuta);

    // Título: "48 Casas en Venta en Colorines, San Pedro desde $9M | DotCasa".
    // Conteo real + tipo + operación + lugar + precio mínimo. Si no cabe se
    // prueba con el lugar más corto (sin estado, ciudad corta, sin ciudad) y
    // luego sin el precio. Sin conteo se usa el título de la ruta de Bubble.
    const corta = ciudadCorta(ruta.ciudad, ciudad);
    const lugares = [
      ...new Set(
        colonia
          ? [`${colonia}, ${ciudad}`, `${colonia}, ${corta}`, colonia]
          : ciudad
            ? [`${ciudad}, ${estado}`, ciudad, corta]
            : estado
              ? [estado]
              : cp
                ? [`CP ${cp}`]
                : ["México"],
      ),
    ];
    // En rutas mixtas "en Venta y Renta" se puede omitir para que entre el precio.
    const opsTitulo = op
      ? [` en ${mayusculaInicial(op)}`]
      : [" en Venta y Renta", ""];
    const desdeTitulo = minimo
      ? ` desde ${precioCorto(minimo, opPrecio)}`
      : "";
    // Renta en corto si hace falta para que entre el precio: "$12K/mes"
    const desdeCompacto = minimo
      ? ` desde ${precioCorto(minimo, opPrecio, { compacto: true })}`
      : "";
    // Una búsqueda con filtros sin resultados va sin número:
    // "Quintas en Venta desde $90M en México".
    const sinMarca = (o, l, d) =>
      `${total > 0 ? total.toLocaleString("en-US") + " " : ""}${mayusculaInicial(sustantivo)}${o}${filtroTitulo} en ${l}${d}`;
    const variantes = (d, marca) =>
      opsTitulo.flatMap((o) =>
        lugares.map((l) => sinMarca(o, l, d) + (marca ? " | DotCasa" : "")),
      );
    // El precio es lo último que se quita: antes se acorta el lugar, la
    // operación (en mixtas), la renta ($12K/mes) y la marca.
    const conConteo =
      total > 0 || filtroTitulo
        ? mejorTitulo(
            minimo && !precioMax && !precioMin && exacto
              ? [
                  ...variantes(desdeTitulo, true),
                  ...variantes(desdeCompacto, true),
                  ...variantes(desdeCompacto, false),
                  ...variantes("", true),
                ]
              : variantes("", true),
          )
        : null;
    const base = (
      limpio(ruta.titulo_seo) ?? `${tipoPlural ?? "Propiedades"}${enOp}${lugar}`
    ).replace(/\s*\|\s*DotCasa\s*$/i, "");
    const titulo = conConteo ?? `${base} | DotCasa`;
    // H1: el título sin la marca. Sin conteo, el H1 de la ruta de Bubble.
    const h1 = conConteo
      ? conConteo.replace(/\s*\|\s*DotCasa$/, "")
      : (limpio(ruta.h1) ?? `${tipoPlural ?? "Propiedades"}${enOp}${lugar}`);
    const intro = limpio(ruta.texto_intro);

    // "Encuentra 48 casas en venta en Colorines, San Pedro Garza García.
    // Precios desde $9M. Fotos, ubicación y contacto directo por WhatsApp."
    // Si no cabe en 155 se acorta el lugar antes de cortar el texto.
    const lugaresDescripcion = [
      ...new Set([lugar, ...lugares.map((l) => ` en ${l}`)]),
    ];
    const describir = (l) =>
      `Encuentra ${total.toLocaleString("en-US")} ${sustantivo}${enOp}${filtroTexto}${l}.` +
      (minimo && !precioMin && exacto
        ? ` Precios desde ${precioCorto(minimo, opPrecio)}.`
        : "") +
      " Fotos, ubicación y contacto directo por WhatsApp.";
    const metaDescripcion = recortar(
      total
        ? (lugaresDescripcion
            .map(describir)
            .find((t) => t.length <= LIMITE_DESCRIPCION) ??
            describir(lugaresDescripcion.at(-1)))
        : (limpio(ruta.descripcion_seo) ??
            `${h1}. Fotos, ubicación y contacto directo por WhatsApp.`),
    );

    // Migas: las que guarda la ruta (breadcrumb_json); si no sirven, ninguna
    let migas = [];
    try {
      const b = JSON.parse(ruta.breadcrumb_json ?? "");
      migas = (b.itemListElement ?? [])
        .filter((i) => i?.name && i?.item)
        .map((i) => [
          String(i.name),
          String(i.item),
          fotoPrincipal({ URL_Fotografia_lugar: i.image }),
        ]);
    } catch (e) {}
    if (!migas.length) migas = migasDeRuta(ruta, { estado, ciudad, colonia });

    const fichas = (props?.lista ?? [])
      .map((p) => {
        const r = SitemapRoute.canonica(
          urlFicha(p) ?? p.URL_publica ?? p.url_publica,
        );
        if (!r) return null;
        const t = limpio(p.Tipo_de_inmueble) ?? tipo ?? "Propiedad";
        const o = limpio(p.Tipo_de_operacion)?.toLowerCase() ?? op ?? "";
        const donde = [limpio(p.Colonia), limpio(p.Ciudad)]
          .filter(Boolean)
          .join(", ");
        const precio = Number(p.Precio) > 0 ? ` · ${pesos(p.Precio)}` : "";
        return {
          url: "https://" + config.DOMINIO + r,
          ruta: r,
          nombre: `${t} en ${o}${donde ? " en " + donde : ""}`,
          texto: `${t} en ${o}${donde ? " en " + donde : ""}${precio}`,
          imagen: fotoPrincipal(p),
        };
      })
      .filter(Boolean);

    // Miniatura del listado (og:image, twitter:image y primaryImageOfPage):
    // la foto principal de la primera propiedad que tenga foto. Las
    // propiedades vienen ordenadas por fecha, así que es la más reciente.
    // Primero la que Bubble guarda en la ruta (thumbnail: primera foto de
    // la primera propiedad de la ruta, ver actualizar_total_ruta).
    const conFoto = fichas.find((f) => f.imagen);
    const deRuta = fotoPrincipal({ URL_Fotografia_lugar: ruta.thumbnail });
    const imagen = deRuta ?? conFoto?.imagen ?? null;
    const imagenAlt = imagen
      ? deRuta || !conFoto
        ? h1
        : `${h1} · ${conFoto.nombre}`
      : null;
    // La miga de la página actual lleva la miniatura (Bubble la guarda en
    // breadcrumb_json; si no la trae, la de arriba).
    if (imagen && migas.length && !migas.at(-1)[2]) migas.at(-1)[2] = imagen;

    const cabeza = [
      migas.length &&
        jsonLd({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: migas.map(([name, item, image], i) => ({
            "@type": "ListItem",
            position: i + 1,
            name,
            item,
            ...(image ? { image } : {}),
          })),
        }),
      fichas.length &&
        jsonLd({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: h1,
          url: canonica,
          numberOfItems: total,
          itemListElement: fichas.map((f, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: f.url,
            name: f.nombre,
            ...(f.imagen ? { image: f.imagen } : {}),
          })),
        }),
      imagen &&
        jsonLd({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: h1,
          url: canonica,
          primaryImageOfPage: {
            "@type": "ImageObject",
            url: imagen,
            caption: imagenAlt,
          },
          thumbnailUrl: imagen,
        }),
      // Rutas con pocas propiedades: Bubble las marca indexable = no; por si
      // la marca va atrasada, aquí también con menos de
      // SITEMAP_MIN_PROPIEDADES (la misma regla del sitemap).
      (ruta.indexable === false || pocas) &&
        `<meta name="robots" content="noindex, follow">`,
    ]
      .filter(Boolean)
      .join("");

    // Bloque al final del body: ruta de navegación, H1 e intro. La lista de
    // fichas ("Hay N casas... · Se muestran 24 de N") ya no se pinta; las
    // fichas siguen en el schema ItemList de la cabeza y en el sitemap.
    const link = 'style="color:#0089f1;text-decoration:none"';
    const cuerpo =
      `<section id="dotcasa-listado" style="max-width:1080px;margin:32px auto;padding:0 16px 32px;font-family:Raleway,system-ui,sans-serif;color:#1c2a36;line-height:1.6">` +
      (migas.length
        ? `<nav aria-label="Ruta de navegación" style="font-size:13px;color:#4a5b6e">` +
          migas
            .map(([n, item], i) =>
              i === migas.length - 1
                ? `<span>${escaparHtml(n)}</span>`
                : `<a href="${escaparHtml(new URL(item).pathname)}" ${link}>${escaparHtml(n)}</a>`,
            )
            .join(` <span style="color:#9aa5b1">›</span> `) +
          `</nav>`
        : "") +
      // En el HTML inicial va como H1. Cuando el navegador ejecuta la página,
      // Bubble dibuja su propio H1 arriba (Current page's ruta's h1) y el
      // script de abajo convierte este en h2 para que no haya dos.
      `<h1 data-arriba style="font-size:20px;margin:8px 0">${escaparHtml(h1)}</h1>` +
      (intro
        ? `<p data-arriba style="margin:0 0 8px">${escaparHtml(intro)}</p>`
        : "") +
      `</section>` +
      // En el navegador el bloque, agregado al final del body, se pinta
      // encimado con la página de Bubble. Se oculta al cargar, se le quitan el
      // H1 y la intro (la página buscador ya los muestra arriba, en la tarjeta
      // de "¡Tenemos N propiedades!": Current page's ruta's h1 / texto_intro) y,
      // cuando Bubble dibuja la página, se mueve al elemento "HTML lugar bloque
      // SEO" (<div id="dotcasa-listado-slot">, debajo de la lista de
      // propiedades). La ruta de navegación (nav) va aparte, arriba de la
      // tarjeta "¡Tenemos N propiedades!", en "HTML lugar migas SEO"
      // (<div id="dotcasa-migas-slot">). Si en 10 s no aparece el lugar de
      // abajo, el bloque se queda oculto.
      // Quien no ejecuta JavaScript lo ve completo en el HTML.
      `<script>(function(){var s=document.getElementById("dotcasa-listado");if(!s)return;s.style.display="none";s.querySelectorAll("[data-arriba]").forEach(function(e){e.remove()});var m=s.querySelector("nav"),t=0,i=setInterval(function(){var a=document.getElementById("dotcasa-migas-slot"),p=document.getElementById("dotcasa-listado-slot");if(m&&a){a.appendChild(m);m=null}if(p){clearInterval(i);p.appendChild(s);s.style.margin="0";s.style.padding="8px 0 24px";s.style.maxWidth="none";s.style.display=""}else if(++t>100){clearInterval(i)}},100)})()</script>`;

    return {
      titulo,
      metaDescripcion,
      cabeza,
      cuerpo,
      exacto,
      imagen,
      imagenAlt,
    };
  },

  inyectar(res, d) {
    let hayTitulo = false;
    let hayDescripcion = false;
    // Meta de imagen que ya trae Bubble (la imagen genérica de la app): se
    // cambia por la del listado; las que falten se agregan al final del head.
    const hay = {};
    const imagen = (clave) => ({
      element: (e) => {
        hay[clave] = true;
        if (clave === "twitter:card") e.setAttribute("content", "summary_large_image");
        else if (clave.endsWith(":alt")) e.setAttribute("content", d.imagenAlt ?? "");
        else e.setAttribute("content", d.imagen);
      },
    });
    const metasImagen = () =>
      [
        ["og:image", "property", d.imagen],
        ["og:image:secure_url", "property", d.imagen],
        ["og:image:alt", "property", d.imagenAlt],
        ["twitter:card", "name", "summary_large_image"],
        ["twitter:image", "name", d.imagen],
        ["twitter:image:alt", "name", d.imagenAlt],
      ]
        .filter(([clave, , valor]) => valor && !hay[clave])
        .map(
          ([clave, attr, valor]) =>
            `<meta ${attr}="${clave}" content="${escaparHtml(valor)}">`,
        )
        .join("");
    let rw = new HTMLRewriter();
    if (d.imagen)
      for (const [sel, clave] of [
        ['meta[property="og:image"]', "og:image"],
        ['meta[property="og:image:secure_url"]', "og:image:secure_url"],
        ['meta[property="og:image:alt"]', "og:image:alt"],
        ['meta[name="twitter:card"]', "twitter:card"],
        ['meta[name="twitter:image"], meta[property="twitter:image"]', "twitter:image"],
        ['meta[name="twitter:image:alt"]', "twitter:image:alt"],
      ])
        rw = rw.on(sel, imagen(clave));
    // Bubble a veces trae ancho/alto de su imagen genérica: ya no aplican
    if (d.imagen)
      rw = rw.on(
        'meta[property="og:image:width"], meta[property="og:image:height"]',
        { element: (e) => e.remove() },
      );
    return rw
      .on("title", {
        element: (e) => {
          hayTitulo = true;
          e.setInnerContent(d.titulo);
        },
      })
      .on('meta[name="description"]', {
        element: (e) => {
          hayDescripcion = true;
          e.setAttribute("content", d.metaDescripcion);
        },
      })
      .on('meta[property="og:title"], meta[name="twitter:title"]', {
        element: (e) => e.setAttribute("content", d.titulo),
      })
      .on('meta[property="og:description"], meta[name="twitter:description"]', {
        element: (e) => e.setAttribute("content", d.metaDescripcion),
      })
      .on("head", {
        element: (e) => {
          e.onEndTag((fin) => {
            if (!hayTitulo)
              fin.before(`<title>${escaparHtml(d.titulo)}</title>`, {
                html: true,
              });
            if (!hayDescripcion)
              fin.before(
                `<meta name="description" content="${escaparHtml(d.metaDescripcion)}">`,
                { html: true },
              );
            fin.before(
              (d.imagen ? metasImagen() : "") +
                d.cabeza +
                fijarTitulo(d.titulo, { exacto: d.exacto !== false }),
              { html: true },
            );
          });
        },
      })
      .on("body", { element: (e) => e.append(d.cuerpo, { html: true }) })
      .transform(res);
  },
};
