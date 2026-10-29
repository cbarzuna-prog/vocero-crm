import { apiError } from "@/lib/api";
import { PropiedadError } from "./service";

/** Errores de dominio → HTTP (contrato api.md: `{ error: { code, message } }`). */
export function propiedadErrorResponse(err: unknown): Response | null {
  if (!(err instanceof PropiedadError)) return null;
  const status =
    err.code === "no_encontrada" ? 404 : err.code === "codigo_repetido" ? 409 : err.code === "foto_invalida" ? 415 : 422;
  return apiError(status, err.code, err.message);
}
