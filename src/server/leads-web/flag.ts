import { safeEqual } from "@/server/inbox/webhook";

/**
 * 054 — Si esta instancia recibe leads de la web (`LEADS_WEB`) y con qué URL
 * secreta. Mismo patrón que `PROPIEDADES` (046): se lee de `process.env`
 * directo y, apagada, la ruta responde 404.
 */

const ON_VALUES = new Set(["on", "1", "true", "si", "sí", "yes"]);

/** Largo mínimo del token: la URL es la única llave (D2). */
export const MIN_TOKEN_LENGTH = 32;

export function parseLeadsWebFlag(raw: string | undefined): boolean {
  return ON_VALUES.has((raw ?? "").trim().toLowerCase());
}

export function leadsWebEnabled(): boolean {
  return parseLeadsWebFlag(process.env.LEADS_WEB);
}

/** El segmento de la URL coincide con `WEB_LEADS_TOKEN` (y este es usable). */
export function isValidWebLeadsToken(segment: string, configured: string | undefined): boolean {
  const token = (configured ?? "").trim();
  if (token.length < MIN_TOKEN_LENGTH || token.startsWith("REEMPLAZA")) return false;
  return safeEqual(segment, token);
}
