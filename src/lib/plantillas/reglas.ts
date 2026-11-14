import { z } from "zod";
import type { Campo, Plantilla, TipoCampo } from "./tipos";

/**
 * 068 — Las reglas que ninguna plantilla puede romper (spec §3). Se validan en
 * las pruebas y otra vez al aplicar una plantilla: una que las viole no llega
 * nunca a un negocio.
 */

const CLAVE = /^[a-z][a-z0-9_]*$/;

/** Los datos base de la ficha (067): no se redefinen en una plantilla. */
export const CLAVES_BASE = new Set(["nombre", "telefono", "correo", "origen", "responsable", "etapa", "notas"]);

/** Palabras que delatan un dato de salud aunque no se marque como tal. */
const PALABRAS_SALUD = /alergi|diagn[oó]stic|medicament|enfermedad|padecimiento|embaraz|contraindic|historial cl[ií]nico|antecedentes m[eé]dicos|tratamiento m[eé]dico/i;

/** Palabras que delatan un identificador que no se pide por WhatsApp. */
const PALABRAS_IDENTIFICADOR = /c[eé]dula|pasaporte|dimex|tarjeta|cuenta bancaria|iban|n[uú]mero de cuenta|documento de identidad/i;

export type Problema = { donde: string; regla: string };

function revisarCampo(c: Pick<Campo, "clave" | "etiqueta" | "tipo" | "opciones" | "sensible" | "pedirPorChat" | "salud">, donde: string): Problema[] {
  const p: Problema[] = [];
  if (!CLAVE.test(c.clave)) p.push({ donde, regla: "La clave debe ser minúsculas, números y guion bajo, empezando por letra" });
  if ((c.tipo === "lista" || c.tipo === "lista_multiple") && !(c.opciones && c.opciones.length > 0))
    p.push({ donde, regla: "Una lista necesita opciones" });
  if (c.salud || PALABRAS_SALUD.test(c.etiqueta))
    p.push({ donde, regla: "Datos de salud no van en la ficha comercial (Ley 8968, art. 9)" });
  if (PALABRAS_IDENTIFICADOR.test(c.etiqueta) && !c.sensible)
    p.push({ donde, regla: "Un identificador (cédula, tarjeta, cuenta) debe marcarse sensible" });
  if (c.sensible && c.pedirPorChat !== false)
    p.push({ donde, regla: "Un dato sensible no se pide por chat (política de WhatsApp Business)" });
  return p;
}

/** Todos los problemas de una plantilla; vacío = se puede aplicar. */
export function revisarPlantilla(pl: Plantilla): Problema[] {
  const p: Problema[] = [];
  if (!CLAVE.test(pl.clave)) p.push({ donde: "plantilla", regla: "Clave inválida" });

  const claves = new Set<string>();
  for (const c of pl.campos) {
    const donde = `campo ${c.clave}`;
    if (claves.has(c.clave)) p.push({ donde, regla: "Clave repetida" });
    claves.add(c.clave);
    if (CLAVES_BASE.has(c.clave)) p.push({ donde, regla: "Es un dato base de la ficha: no se redefine" });
    p.push(...revisarCampo(c, donde));
  }
  for (const c of pl.campos) {
    if (c.mostrarSi && !claves.has(c.mostrarSi.campo))
      p.push({ donde: `campo ${c.clave}`, regla: `Se muestra según «${c.mostrarSi.campo}», que no existe` });
  }

  const registros = new Set<string>();
  for (const r of pl.registros) {
    const donde = `registro ${r.clave}`;
    if (!CLAVE.test(r.clave)) p.push({ donde, regla: "Clave inválida" });
    if (registros.has(r.clave)) p.push({ donde, regla: "Clave repetida" });
    registros.add(r.clave);
    if (r.estados.length === 0) p.push({ donde, regla: "Necesita al menos un estado" });
    if (!r.estados.some((e) => !e.final)) p.push({ donde, regla: "Necesita un estado activo (no final)" });
    for (const c of r.campos) p.push(...revisarCampo(c, `${donde} · ${c.clave}`));
  }

  const etapas = new Set<string>();
  for (const e of pl.etapas) {
    const donde = `etapa ${e.clave}`;
    if (!CLAVE.test(e.clave)) p.push({ donde, regla: "Clave inválida" });
    if (etapas.has(e.clave)) p.push({ donde, regla: "Clave repetida" });
    etapas.add(e.clave);
    for (const req of e.requisitos ?? []) {
      const ok = req.startsWith("registro:") ? registros.has(req.slice(9)) : claves.has(req);
      if (!ok) p.push({ donde, regla: `El criterio mira «${req}», que no existe` });
    }
    if (e.ambarMin != null && e.rojoMin != null && e.ambarMin > e.rojoMin)
      p.push({ donde, regla: "El ámbar no puede llegar después del rojo" });
  }
  if (pl.etapas.filter((e) => e.tipo === "open").length === 0) p.push({ donde: "etapas", regla: "Necesita al menos una etapa abierta" });
  if (pl.etapas.filter((e) => e.tipo === "won").length !== 1) p.push({ donde: "etapas", regla: "Necesita exactamente una etapa ganada" });
  if (pl.etapas.filter((e) => e.tipo === "lost").length < 1) p.push({ donde: "etapas", regla: "Necesita una etapa perdida" });
  if (pl.motivosPerdida.length === 0) p.push({ donde: "motivos", regla: "Necesita motivos de pérdida" });
  return p;
}

/** Campos que la IA puede leer de una conversación (spec §3, reglas 3 y 4). */
export function camposExtraibles(pl: Pick<Plantilla, "campos">): Campo[] {
  return pl.campos.filter((c) => !c.sensible && c.pedirPorChat !== false && !c.salud);
}

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha AAAA-MM-DD");

/** El esquema del valor de un campo según su tipo (API y extracción de la IA). */
export function esquemaValor(c: { tipo: TipoCampo; opciones?: string[] }): z.ZodType<unknown> {
  switch (c.tipo) {
    case "texto":
      return z.string().trim().min(1).max(300);
    case "texto_largo":
      return z.string().trim().min(1).max(2000);
    case "numero":
      return z.number().finite();
    case "importe":
      return z.object({ cents: z.number().int().min(0), moneda: z.enum(["CRC", "USD"]) });
    case "fecha":
      return fechaIso;
    case "si_no":
      return z.boolean();
    case "lista":
      return z.enum((c.opciones ?? [""]) as [string, ...string[]]);
    case "lista_multiple":
      return z.array(z.enum((c.opciones ?? [""]) as [string, ...string[]])).min(1);
  }
}

/** ¿Este valor cumple el requisito de un criterio? (lleno = sí). */
export function valorLleno(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}
