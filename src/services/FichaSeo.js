import { config } from "../controllers/config/config.js";

// Bubble dibuja la página con JavaScript, así que el HTML que reciben los
// buscadores y las IAs llega sin título, sin H1 y sin texto. Aquí escribimos
// esos datos de la propiedad directo en el HTML de la ficha.

const TIPOS = {
  casa: ["Casa", "Casas", "House"],
  departamento: ["Departamento", "Departamentos", "Apartment"],
  terreno: ["Terreno", "Terrenos", "Accommodation"],
  rancho: ["Rancho", "Ranchos", "House"],
  cabana: ["Cabaña", "Cabañas", "House"],
  quinta: ["Quinta", "Quintas", "House"],
  oficina: ["Oficina", "Oficinas", "Accommodation"],
  "local-comercial": [
    "Local comercial",
    "Locales comerciales",
    "Accommodation",
  ],
  "bodega-comercial": [
    "Bodega comercial",
    "Bodegas comerciales",
    "Accommodation",
  ],
  "nave-industrial": ["Nave industrial", "Naves industriales", "Accommodation"],
  "bodega-industrial": [
    "Bodega industrial",
    "Bodegas industriales",
    "Accommodation",
  ],
  edificio: ["Edificio", "Edificios", "Accommodation"],
};

const OPERACIONES = { venta: "Venta", renta: "Renta", preventa: "Preventa" };

const escaparHtml = (t) =>
  String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const jsonLd = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

// "los-rodriguez" -> "Los Rodriguez" (solo si Bubble no trae el nombre)
const desdeSlug = (s) =>
  s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Lee un campo de la propiedad sin depender de mayúsculas, guiones o "^"
// (M^2_Construccion, m2_construccion y M2 Construccion son el mismo campo).
const lector = (prop) => {
  const mapa = {};
  for (const [k, v] of Object.entries(prop))
    mapa[k.toLowerCase().replace(/[^a-z0-9]/g, "")] = v;
  const texto = (...nombres) => {
    for (const n of nombres) {
      const v = mapa[n.toLowerCase().replace(/[^a-z0-9]/g, "")];
      // Un campo que liga a otra cosa en Bubble llega como id ("123x456"), no sirve
      if (typeof v === "string" && v.trim() && !/^\d+x\d+$/.test(v.trim()))
        return v.trim();
    }
    return null;
  };
  const numero = (...nombres) => {
    for (const n of nombres) {
      const v = Number(mapa[n.toLowerCase().replace(/[^a-z0-9]/g, "")]);
      if (Number.isFinite(v) && v > 0) return v;
    }
    return null;
  };
  // Latitud y longitud pueden ser negativas
  const coordenada = (nombre) => {
    const v = Number(mapa[nombre.toLowerCase().replace(/[^a-z0-9]/g, "")]);
    return Number.isFinite(v) && v !== 0 ? v : null;
  };
  const fotos = (...nombres) => {
    for (const n of nombres) {
      const v = mapa[n.toLowerCase().replace(/[^a-z0-9]/g, "")];
      const lista = (Array.isArray(v) ? v : [v]).filter(
        (u) => typeof u === "string" && u.trim(),
      );
      if (lista.length)
        return lista
          .slice(0, 10)
          .map((u) => (u.startsWith("//") ? "https:" + u : u));
    }
    return [];
  };
  return { texto, numero, coordenada, fotos };
};

