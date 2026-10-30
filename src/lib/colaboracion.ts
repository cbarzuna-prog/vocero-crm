import { z } from "zod";
import { ROLES_COLABORACION } from "@/lib/propiedades-enums";

/**
 * 060 (fork) — Colaboración: quién trajo y quién vende cada propiedad, y cómo
 * se reparte la comisión (70/30, 33/33/33…). Puede ser alguien del equipo o
 * un co-corredor externo (un contacto marcado «colaborador»). Lo que no se
 * reparte queda para la agencia. Puro: lo usan la API y la UI.
 */

export { ROLES_COLABORACION };
export type RolColaboracion = (typeof ROLES_COLABORACION)[number];

export const ROL_LABELS: Record<RolColaboracion, string> = {
  capta: "La trajo",
  vende: "La vende",
  ambos: "La trajo y la vende",
};

export type Participante = {
  /** `u:<userId>` o `c:<contactId>`: una llave para la UI. */
  key: string;
  userId: string | null;
  contactId: string | null;
  nombre: string;
  /** Equipo o co-corredor externo. */
  externo: boolean;
  rol: RolColaboracion;
  porcentajeBp: number;
};

export const participanteSchema = z
  .object({
    userId: z.string().min(1).nullish(),
    contactId: z.string().min(1).nullish(),
    rol: z.enum(ROLES_COLABORACION),
    porcentajeBp: z.number().int().min(0).max(10_000),
  })
  .refine((p) => !!p.userId !== !!p.contactId, { message: "Cada participante es alguien del equipo o un colaborador, no ambos" });

export const guardarParticipantesSchema = z
  .object({ participantes: z.array(participanteSchema).max(10) })
  .refine((v) => v.participantes.reduce((a, p) => a + p.porcentajeBp, 0) <= 10_000, {
    message: "Los porcentajes suman más de 100 %",
    path: ["participantes"],
  })
  .refine(
    (v) => {
      const llaves = v.participantes.map((p) => (p.userId ? `u:${p.userId}` : `c:${p.contactId}`));
      return new Set(llaves).size === llaves.length;
    },
    { message: "Hay una persona repetida", path: ["participantes"] }
  );
export type GuardarParticipantesInput = z.infer<typeof guardarParticipantesSchema>;

/** «33,33 %» a partir de puntos básicos. */
export const textoPorcentaje = (bp: number) => `${(bp / 100).toLocaleString("es-CR", { maximumFractionDigits: 2 })} %`;

/** «33,33» o «30» → puntos básicos. `null` si no es un porcentaje válido. */
export function porcentajeABp(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const n = Math.round(Number(t) * 100);
  return n >= 0 && n <= 10_000 ? n : null;
}

/**
 * Cuánto le toca a cada quien de una comisión total (centavos) y cuánto queda
 * para la agencia. Redondea por persona y deja el residuo a la agencia: la
 * suma siempre cuadra con el total.
 */
export function repartir(totalCents: number | null, participantes: readonly Pick<Participante, "porcentajeBp">[]): { montos: (number | null)[]; agenciaBp: number; agenciaCents: number | null } {
  const usado = participantes.reduce((a, p) => a + p.porcentajeBp, 0);
  const agenciaBp = Math.max(0, 10_000 - usado);
  if (totalCents === null) return { montos: participantes.map(() => null), agenciaBp, agenciaCents: null };
  const montos = participantes.map((p) => Math.floor((totalCents * p.porcentajeBp) / 10_000));
  return { montos, agenciaBp, agenciaCents: totalCents - montos.reduce((a, m) => a + m, 0) };
}

/** Reparto parejo entre n personas (33,34 / 33,33 / 33,33): suma exacta 100 %. */
export function partesIguales(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(10_000 / n);
  return Array.from({ length: n }, (_, i) => base + (i < 10_000 - base * n ? 1 : 0));
}

/** «Ana (30 %), Luis (70 %)» para tarjetas y listas. */
export function resumenParticipantes(ps: readonly Pick<Participante, "nombre" | "porcentajeBp">[]): string {
  return ps.map((p) => `${p.nombre.split(" ")[0]} ${textoPorcentaje(p.porcentajeBp)}`).join(" · ");
}

/** Lo que un colaborador tiene en curso, para su página de contacto. */
export type ColaboracionDeContacto = {
  propertyId: string;
  code: string;
  title: string;
  status: string;
  captacionEtapa: string | null;
  rol: RolColaboracion;
  porcentajeBp: number;
  /** Su parte de la comisión estimada, en la moneda de la propiedad. */
  montoCents: number | null;
  currency: "USD" | "CRC";
};
