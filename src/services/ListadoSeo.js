import { config } from "../controllers/config/config.js";
import { TIPOS, OPERACIONES } from "./FichaSeo.js";
import { urlFicha } from "./UrlFicha.js";
import { SitemapRoute } from "../routes/SiteMap.route.js";

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

const recortar = (t, max) =>
  t.length > max ? t.slice(0, max - 3).trimEnd() + "..." : t;

export const ListadoSeo = {
  // ruta: registro de Bubble. props: { lista, total, desde } o null.
  // canonica: URL pública completa del listado.
  datos(ruta, props, canonica) {
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

    const titulo =
      limpio(ruta.titulo_seo) ??
      `${tipoPlural ?? "Propiedades"}${enOp}${lugar} | DotCasa`;
    const h1 =
      limpio(ruta.h1) ?? `${tipoPlural ?? "Propiedades"}${enOp}${lugar}`;
    const intro = limpio(ruta.texto_intro);

    // "24 departamentos en renta en San Jerónimo, Monterrey desde $12,000 MXN"
    const total = props?.total ?? ruta[config.BUBBLE.API_CAMPO_TOTAL] ?? 0;
    const sustantivo = tipo
      ? (total === 1 ? tipo : tipoPlural).toLowerCase()
      : total === 1
        ? "propiedad"
        : "propiedades";
    const desde = props?.desde ? ` desde ${pesos(props.desde)} MXN` : "";
    const conteo = total
      ? `${total} ${sustantivo}${enOp}${lugar}${desde}`
      : null;

    const metaDescripcion = recortar(
      conteo
        ? `${conteo}. Fotos, precio y ubicación de cada propiedad en DotCasa.`
        : (limpio(ruta.descripcion_seo) ??
            `${h1}. Fotos, precio y ubicación en DotCasa.`),
      160,
    );

    // Migas: las que guarda la ruta (breadcrumb_json); si no sirven, ninguna
    let migas = [];
    try {
      const b = JSON.parse(ruta.breadcrumb_json ?? "");
      migas = (b.itemListElement ?? [])
        .filter((i) => i?.name && i?.item)
        .map((i) => [String(i.name), String(i.item)]);
    } catch (e) {}

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
        };
      })
      .filter(Boolean);

    const cabeza = [
      migas.length &&
        jsonLd({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: migas.map(([name, item], i) => ({
            "@type": "ListItem",
            position: i + 1,
            name,
            item,
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
          })),
        }),
      // Rutas con pocas propiedades: Bubble las marca indexable = no
      ruta.indexable === false &&
        `<meta name="robots" content="noindex, follow">`,
    ]
      .filter(Boolean)
      .join("");

    // Bloque visible al final de la página, en el HTML inicial (no se quita
    // con JavaScript: Google indexa la página ya dibujada).
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
      (conteo
        ? `<p style="margin:0 0 16px">Hay ${escaparHtml(conteo)}.</p>`
        : "") +
      (fichas.length
        ? `<ul style="margin:0;padding-left:20px;font-size:14px">` +
          fichas
            .map(
              (f) =>
                `<li><a href="${escaparHtml(f.ruta)}" ${link}>${escaparHtml(f.texto)}</a></li>`,
            )
            .join("") +
          `</ul>` +
          (total > fichas.length
            ? `<p style="font-size:13px;color:#4a5b6e;margin:8px 0 0">Se muestran ${fichas.length} de ${total}. Usa los filtros de arriba para ver el resto.</p>`
            : "")
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

    return { titulo, metaDescripcion, cabeza, cuerpo };
  },

  inyectar(res, d) {
    let hayTitulo = false;
    let hayDescripcion = false;
    return new HTMLRewriter()
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
            fin.before(d.cabeza, { html: true });
          });
        },
      })
      .on("body", { element: (e) => e.append(d.cuerpo, { html: true }) })
      .transform(res);
  },
};
