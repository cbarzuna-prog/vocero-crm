import { z } from "zod";
import { CR_PROVINCIAS, cantonDe } from "@/lib/cr-zonas";
import { CAPTACION_ETAPAS, MOTIVOS_NO_CAPTADA, PROPERTY_CURRENCIES, PROPERTY_OPERATIONS, PROPERTY_TYPES } from "@/lib/propiedades-enums";
import type { PropertyCurrency, PropertyOperation, PropertyStatus, PropertyType } from "@/lib/propiedades";

/**
 * 048 (fork) — Captaciones: el pipeline de vendedores. Cada tarjeta es la
 * propiedad que se quiere captar. Puro: lo usan la API y la UI.
 */

export { CAPTACION_ETAPAS, MOTIVOS_NO_CAPTADA };
export type EtapaCaptacion = (typeof CAPTACION_ETAPAS)[number];
export type MotivoNoCaptada = (typeof MOTIVOS_NO_CAPTADA)[number];

export const ETAPA_LABELS: Record<EtapaCaptacion, string> = {
  contacto: "Contacto",
  valoracion: "Valoración",
  propuesta: "Propuesta",
  firmada: "Exclusiva firmada",
  publicada: "Publicada",
  perdida: "No se captó",
};

/** Qué significa cada etapa, para quien está empezando. */
export const ETAPA_AYUDA: Record<EtapaCaptacion, string> = {
  contacto: "El dueño quiere vender o alquilar; falta conocer la propiedad.",
  valoracion: "Visita y estudio de precio.",
  propuesta: "Se le presentó el precio sugerido y la comisión.",
  firmada: "Firmó el contrato de exclusiva.",
  publicada: "Está en el inventario y en el sitio.",
  perdida: "No se logró captar.",
};

export const MOTIVO_LABELS: Record<MotivoNoCaptada, string> = {
  precio_irreal: "Pide un precio fuera de mercado",
  firmo_con_otro: "Firmó con otra agencia",
  decidio_no_vender: "Decidió no vender",
  no_responde: "No responde",
  otro: "Otro",
};

/** Exclusiva estándar del negocio y cuántos días antes se avisa para renovar. */
export const MESES_EXCLUSIVA = 6;
export const DIAS_AVISO_RENOVAR = 15;
/** Comisión de venta por defecto: 5 % (en puntos básicos). */
export const COMISION_VENTA_BP = 500;

/** `YYYY-MM-DD` + n meses; si el día no existe en ese mes (31 → abril), el último del mes. */
export function sumarMeses(dia: string, meses: number): string {
  const [y, m, d] = dia.split("-").map(Number) as [number, number, number];
  const total = m - 1 + meses;
  const ano = y + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

export function restarDias(dia: string, dias: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) - dias * 86_400_000).toISOString().slice(0, 10);
}

