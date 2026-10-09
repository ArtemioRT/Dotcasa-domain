import { config } from "../controllers/config/config.js";

// Datos del negocio para el esquema de la página de inicio. Lo que esté
// vacío no se publica.
const NEGOCIO = {
  nombre: "DotCasa",
  descripcion:
    "Portal inmobiliario con IA para comprar, vender y rentar casas, departamentos, terrenos y locales en Monterrey y su área metropolitana.",
  logo: "https://572b3ffc9793c4b4c15468dc316caa5c.cdn.bubble.io/f1773855403538x581530920122586000/DOTCADA%2520LOGO%2520AZUL%2520%2528HORIZONTAL%2529.webp",
  telefono: "+52 81 2381 1257",
  correo: "contacto@dotcasa.com.mx",
  // Ciudad donde está la empresa (sin calle, porque no hay oficina al público)
  ciudad: "San Pedro Garza García",
  estado: "Nuevo León",
  zonas: [
    "Monterrey",
    "San Pedro Garza García",
    "San Nicolás de los Garza",
    "Guadalupe",
    "Apodaca",
    "Santa Catarina",
    "General Escobedo",
    "García",
    "Santiago",
  ],
  // Perfiles oficiales de la marca
  perfiles: [
    "https://www.facebook.com/profile.php?id=61579010939616",
    "https://www.instagram.com/dotcasa.mx",
    "https://www.linkedin.com/company/dotcasa",
  ],
};

const esquema = () => {
  const sitio = "https://" + config.DOMINIO + "/";
  const negocio = {
    "@type": "RealEstateAgent",
    "@id": sitio + "#organizacion",
    name: NEGOCIO.nombre,
    url: sitio,
    logo: NEGOCIO.logo,
    image: NEGOCIO.logo,
    description: NEGOCIO.descripcion,
    address: {
      "@type": "PostalAddress",
      addressLocality: NEGOCIO.ciudad,
      addressRegion: NEGOCIO.estado,
      addressCountry: "MX",
    },
    areaServed: NEGOCIO.zonas.map((name) => ({ "@type": "City", name })),
  };
  if (NEGOCIO.telefono) negocio.telephone = NEGOCIO.telefono;
  if (NEGOCIO.correo) negocio.email = NEGOCIO.correo;
  if (NEGOCIO.perfiles.length) negocio.sameAs = NEGOCIO.perfiles;

  return {
    "@context": "https://schema.org",
    "@graph": [
      negocio,
      {
        "@type": "WebSite",
        "@id": sitio + "#sitio",
        url: sitio,
        name: NEGOCIO.nombre,
        inLanguage: "es-MX",
        publisher: { "@id": sitio + "#organizacion" },
      },
    ],
  };
};

export const InicioSeo = {
  // Agrega el esquema del negocio (RealEstateAgent + WebSite) al <head> del
  // inicio. Bubble lo dibuja con JS, así que el Worker lo pone en el HTML.
  inyectar(res) {
    const tipo = res.headers.get("Content-Type") || "";
    if (res.status !== 200 || !tipo.startsWith("text/html")) return res;
    const bloque = `<script type="application/ld+json">${JSON.stringify(esquema()).replace(/</g, "\\u003c")}</script>`;
    return new HTMLRewriter()
      .on("head", { element: (e) => e.append(bloque, { html: true }) })
      .transform(res);
  },
};