export const FichaSeo = {
  // norm: segmentos de la URL ya normalizados (tipo, operación, estado, ciudad,
  // colonia, slug). canonica: URL pública completa de la ficha.
  datos(prop, norm, canonica) {
    const { texto, numero, coordenada, fotos } = lector(prop);
    const [tipoSlug, opSlug, estadoSlug, ciudadSlug, coloniaSlug] = norm;
    const [tipo, tipoPlural, tipoSchema] = TIPOS[tipoSlug];
    const operacion = OPERACIONES[opSlug] ?? desdeSlug(opSlug);
    const estado = texto("Estado") ?? desdeSlug(estadoSlug);
    const ciudad = texto("Ciudad", "Municipio") ?? desdeSlug(ciudadSlug);
    const colonia = texto("Colonia") ?? desdeSlug(coloniaSlug);

    const precio = numero("Precio");
    const recamaras = numero("N_Habitaciones", "Recamaras");
    const banos = numero("N_Banos", "Banos");
    const construccion = numero("M^2_Construccion", "M2_Construccion");
    const terreno = numero("M^2_Terreno", "M2_Terreno");
    const antiguedad = numero("Antiguedad");
    const descripcion = texto("Descripcion");
    const estatus = texto("Estatus") ?? "Activo";
    const lat = coordenada("Latitud");
    const lng = coordenada("Longitud");
    const imagenes = fotos("URL_Fotografia_lugar", "Fotos", "Fotografias");

    const precioTexto = precio
      ? "$" + Math.round(precio).toLocaleString("en-US")
      : null;
    const encabezado = `${tipo} en ${operacion.toLowerCase()} en ${colonia}, ${ciudad}`;
    // Google corta el título cerca de los 60 caracteres: el precio solo entra
    // si cabe; si no, va en la descripción.
    const conPrecio = `${encabezado} · ${precioTexto} | DotCasa`;
    const titulo =
      precioTexto && conPrecio.length <= 60
        ? conPrecio
        : `${encabezado} | DotCasa`;

    const medidas = [
      recamaras && `${recamaras} recámaras`,
      banos && `${banos} baños`,
      construccion &&
        `${construccion.toLocaleString("en-US")} m² de construcción`,
      terreno && `${terreno.toLocaleString("en-US")} m² de terreno`,
      antiguedad && `${antiguedad} años de antigüedad`,
    ].filter(Boolean);
    const caracteristicas = [
      precioTexto && `Precio: ${precioTexto} MXN`,
      ...medidas,
    ].filter(Boolean);

    const resumen =
      `${encabezado}, ${estado}` +
      (precioTexto ? ` por ${precioTexto}` : "") +
      (medidas.length ? `: ${medidas.join(", ")}` : "") +
      ". Fotos, precio y contacto en DotCasa.";
    const metaDescripcion =
      resumen.length > 160 ? resumen.slice(0, 157).trimEnd() + "..." : resumen;

    const base = "https://" + config.DOMINIO;
    const migas = [
      [tipoPlural, `/${tipoSlug}`],
      [operacion, `/${tipoSlug}/${opSlug}`],
      [estado, `/${tipoSlug}/${opSlug}/${estadoSlug}`],
      [ciudad, `/${tipoSlug}/${opSlug}/${estadoSlug}/${ciudadSlug}`],
      [
        colonia,
        `/${tipoSlug}/${opSlug}/${estadoSlug}/${ciudadSlug}/${coloniaSlug}`,
      ],
    ];

    const about = { "@type": tipoSchema };
    if (recamaras) about.numberOfRooms = recamaras;
    if (banos) about.numberOfBathroomsTotal = banos;
    if (construccion)
      about.floorSize = {
        "@type": "QuantitativeValue",
        value: construccion,
        unitCode: "MTK",
      };
    about.address = {
      "@type": "PostalAddress",
      addressLocality: ciudad,
      addressRegion: estado,
      addressCountry: "MX",
    };
    const cp = texto("Codigo_postal");
    if (cp) about.address.postalCode = cp;
    if (lat && lng)
      about.geo = { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
    const extras = [
      terreno && {
        "@type": "PropertyValue",
        name: "Terreno",
        value: terreno,
        unitCode: "MTK",
      },
      antiguedad && {
        "@type": "PropertyValue",
        name: "Antigüedad",
        value: antiguedad,
        unitText: "años",
      },
    ].filter(Boolean);
    if (extras.length) about.additionalProperty = extras;

    const listado = {
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      url: canonica,
      name: encabezado,
      inLanguage: "es-MX",
      about,
    };
    if (descripcion) listado.description = descripcion;
    if (imagenes.length) listado.image = imagenes;
    const creada = texto("Created Date");
    if (creada) listado.datePosted = creada.slice(0, 10);
    const modificada = texto("Modified Date");
    if (modificada) listado.dateModified = modificada.slice(0, 10);
    if (precio)
      listado.offers = {
        "@type": "Offer",
        price: precio,
        priceCurrency: "MXN",
        availability:
          "https://schema.org/" +
          (estatus === "Inactivo"
            ? "SoldOut"
            : opSlug === "preventa"
              ? "PreOrder"
              : "InStock"),
        businessFunction:
          "http://purl.org/goodrelations/v1#" +
          (opSlug === "renta" ? "LeaseOut" : "Sell"),
      };

    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: migas.map(([name, ruta], i) => ({
        "@type": "ListItem",
        position: i + 1,
        name,
        item: base + ruta,
      })),
    };

    const op = operacion.toLowerCase();
    // Solo rutas tipo + operación, que Bubble ya crea para cada propiedad
    const relacionadas = [
      [`Más ${tipoPlural.toLowerCase()} en ${op} en ${colonia}`, migas[4][1]],
      [`${tipoPlural} en ${op} en ${ciudad}`, migas[3][1]],
    ];

    // Bloque para quien no ejecuta JavaScript. El script lo quita al
    // instante en el navegador, donde Bubble dibuja su propia página.
    const cuerpo =
      `<div id="dotcasa-ficha">` +
      `<nav>${migas.map(([n, r]) => `<a href="${escaparHtml(r)}">${escaparHtml(n)}</a>`).join(" › ")}</nav>` +
      `<h1>${escaparHtml(encabezado)}</h1>` +
      (caracteristicas.length
        ? `<ul>${caracteristicas.map((c) => `<li>${escaparHtml(c)}</li>`).join("")}</ul>`
        : "") +
      (descripcion
        ? descripcion
            .split(/\n+/)
            .filter((l) => l.trim())
            .map((l) => `<p>${escaparHtml(l.trim())}</p>`)
            .join("")
        : "") +
      `<ul>${relacionadas.map(([n, r]) => `<li><a href="${escaparHtml(r)}">${escaparHtml(n)}</a></li>`).join("")}</ul>` +
      `</div><script>document.getElementById("dotcasa-ficha").remove()</script>`;

    return {
      titulo,
      metaDescripcion,
      imagen: imagenes[0] ?? null,
      cabeza: jsonLd(listado) + jsonLd(breadcrumb),
      cuerpo,
    };
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
      .on('meta[property="og:title"]', {
        element: (e) => e.setAttribute("content", d.titulo),
      })
      .on('meta[property="og:description"]', {
        element: (e) => e.setAttribute("content", d.metaDescripcion),
      })
      .on('meta[property="og:image"]', {
        element: (e) => d.imagen && e.setAttribute("content", d.imagen),
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
      .on("body", { element: (e) => e.prepend(d.cuerpo, { html: true }) })
      .transform(res);
  },
};
