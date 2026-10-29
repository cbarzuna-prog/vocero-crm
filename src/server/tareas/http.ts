import { apiError } from "@/lib/api";
import type { TareaError } from "@/server/tareas/service";

/** Errores de dominio → respuesta HTTP (contrato api.md: `{ error: { code, message } }`). */
export function tareaErrorResponse(err: TareaError): Response {
  const status = err.code === "no_encontrada" ? 404 : 422;
  return apiError(status, err.code, err.message);
}
