import { BRUMA } from "./bruma";
import { GENERAL } from "./general";
import type { Plantilla } from "./tipos";

/** 068 — Las plantillas disponibles. Bienes raíces llega cuando el motor esté probado (spec §9). */
export const PLANTILLAS: readonly Plantilla[] = [GENERAL, BRUMA];

/** Las que se ofrecen en el setup: las demo solo si `PLANTILLAS_DEMO`. */
export function plantillasOfrecidas(conDemo: boolean): Plantilla[] {
  return PLANTILLAS.filter((p) => conDemo || !p.demo);
}

export function plantillaPorClave(clave: string): Plantilla | null {
  return PLANTILLAS.find((p) => p.clave === clave) ?? null;
}
