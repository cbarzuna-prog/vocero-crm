import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * 054 (fork Knock Knock) — Contrato y reglas puras de los leads que llegan de
 * los formularios de la web. Sin BD, para poder probarlas unitariamente.
 */

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/**
 * Lo que manda la web. Campos de más se ignoran: la web puede mandar su fila
 * entera sin que haya que mantener la lista sincronizada.
 */
export const webLeadSchema = z.object({
  id: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((v) => (v === undefined || v === null || v === "" ? null : String(v).slice(0, 200))),
  name: z.string().trim().min(1, "Falta el nombre").max(120),
  phone: z.string().trim().min(1, "Falta el teléfono").max(40),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email inválido"),
  message: texto(4000),
  property: z
    .object({
      id: z
        .union([z.string(), z.number()])
        .optional()
        .nullable()
        .transform((v) => (v === undefined || v === null || v === "" ? null : String(v).trim().slice(0, 200))),
      url: texto(500),
      code: texto(40),
      title: texto(300),
    })
    .partial()
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  pageUrl: texto(500),
});

export type WebLeadInput = z.output<typeof webLeadSchema>;

/**
 * Teléfono de Costa Rica al formato del `wa_id` de Meta: solo dígitos, sin
 * `00` internacional, y con `506` delante si vienen los 8 dígitos locales.
 * Así quien llena el formulario y luego escribe por WhatsApp es el MISMO
 * contacto. Devuelve null si no parece un teléfono.
 */
export function normalizePhoneCr(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 8) digits = `506${digits}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

/**
 * La llave de idempotencia (D8): el id de la web o, si no lo manda, un hash
 * del teléfono + propiedad + mensaje. Un reintento idéntico cae en la misma
 * llave; otra pregunta de la misma persona, no.
 */
export function externalIdFor(input: WebLeadInput, phone: string): string {
  if (input.id) return `web:${input.id}`;
  const prop = input.property;
  const base = [
    phone,
    prop?.code ?? "",
    prop?.id ?? "",
    prop?.url ?? "",
    input.message ?? "",
  ].join("|");
  return `hash:${createHash("sha256").update(base).digest("hex").slice(0, 40)}`;
}

/** Línea que se anexa a las notas del contacto (D7). */
export function notaDelFormulario(input: {
  fecha: string;
  propiedad: string | null;
  mensaje: string | null;
  email: string | null;
}): string {
  const partes = [`[Formulario web ${input.fecha}]`];
  if (input.propiedad) partes.push(input.propiedad);
  const cabeza = partes.join(" ");
  const cuerpo = [input.mensaje, input.email ? `Email: ${input.email}` : null]
    .filter(Boolean)
    .join("\n");
  return cuerpo ? `${cabeza}\n${cuerpo}` : cabeza;
}

/** Título de la tarea de seguimiento (H3). */
export function tituloTarea(propiedad: string | null): string {
  return propiedad ? `Responder solicitud web — ${propiedad}`.slice(0, 200) : "Responder solicitud web";
}
