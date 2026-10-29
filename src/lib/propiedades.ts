import { z } from "zod";
import { CR_PROVINCIAS, cantonDe } from "@/lib/cr-zonas";
import {
  DISCARD_REASONS,
  INTEREST_STATUSES,
  PROPERTY_CURRENCIES,
  PROPERTY_OPERATIONS,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
} from "@/lib/propiedades-enums";

/**
 * 046 — Propiedades: etiquetas, contratos internos de la API y formato.
 * Puro y sin servidor: lo usan la API y la UI.
 */

export {
  DISCARD_REASONS,
  INTEREST_STATUSES,
  PROPERTY_CURRENCIES,
  PROPERTY_OPERATIONS,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
};

export type PropertyOperation = (typeof PROPERTY_OPERATIONS)[number];
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];
export type PropertyCurrency = (typeof PROPERTY_CURRENCIES)[number];
export type InterestStatus = (typeof INTEREST_STATUSES)[number];
export type DiscardReason = (typeof DISCARD_REASONS)[number];

/** Prefijo del código interno (`KK-0001`). Del negocio: Knock Knock. */
export const PROPERTY_CODE_PREFIX = "KK";
export const MAX_PHOTOS = 20;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

export const OPERATION_LABELS: Record<PropertyOperation, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
};

export const TYPE_LABELS: Record<PropertyType, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  lote: "Lote",
  local: "Local",
  oficina: "Oficina",
  bodega: "Bodega",
  finca: "Finca",
};

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  captacion: "En captación",
  disponible: "Disponible",
  reservada: "Reservada",
  vendida: "Vendida",
  alquilada: "Alquilada",
  retirada: "Retirada",
};

/** Las que todavía se trabajan: el filtro por defecto de la lista. */
export const ACTIVE_STATUSES: PropertyStatus[] = ["captacion", "disponible", "reservada"];

export const INTEREST_LABELS: Record<InterestStatus, string> = {
  interesado: "Interesado",
  enviada: "Ficha enviada",
  visitada: "Visitó",
  oferto: "Ofertó",
  ganada: "Cerrada",
  descartada: "Descartada",
};

/** Los pasos en orden; `descartada` va aparte (no es un paso, es una salida). */
export const INTEREST_STEPS: InterestStatus[] = ["interesado", "enviada", "visitada", "oferto", "ganada"];

export const DISCARD_LABELS: Record<DiscardReason, string> = {
  precio: "Precio",
  zona: "Zona",
  tamano: "Tamaño",
  estado_propiedad: "Estado de la propiedad",
  eligio_otra: "Eligió otra",
  otro: "Otro",
};

