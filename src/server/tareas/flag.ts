/**
 * 046 — Si esta instancia tiene el módulo `TAREAS` o no.
 *
 * Mismo patrón que `AGENDA` (015, ADR-001): el código viaja siempre y lo que
 * decide si existe para el usuario es la variable de despliegue. Apagado, su
 * superficie responde 404 (no 403: en esta instancia ese endpoint no existe).
 * Se lee de `process.env` directo para que preguntar por la bandera no dependa
 * de que todo el entorno valide.
 */

const ON_VALUES = new Set(["on", "1", "true", "si", "sí", "yes"]);

export function parseTareasFlag(raw: string | undefined): boolean {
  return ON_VALUES.has((raw ?? "").trim().toLowerCase());
}

export function tareasEnabled(): boolean {
  return parseTareasFlag(process.env.TAREAS);
}

export function tareasDisabledResponse(): Response {
  return new Response(null, { status: 404 });
}
