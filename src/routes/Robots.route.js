import { config } from "../controllers/config/config.js";

// robots.txt de dotcasa.com.mx. Vive aquí (no en Bubble) para que quede en git
// y no dependa del origen. El de app.dotcasa.com.mx lo sirve Bubble y debe ser
// mínimo (User-agent: * / Allow: / / Disallow: /version-test/, sin Sitemap),
// para que Google pueda entrar y ver el noindex del origen.

// Buscadores y asistentes de IA (ChatGPT, Claude, Perplexity, Gemini, Copilot).
// Todos van en un solo grupo para que a todos les apliquen los mismos Disallow;
// User-agent: * ya los cubre, se listan para dejar explícito que sí pueden.
const BOTS = [
  "*",
  "Googlebot",
  "Bingbot",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
];

// Páginas privadas o de flujo (login, cuenta, edición) que no deben rastrearse.
const PRIVADAS = [
  "/version-test/",
  "/login",
  "/portal",
  "/cuenta",
  "/cuenta_inmobiliaria",
  "/bienvenida",
  "/bienvenida_agente",
  "/bienvenida_inmobiliaria",
  "/reset_pw",
  "/enviar_reseteo_contrasena",
  "/invitacion",
  "/desuscripcion",
  "/propiedad_editar",
  "/playround",
];

const texto = [
  ...BOTS.map((b) => `User-agent: ${b}`),
  "Allow: /",
  ...PRIVADAS.map((r) => `Disallow: ${r}`),
  "",
  `Sitemap: https://${config.DOMINIO}/sitemap.xml`,
  "",
].join("\n");

export const RobotsRoute = {
  handle() {
    return new Response(texto, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  },
};
