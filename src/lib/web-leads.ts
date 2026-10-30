import { z } from "zod";

/**
 * 058 (fork) — Contrato del webhook de leads de knockknockcr.com.
 *
 * `POST /api/webhooks/web/{WEB_LEADS_TOKEN}` → `200 { ok: true }`.
 *
 * Compatible con lo que el sitio ya manda desde `submit-property-crm`
 * (`{ id, name, phone, email, message, property: { id, url, title }, pageUrl }`)
 * y abierto a lo que falta: el tipo de formulario, el referidor y lo que
 * busca (formulario de solicitud específica). Tolerante: campos de más se
 * ignoran; lo que no se entiende no tumba el envío.
 */
export const TIPOS_WEB = ["propiedad", "info", "contacto", "solicitud", "vendedor"] as const;
export type TipoWeb = (typeof TIPOS_WEB)[number];

export const TIPO_WEB_LABELS: Record<TipoWeb, string> = {
  propiedad: "Consulta por una propiedad",
  info: "Pidió más información",
  contacto: "Formulario de contacto",
  solicitud: "Solicitud específica (qué busca)",
  vendedor: "Quiere vender o alquilar su propiedad",
};

/** Lo que manda el sitio hoy en `source` (`contact` | `request_info`) y sinónimos. */
const ALIAS_TIPO: Record<string, TipoWeb> = {
  contact: "propiedad",
  property: "propiedad",
  propiedad: "propiedad",
  request_info: "info",
  info: "info",
  contacto: "contacto",
  general: "contacto",
  contact_page: "contacto",
  specific_request: "solicitud",
  solicitud: "solicitud",
  seller: "vendedor",
  vendedor: "vendedor",
  agreement: "vendedor",
  listing: "vendedor",
};

const texto = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : v === null ? undefined : v), z.string().max(max).optional());

const numero = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}, z.number().nonnegative().optional());

const lista = z.preprocess(
  (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,;]/) : undefined),
  z.array(z.string().trim().min(1).max(80)).max(20).optional()
);

export const webLeadSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    /** Tipo de formulario; si falta se deduce (con propiedad → «propiedad»). */
    kind: texto(40),
    source: texto(40),
    name: texto(120),
    phone: texto(40),
    email: texto(254),
    message: texto(4000),
    language: texto(10),
    pageUrl: texto(1000),
    property: z
      .object({ id: texto(100), url: texto(1000), title: texto(300), code: texto(40) })
      .partial()
      .optional(),
    referrer: z
      .object({ id: texto(100), code: texto(60), name: texto(120), email: texto(254), phone: texto(40) })
      .partial()
      .optional(),
    /** Formulario de solicitud específica: qué busca. */
    preferences: z
      .object({
        operation: texto(20),
        types: lista,
        zones: lista,
        budgetMin: numero,
        budgetMax: numero,
        currency: texto(5),
        bedrooms: numero,
        timeline: texto(60),
      })
      .partial()
      .optional(),
  })
  .passthrough();

export type WebLead = z.infer<typeof webLeadSchema>;

export function tipoDe(lead: Pick<WebLead, "kind" | "source" | "property">): TipoWeb {
  const crudo = (lead.kind ?? lead.source ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  const t = ALIAS_TIPO[crudo];
  if (t) return t;
  return lead.property?.id || lead.property?.title ? "propiedad" : "contacto";
}

/**
 * Teléfono → dígitos con código de país. 8 dígitos de Costa Rica (2–8 al
 * inicio) reciben el 506; lo que ya trae código se respeta. `null` si no
 * alcanza para ser un número de WhatsApp.
 */
export function telefonoWeb(raw: string | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8 && /^[2-8]/.test(d)) d = `506${d}`;
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

/** Título de la tarea: «Responder solicitud web — KK-0001 · Lote en La Guácima». */
export function tituloTarea(tipo: TipoWeb, propiedad: { code?: string | null; title?: string | null } | null): string {
  const que = propiedad ? [propiedad.code, propiedad.title].filter(Boolean).join(" · ") : null;
  const base = tipo === "vendedor" ? "Contactar vendedor (sitio web)" : "Responder solicitud web";
  return (que ? `${base} — ${que}` : base).slice(0, 200);
}

/** Línea que se agrega a las notas del contacto. */
export function notaWeb(tipo: TipoWeb, lead: WebLead, propiedad: string | null, referidor: string | null, cuando: string): string {
  return [
    `[Sitio web ${cuando}] ${TIPO_WEB_LABELS[tipo]}`,
    propiedad ? `Propiedad: ${propiedad}` : null,
    referidor ? `Referido por: ${referidor}` : null,
    lead.message ? `Mensaje: ${lead.message}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Id de la propiedad del sitio dentro de su URL (`/property/<uuid>`). */
export function webIdDeUrl(url: string | null | undefined): string | null {
  return url?.match(/\/property\/([0-9a-f-]{36})/i)?.[1]?.toLowerCase() ?? null;
}
