export const config = {
  // Dominio público oficial (sin www). www y http redirigen aquí.
  DOMINIO: "dotcasa.com.mx",
  // Host de Bubble (origen). Sus navegaciones hacen 301 al dominio público.
  APP_HOST: "app.dotcasa.com.mx",

  // Cliente OAuth de Google (público: va en el HTML de la página)
  GOOGLE_CLIENT_ID:
    "537943252829-606h45qkdh7cfpfl7cal98t7u99objnr.apps.googleusercontent.com",

  // Constantes de negocio
  TIPOS: new Set([
    "casa",
    "departamento",
    "terreno",
    "rancho",
    "cabana",
    "quinta",
    "oficina",
    "local-comercial",
    "bodega-comercial",
    "nave-industrial",
    "bodega-industrial",
    "edificio",
  ]),
  OPS: new Set(["venta", "renta", "preventa"]),
  ESTADOS: new Set([
    "aguascalientes",
    "baja-california",
    "baja-california-sur",
    "campeche",
    "chiapas",
    "chihuahua",
    "ciudad-de-mexico",
    "coahuila",
    "colima",
    "durango",
    "guanajuato",
    "guerrero",
    "hidalgo",
    "jalisco",
    "estado-de-mexico",
    "michoacan",
    "morelos",
    "nayarit",
    "nuevo-leon",
    "oaxaca",
    "puebla",
    "queretaro",
    "quintana-roo",
    "san-luis-potosi",
    "sinaloa",
    "sonora",
    "tabasco",
    "tamaulipas",
    "tlaxcala",
    "veracruz",
    "yucatan",
    "zacatecas",
  ]),
  CP_REGEX: /^\d{5}$/,

  // Plurales que la gente escribe o enlaza: 301 al singular, que es la URL
  // oficial (/casas/venta/... -> /casa/venta/...).
  PLURALES: {
    casas: "casa",
    departamentos: "departamento",
    terrenos: "terreno",
    ranchos: "rancho",
    cabanas: "cabana",
    quintas: "quinta",
    oficinas: "oficina",
    "locales-comerciales": "local-comercial",
    "bodegas-comerciales": "bodega-comercial",
    "naves-industriales": "nave-industrial",
    "bodegas-industriales": "bodega-industrial",
    edificios: "edificio",
  },

  // Colonias con dos nombres en los datos ("estado/ciudad/colonia": oficial).
  // La URL con el nombre de la izquierda hace 301 a la oficial. En Bubble hay
  // que cambiar la Colonia de esas propiedades al nombre oficial para que el
  // listado de la oficial las incluya.
  COLONIAS_IGUALES: {
    "nuevo-leon/monterrey/monterrey-centro": "centro",
    "nuevo-leon/san-pedro-garza-garcia/jardines-de-campestre":
      "jardines-del-campestre",
    "nuevo-leon/santa-catarina/pedregal-la-huasteca": "pedregal-de-la-huasteca",
    "nuevo-leon/monterrey/real-cumbres": "real-de-cumbres",
    "nuevo-leon/general-escobedo/puerta-del-norte-fraccionamiento-residencial":
      "puerta-del-norte-residencial",
  },

  // Páginas fijas de Bubble que van al sitemap (ruta exacta, tal cual)
  PAGINAS_ESTATICAS: [
    "/propiedades",
    "/acerca_de_nosotros",
    "/terminos_y_condiciones",
    "/politica_de_privacidad",
  ],

  // Configuración de Bubble Data API
  BUBBLE: {
    API_TIPO: "ruta",
    API_CAMPO_SLUG: "slug",
    API_CAMPO_TOTAL: "total_propiedades",
    CACHE_SEGUNDOS: 600,
    SITEMAP_MAX_PAGINAS: 50,
    // Rutas (listados) con menos propiedades que esto no van al sitemap
    SITEMAP_MIN_PROPIEDADES: 3,
    API_TIPO_PROP: "propiedades",
    API_CAMPO_SLUGTEXT: "Slug_text",
    // Precios de venta menores a esto se toman como mal capturados ("desde")
    PRECIO_MINIMO_VENTA: 100000,
  },
};
