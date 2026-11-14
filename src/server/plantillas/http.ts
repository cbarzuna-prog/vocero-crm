import { apiError } from "@/lib/api";
import { FichaError } from "./ficha";

/** 068 — Errores de la ficha a respuestas HTTP (mensajes en usted, listos para mostrar). */
export function respuestaFichaError(e: unknown): Response {
  if (e instanceof FichaError) {
    const status = e.code === "no_encontrado" ? 404 : e.code === "sin_plantilla" ? 409 : 422;
    return apiError(status, e.code, e.message);
  }
  throw e;
}
