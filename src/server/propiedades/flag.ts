/**
 * 046 — Si esta instancia tiene el módulo `PROPIEDADES` o no.
 *
 * Mismo patrón que `AGENDA` (015, ADR-001): el código viaja siempre y lo que
 * decide si existe para el usuario es la variable de despliegue. Apagado, su
 * superficie responde 404 (no 403: en esta instancia ese endpoint no existe).
 * Se lee de `process.env` directo para que preguntar por la bandera no dependa
 * de que todo el entorno valide.
 */

const ON_VALUES = new Set(["on", "1", "true", "si", "sí", "yes"]);

export function parsePropiedadesFlag(raw: string | undefined): boolean {
  return ON_VALUES.has((raw ?? "").trim().toLowerCase());
}

export function propiedadesEnabled(): boolean {
  return parsePropiedadesFlag(process.env.PROPIEDADES);
}

export function propiedadesDisabledResponse(): Response {
  return new Response(null, { status: 404 });
}