/** Días de `hoy` a `dia` (negativo = ya pasó). */
export function diasHasta(dia: string, hoy: string): number {
  return Math.round((Date.parse(`${dia}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000);
}

export type EstadoVence = "vencida" | "pronto" | "vigente";
export function estadoVence(vence: string, hoy: string): EstadoVence {
  const d = diasHasta(vence, hoy);
  return d < 0 ? "vencida" : d <= 30 ? "pronto" : "vigente";
}

/**
 * Comisión estimada en centavos de la moneda de la propiedad. Venta: el
 * porcentaje sobre el precio. Alquiler: un mes de renta (el precio). `null`
 * si falta el precio (o el porcentaje en venta).
 */
export function comisionEstimadaCents(p: { operation: PropertyOperation; priceCents: number | null; comisionBp: number | null }): number | null {
  if (p.priceCents === null) return null;
  if (p.operation === "alquiler") return p.priceCents;
  if (p.comisionBp === null) return null;
  return Math.round((p.priceCents * p.comisionBp) / 10_000);
}

/** «5 %» o «1 mes de renta». */
export function textoComision(p: { operation: PropertyOperation; comisionBp: number | null }): string | null {
  if (p.operation === "alquiler") return "1 mes de renta";
  if (p.comisionBp === null) return null;
  return `${(p.comisionBp / 100).toLocaleString("es-CR", { maximumFractionDigits: 2 })} %`;
}

/**
 * El estado de la propiedad que corresponde a la etapa. Publicada entra al
 * inventario; no captada se retira; volver atrás la regresa a captación. Una
 * publicada que ya se vendió o reservó no se toca.
 */
export function estadoParaEtapa(etapa: EtapaCaptacion, actual: PropertyStatus): PropertyStatus {
  if (etapa === "publicada") return actual === "captacion" || actual === "retirada" ? "disponible" : actual;
  if (etapa === "perdida") return "retirada";
  return "captacion";
}

/* ---------------- Tarjeta ---------------- */

export type CaptacionTarjeta = {
  id: string;
  code: string;
  title: string;
  operation: PropertyOperation;
  type: PropertyType;
  status: PropertyStatus;
  etapa: EtapaCaptacion;
  desde: string;
  priceCents: number | null;
  currency: PropertyCurrency;
  zona: string | null;
  canton: string | null;
  provincia: string;
  comisionBp: number | null;
  exclusivaVence: string | null;
  motivo: MotivoNoCaptada | null;
  coverUrl: string | null;
  dueno: { id: string; name: string; phone: string | null } | null;
};

/** Total de comisiones estimadas de una columna, por moneda (no se suman monedas distintas). */
export function totalComisiones(tarjetas: readonly CaptacionTarjeta[]): { USD: number; CRC: number; sinDato: number } {
  const t = { USD: 0, CRC: 0, sinDato: 0 };
  for (const c of tarjetas) {
    const v = comisionEstimadaCents(c);
    if (v === null) t.sinDato++;
    else t[c.currency] += v;
  }
  return t;
}

/* ---------------- Contratos de entrada ---------------- */

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha inválida");

export const nuevaCaptacionSchema = z
  .object({
    /** Un contacto existente… */
    contactId: z.string().min(1).nullish(),
    /** …o uno nuevo. */
    nombre: opcional(120),
    telefono: opcional(40),
    operation: z.enum(PROPERTY_OPERATIONS),
    type: z.enum(PROPERTY_TYPES),
    provincia: z.enum(CR_PROVINCIAS as [string, ...string[]]),
    canton: opcional(80),
    zona: opcional(120),
    priceCents: z.number().int().min(0).max(1e15).nullish(),
    currency: z.enum(PROPERTY_CURRENCIES).default("USD"),
    nota: opcional(2000),
  })
  .refine((v) => v.contactId || v.nombre, { message: "Indique el dueño", path: ["nombre"] })
  .refine((v) => v.contactId || v.telefono, { message: "Indique el teléfono del dueño", path: ["telefono"] })
  .refine((v) => !v.canton || cantonDe(v.provincia, v.canton), { message: "ese cantón no es de esa provincia", path: ["canton"] });
export type NuevaCaptacionInput = z.input<typeof nuevaCaptacionSchema>;

export const moverCaptacionSchema = z
  .object({
    etapa: z.enum(CAPTACION_ETAPAS),
    /** Al firmar: fecha de firma, vencimiento y comisión (venta). */
    firmadaEl: dia.optional(),
    exclusivaVence: dia.nullish(),
    comisionBp: z.number().int().min(0).max(10_000).nullish(),
    /** Al no captarse. */
    motivo: z.enum(MOTIVOS_NO_CAPTADA).optional(),
  })
  .refine((v) => v.etapa !== "perdida" || v.motivo, { message: "Indique por qué no se captó", path: ["motivo"] })
  .refine((v) => !v.firmadaEl || !v.exclusivaVence || v.exclusivaVence > v.firmadaEl, {
    message: "El vencimiento va después de la firma",
    path: ["exclusivaVence"],
  });
export type MoverCaptacionInput = z.infer<typeof moverCaptacionSchema>;

/** Título de la tarea de renovación (también la llave para encontrarla). */
export const tituloRenovar = (code: string, title: string) => `Renovar exclusiva — ${code} · ${title}`;
