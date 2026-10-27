import { apiError } from "@/lib/api";
import { propiedadesEnabled } from "@/server/propiedades/flag";
import { tareasEnabled } from "@/server/tareas/flag";

/**
 * 054 (fork) — Gestión del equipo. No tiene bandera propia: viaja con los
 * módulos del fork (con ambos apagados, Ajustes → Equipo es el de upstream).
 */
export function equipoEnabled(): boolean {
  return tareasEnabled() || propiedadesEnabled();
}

export function equipoDisabledResponse(): Response {
  return apiError(404, "not_found", "No encontrado");
}
