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

// Textos que la página de inicio ya muestra en Bubble (portada, guía y
// preguntas frecuentes). Se copian tal cual para que los buscadores y las IA
// que no ejecutan JavaScript lean el mismo contenido que ve el visitante.
const CONTENIDO = {
  titulo: "Encuentra el lugar que buscas",
  subtitulo:
    "Explora las mejores propiedades del país. Tu nuevo hogar está a un clic de distancia.",
  guia: {
    titulo: "Busca, compra, renta y publica propiedades con DotCasa",
    parrafos: [
      "DotCasa te ayuda a buscar un hogar o un espacio para tu siguiente proyecto con una experiencia pensada para las distintas etapas de tu búsqueda. Puedes explorar propiedades para comprar o rentar en Monterrey y San Pedro Garza García, así como consultar opciones en Guadalajara, Querétaro, Mérida y Ciudad de México. Antes de decidir, compara la ubicación, el tipo de inmueble y las características que importan para tu vida diaria: cercanía al trabajo, espacios para tu familia o acceso a los servicios que necesitas. Así puedes organizar tus prioridades y avanzar con mayor claridad.",
      "La búsqueda con inteligencia artificial permite expresar lo que estás buscando de forma natural y descubrir opciones relacionadas con tus necesidades. Puedes describir la zona que te interesa, las características de una casa o departamento y el tipo de operación que deseas realizar. Complementa esa búsqueda revisando las fotografías y la información de cada publicación. DotCasa también reúne inmobiliarias verificadas para facilitar el contacto con quienes anuncian los inmuebles. Conversar directamente con el responsable te permite resolver dudas, confirmar disponibilidad y coordinar una visita antes de tomar una decisión.",
      "Si quieres publicar una propiedad, DotCasa ofrece un punto de encuentro entre particulares, inmobiliarias y personas interesadas en comprar o rentar. Una publicación clara, con fotografías y una descripción precisa del inmueble y su entorno, ayuda a comunicar lo que hace especial a cada espacio. DotCasa no cobra comisiones por la venta o renta de una propiedad; los términos de la operación se acuerdan entre las partes involucradas. Tanto si empiezas a buscar como si deseas dar visibilidad a un anuncio, puedes utilizar la plataforma para acercarte a tu próximo movimiento inmobiliario.",
    ],
  },
  preguntas: [
    [
      "¿Cuánto cuesta publicar propiedades en DotCasa?",
      "DotCasa ofrece planes flexibles desde $1900 MXN por propiedad activa al mes, con descuentos conforme aumenta el volumen de publicaciones.",
    ],
    [
      "¿Puedo publicar propiedades si soy particular o solo para inmobiliarias?",
      "Sí. Los particulares también pueden publicar de forma individual. Sin embargo, nuestros planes están optimizados para inmobiliarias y desarrolladores que buscan administrar múltiples propiedades y obtener leads de calidad.",
    ],
    [
      "¿Cómo funciona la búsqueda con inteligencia artificial en DotCasa?",
      "El usuario describe en lenguaje natural lo que busca (ej. “departamento con terraza en Polanco, 2 recámaras, hasta $25,000 de renta”) y nuestra IA filtra miles de opciones para mostrar las más relevantes de forma inmediata.",
    ],
    [
      "¿Cómo reciben mis agentes los leads o contactos de los interesados?",
      "Cada contacto se envía en tiempo real vía WhatsApp y correo. Además, queda registrado en tu panel de DotCasa, donde podrás gestionarlos, clasificarlos y darles seguimiento con tu equipo.",
    ],
    [
      "¿Cómo funciona el panel de métricas y qué datos me muestra?",
      "El dashboard muestra estadísticas clave: impresiones, clics, leads recibidos, tasa de respuesta, costo por lead y desempeño de cada propiedad. Todo en tiempo real, con reportes exportables.",
    ],
    [
      "¿Puedo integrar mis propiedades automáticamente (CSV, CRM o API)?",
      "Sí. Ofrecemos carga masiva por archivo CSV, integración con CRMs inmobiliarios y API para actualizaciones automáticas, ideal para desarrolladores con grandes volúmenes.",
    ],
    [
      "¿DotCasa cobra alguna comisión por la venta o renta de una propiedad?",
      "No. DotCasa funciona con un modelo de suscripción mensual. Todo lo que vendas o rentes es 100% tuyo, sin comisiones ni cargos ocultos.",
    ],
  ],
};

const escaparHtml = (t) =>
  String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Bloque para quien no ejecuta JavaScript. El script lo quita al instante en
// el navegador, donde Bubble dibuja su propia página con los mismos textos.
const cuerpo = () =>
  `<div id="dotcasa-inicio">` +
  `<h1>${escaparHtml(CONTENIDO.titulo)}</h1>` +
  `<p>${escaparHtml(CONTENIDO.subtitulo)}</p>` +
  `<h2>${escaparHtml(CONTENIDO.guia.titulo)}</h2>` +
  CONTENIDO.guia.parrafos.map((t) => `<p>${escaparHtml(t)}</p>`).join("") +
  `<h2>Preguntas frecuentes</h2>` +
  CONTENIDO.preguntas
    .map(([p, r]) => `<h3>${escaparHtml(p)}</h3><p>${escaparHtml(r)}</p>`)
    .join("") +
  `</div><script>document.getElementById("dotcasa-inicio").remove()</script>`;

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
      {
        "@type": "FAQPage",
        "@id": sitio + "#preguntas",
        mainEntity: CONTENIDO.preguntas.map(([p, r]) => ({
          "@type": "Question",
          name: p,
          acceptedAnswer: { "@type": "Answer", text: r },
        })),
      },
    ],
  };
};

export const InicioSeo = {
  // Agrega el esquema del negocio (RealEstateAgent + WebSite + FAQPage) al
  // <head> del inicio y sus textos al <body>. Bubble los dibuja con JS, así
  // que el Worker los pone en el HTML.
  inyectar(res) {
    const tipo = res.headers.get("Content-Type") || "";
    if (res.status !== 200 || !tipo.startsWith("text/html")) return res;
    const bloque = `<script type="application/ld+json">${JSON.stringify(esquema()).replace(/</g, "\\u003c")}</script>`;
    return new HTMLRewriter()
      .on("head", { element: (e) => e.append(bloque, { html: true }) })
      .on("body", { element: (e) => e.prepend(cuerpo(), { html: true }) })
      .transform(res);
  },
};
