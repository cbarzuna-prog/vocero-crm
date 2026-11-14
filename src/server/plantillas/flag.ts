/**
 * 068 (fork · Hiyou) — Motor de plantillas de negocio.
 *
 * `PLANTILLAS` enciende el setup por giro, la ficha dinámica, los registros
 * vinculados y las sugerencias de la IA. Apagada, su superficie responde 404
 * y todo queda como hoy (garantía para Knock Knock). `PLANTILLAS_DEMO`
 * además muestra las plantillas de negocios inventados (Estudio Bruma), solo
 * para el sandbox.
 */

const ON_VALUES = new Set(["on", "1", "true", "si", "sí", "yes"]);

export function parseFlag(raw: string | undefined): boolean {
  return ON_VALUES.has((raw ?? "").trim().toLowerCase());
}

export function plantillasEnabled(): boolean {
  return parseFlag(process.env.PLANTILLAS);
}

export function plantillasDemoEnabled(): boolean {
  return plantillasEnabled() && parseFlag(process.env.PLANTILLAS_DEMO);
}

export function plantillasDisabledResponse(): Response {
  return new Response(null, { status: 404 });
}
