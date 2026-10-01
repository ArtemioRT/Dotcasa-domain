import { AppRouter } from "./routes/AppRouter.route.js";
import { Logger } from "./services/utils/logger.js";

export default {
  async fetch(request, env, ctx) {
    try {
      return await AppRouter.route(request, env, ctx);
    } catch (error) {
      Logger.error(
        `Error interno del Worker procesando ${request.url}`,
        error.message,
      );
      return fetch(request);
    }
  },
};
