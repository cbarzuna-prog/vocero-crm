import { apiError } from "@/lib/api";
import { propiedadesEnabled } from "@/server/propiedades/flag";
import { tareasEnabled } from "@/server/tareas/flag";

/**
 * Fork Knock Knock — ¿Esta instancia corre los módulos del fork? Lo que no
 * tiene bandera propia (equipo, la lista de Contactos, la página del
 * contacto) viaja con `TAREAS` o `PROPIEDADES`: con ambas apagadas, todo es
 * como en upstream y estas rutas dan 404.
 */
export function forkActivo(): boolean {
  return tareasEnabled() || propiedadesEnabled();
}

export function forkApagadoResponse(): Response {
  return apiError(404, "not_found", "No encontrado");
}