/** "$450,000" · "₡185,000,000". Sin decimales: en inmuebles nadie los usa. */
export function formatPrecio(cents: number | null | undefined, currency: PropertyCurrency): string | null {
  if (cents === null || cents === undefined) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Baños se guardan ×2 (medios sin decimales). */
export const banosFromX2 = (x2: number | null) => (x2 === null ? null : x2 / 2);
export const banosToX2 = (banos: number | null) => (banos === null ? null : Math.round(banos * 2));

export function coverUrl(assetId: string | null): string | null {
  return assetId ? `/api/media/${assetId}` : null;
}

/** Título por defecto: «Casa en Santa Ana». */
export function defaultTitle(type: PropertyType, lugar: string | null | undefined): string {
  return lugar ? `${TYPE_LABELS[type]} en ${lugar}` : TYPE_LABELS[type];
}

/* ---------------- DTOs ---------------- */

export type PropertyListItem = {
  id: string;
  code: string;
  title: string;
  operation: PropertyOperation;
  type: PropertyType;
  status: PropertyStatus;
  priceCents: number | null;
  currency: PropertyCurrency;
  provincia: string;
  canton: string | null;
  zona: string | null;
  habitaciones: number | null;
  banos: number | null;
  m2Construccion: number | null;
  m2Terreno: number | null;
  coverUrl: string | null;
  interesados: number;
  archived: boolean;
};

export type InteresadoDto = {
  interestId: string;
  status: InterestStatus;
  note: string | null;
  updatedAt: string;
  contact: { id: string; name: string };
};

export type PropertyDetail = PropertyListItem & {
  distrito: string | null;
  parqueos: number | null;
  descripcionPublica: string | null;
  notasInternas: string | null;
  seller: { id: string; name: string } | null;
  comisionBp: number | null;
  exclusiva: boolean;
  captadaAt: string | null;
  urlExterna: string | null;
  photos: { id: string; url: string }[];
  interesadosDetalle: InteresadoDto[];
};

export type InteresDeContactoDto = {
  interestId: string;
  status: InterestStatus;
  note: string | null;
  property: Pick<PropertyListItem, "id" | "code" | "title" | "priceCents" | "currency" | "status" | "coverUrl">;
};

export type PropiedadesDeContactoDto = {
  vende: InteresDeContactoDto["property"][];
  interes: InteresDeContactoDto[];
};

/* ---------------- Contratos de entrada ---------------- */

const provinciaSchema = z.enum(CR_PROVINCIAS as [string, ...string[]]);
const texto = (max: number) => z.string().trim().max(max);
const opcionalTexto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
const entero = (max: number) => z.number().int().min(0).max(max).nullable();

/** D8 — Alta rápida: operación, tipo, precio, moneda y zona. */
export const crearPropiedadSchema = z
  .object({
    operation: z.enum(PROPERTY_OPERATIONS),
    type: z.enum(PROPERTY_TYPES),
    priceCents: z.number().int().min(0).max(1e15).nullish(),
    currency: z.enum(PROPERTY_CURRENCIES).default("USD"),
    provincia: provinciaSchema,
    canton: opcionalTexto(80),
    zona: opcionalTexto(120),
    title: opcionalTexto(160),
    status: z.enum(PROPERTY_STATUSES).optional(),
  })
  .refine((v) => !v.canton || cantonDe(v.provincia, v.canton), {
    message: "ese cantón no es de esa provincia",
    path: ["canton"],
  });
export type CrearPropiedadInput = z.input<typeof crearPropiedadSchema>;

export const editarPropiedadSchema = z
  .object({
    code: texto(20).min(1),
    title: texto(160).min(1),
    operation: z.enum(PROPERTY_OPERATIONS),
    type: z.enum(PROPERTY_TYPES),
    status: z.enum(PROPERTY_STATUSES),
    priceCents: z.number().int().min(0).max(1e15).nullable(),
    currency: z.enum(PROPERTY_CURRENCIES),
    provincia: provinciaSchema,
    canton: z.string().trim().max(80).nullable(),
    distrito: z.string().trim().max(80).nullable(),
    zona: z.string().trim().max(120).nullable(),
    m2Construccion: entero(1_000_000),
    m2Terreno: entero(100_000_000),
    habitaciones: entero(100),
    banos: z.number().min(0).max(50).multipleOf(0.5).nullable(),
    parqueos: entero(100),
    descripcionPublica: z.string().max(5000).nullable(),
    notasInternas: z.string().max(5000).nullable(),
    sellerContactId: z.string().min(1).nullable(),
    comisionBp: z.number().int().min(0).max(10_000).nullable(),
    exclusiva: z.boolean(),
    captadaAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    urlExterna: z.string().trim().url().max(500).nullable(),
  })
  .partial();
export type EditarPropiedadInput = z.infer<typeof editarPropiedadSchema>;

export const filtroPropiedadesSchema = z.object({
  operation: z.enum(PROPERTY_OPERATIONS).optional(),
  type: z.enum(PROPERTY_TYPES).optional(),
  /** Un estado, o `activas` (captación + disponible + reservada), o `todas`. */
  status: z.union([z.enum(PROPERTY_STATUSES), z.literal("activas"), z.literal("todas")]).default("activas"),
  provincia: z.string().max(40).optional(),
  canton: z.string().max(80).optional(),
  currency: z.enum(PROPERTY_CURRENCIES).optional(),
  /** En unidades (no centavos); exige `currency`: no se comparan monedas. */
  min: z.coerce.number().min(0).optional(),
  max: z.coerce.number().min(0).optional(),
  q: z.string().trim().max(80).optional(),
  archivadas: z.enum(["1", "0"]).optional(),
});
export type FiltroPropiedades = z.infer<typeof filtroPropiedadesSchema>;

export const vincularSchema = z.object({
  contactId: z.string().min(1),
  propertyId: z.string().min(1),
  status: z.enum(INTEREST_STATUSES).optional(),
  note: z.string().trim().max(1000).nullish(),
});

export const cambiarInteresSchema = z
  .object({
    status: z.enum(INTEREST_STATUSES).optional(),
    discardReason: z.enum(DISCARD_REASONS).nullish(),
    note: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.note !== undefined, { message: "nada que cambiar" })
  .refine((v) => !v.discardReason || v.status === "descartada", {
    message: "el motivo solo aplica al descartar",
    path: ["discardReason"],
  });

/**
 * 050 — El mensaje de WhatsApp con la ficha de una propiedad. SOLO lo
 * compartible (D9): nunca vendedor, comisión, exclusiva ni notas internas.
 * Usa el formato de WhatsApp (*negrita*).
 */
export function textoFicha(p: {
  code: string;
  title: string;
  operation: PropertyOperation;
  priceCents: number | null;
  currency: PropertyCurrency;
  provincia: string;
  canton: string | null;
  zona: string | null;
  habitaciones: number | null;
  banos: number | null;
  m2Construccion: number | null;
  m2Terreno: number | null;
  parqueos: number | null;
  descripcionPublica: string | null;
}): string {
  const precio = formatPrecio(p.priceCents, p.currency);
  const lugar = [p.zona, p.canton ?? p.provincia].filter(Boolean).join(", ");
  const datos = [
    p.habitaciones !== null ? `${p.habitaciones} hab.` : null,
    p.banos !== null ? `${p.banos} baños` : null,
    p.m2Construccion !== null ? `${p.m2Construccion} m² de construcción` : null,
    p.m2Terreno !== null ? `${p.m2Terreno} m² de terreno` : null,
    p.parqueos !== null ? `${p.parqueos} parqueos` : null,
  ].filter(Boolean);
  return [
    `*${p.title}*`,
    precio ? `${precio}${p.operation === "alquiler" ? " al mes" : ""} · ${OPERATION_LABELS[p.operation]}` : OPERATION_LABELS[p.operation],
    lugar || null,
    datos.length ? datos.join(" · ") : null,
    p.descripcionPublica?.trim() ? `\n${p.descripcionPublica.trim()}` : null,
    `\nRef. ${p.code}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export const enviarFichaSchema = z.object({
  contactId: z.string().min(1),
  /** Cuántas fotos mandar después del texto (0–5). */
  fotos: z.number().int().min(0).max(5).default(3),
});

/* ── 051 (fork) — Orden y resumen de la lista ─────────────────────────── */

export const ORDENES = ["recientes", "precio_desc", "precio_asc"] as const;
export type OrdenPropiedades = (typeof ORDENES)[number];
export const ORDEN_LABELS: Record<OrdenPropiedades, string> = {
  recientes: "Más recientes",
  precio_desc: "Precio: mayor a menor",
  precio_asc: "Precio: menor a mayor",
};

/**
 * Ordena en el cliente (la lista es corta). "recientes" respeta el orden del
 * servidor. Por precio no se mezclan monedas sin un tipo de cambio: primero
 * US$, luego ₡, cada grupo ordenado; las que no tienen precio van al final.
 */
export function ordenarPropiedades<T extends Pick<PropertyListItem, "priceCents" | "currency">>(
  items: readonly T[],
  orden: OrdenPropiedades
): T[] {
  if (orden === "recientes") return [...items];
  const dir = orden === "precio_desc" ? -1 : 1;
  const moneda = (c: PropertyCurrency) => (c === "USD" ? 0 : 1);
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      const an = a.it.priceCents === null;
      const bn = b.it.priceCents === null;
      if (an !== bn) return an ? 1 : -1;
      if (an && bn) return a.i - b.i;
      const m = moneda(a.it.currency) - moneda(b.it.currency);
      if (m !== 0) return m;
      return dir * ((a.it.priceCents ?? 0) - (b.it.priceCents ?? 0)) || a.i - b.i;
    })
    .map((x) => x.it);
}

const PLURAL: Record<PropertyStatus, [string, string]> = {
  captacion: ["en captación", "en captación"],
  disponible: ["disponible", "disponibles"],
  reservada: ["reservada", "reservadas"],
  vendida: ["vendida", "vendidas"],
  alquilada: ["alquilada", "alquiladas"],
  retirada: ["retirada", "retiradas"],
};

/** La línea bajo el título: «8 disponibles · 2 reservadas · 3 con interesados». */
export function resumenPropiedades(items: readonly Pick<PropertyListItem, "status" | "interesados">[]): string {
  if (items.length === 0) return "";
  const partes: string[] = [];
  for (const s of PROPERTY_STATUSES) {
    const n = items.filter((p) => p.status === s).length;
    if (n > 0) partes.push(`${n} ${PLURAL[s][n === 1 ? 0 : 1]}`);
  }
  const con = items.filter((p) => p.interesados > 0).length;
  if (con > 0) partes.push(`${con} con interesados`);
  return partes.join(" · ");
}
