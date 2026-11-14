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

/** Lo que el setup muestra de cada plantilla (tarjeta del paso 1 y resumen del paso 3). */
export type ResumenPlantilla = {
  clave: string;
  nombre: string;
  descripcion: string;
  demo: boolean;
  etapas: string[];
  clientes: string;
  embudo: string;
  catalogo: string | null;
  serviciosCatalogo: number;
  camposDestacados: string[];
  alerta: { ambarMin: number; rojoMin: number } | null;
};

export function resumenPlantilla(p: Plantilla): ResumenPlantilla {
  const conTiempo = p.etapas.find((e) => e.ambarMin != null && e.rojoMin != null);
  return {
    clave: p.clave,
    nombre: p.nombre,
    descripcion: p.descripcion,
    demo: !!p.demo,
    etapas: p.etapas.filter((e) => e.tipo === "open").map((e) => e.nombre),
    clientes: p.vocabulario.clientes,
    embudo: p.vocabulario.embudo,
    catalogo: p.vocabulario.catalogo ?? null,
    serviciosCatalogo: p.catalogo?.length ?? 0,
    camposDestacados: p.campos.filter((c) => c.destacado).map((c) => c.etiqueta),
    alerta: conTiempo ? { ambarMin: conTiempo.ambarMin!, rojoMin: conTiempo.rojoMin! } : null,
  };
}
