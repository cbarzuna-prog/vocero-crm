import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { requisitoRegistro, valorLleno } from "@/lib/plantillas/reglas";
import { configNegocio } from "./config";
import { registrosActivos, valoresDeContactos } from "./ficha";

/**
 * 068 — El criterio de paso de la etapa SIGUIENTE como lista de verificación
 * («Cita agendada: ✓ servicio · ✗ una cita»). Sugiere, nunca mueve solo
 * (spec §3, regla 1; H5).
 */

export type Requisito = { clave: string; etiqueta: string; cumplido: boolean };

export type CriterioDto = {
  leadId: string;
  etapaActual: { id: string; nombre: string; criterio: string | null } | null;
  siguiente: { id: string; nombre: string; criterio: string | null; requisitos: Requisito[]; cumple: boolean } | null;
} | null;

export async function criterioDeContacto(organizationId: string, contactId: string): Promise<CriterioDto> {
  const negocio = await configNegocio(organizationId);
  if (!negocio) return null;
  const pl = negocio.config;
  const db = getDb();
  const L = schema.lead;
  const [lead] = await db.select({ id: L.id, stageId: L.stageId }).from(L).where(scoped(L.organizationId, organizationId, eq(L.contactId, contactId))).limit(1);
  if (!lead) return null;

  const S = schema.pipelineStage;
  const C = schema.etapaCriterio;
  const etapas = await db
    .select({ id: S.id, nombre: S.name, kind: S.kind, position: S.position, criterio: C.criterio, requisitos: C.requisitos })
    .from(S)
    .leftJoin(C, eq(C.stageId, S.id))
    .where(scoped(S.organizationId, organizationId))
    .orderBy(asc(S.position));
  const i = etapas.findIndex((e) => e.id === lead.stageId);
  const actual = etapas[i];
  if (!actual) return { leadId: lead.id, etapaActual: null, siguiente: null };
  const etapaActual = { id: actual.id, nombre: actual.nombre, criterio: actual.criterio ?? null };
  if (actual.kind !== "open") return { leadId: lead.id, etapaActual, siguiente: null };
  const sig = etapas.slice(i + 1).find((e) => e.kind === "open");
  if (!sig) return { leadId: lead.id, etapaActual, siguiente: null };

  const [valores, activos] = await Promise.all([valoresDeContactos(organizationId, [contactId]), registrosActivos(organizationId, [contactId])]);
  const v = valores.get(contactId) ?? {};
  const act = activos.get(contactId) ?? new Set<string>();
  const requisitos: Requisito[] = (sig.requisitos ?? []).map((req) => {
    const rr = requisitoRegistro(req);
    if (rr) {
      const tipo = pl.registros.find((t) => t.clave === rr.tipo);
      const sing = tipo?.singular.toLowerCase() ?? rr.tipo;
      const estado = rr.estado ? tipo?.estados.find((e) => e.clave === rr.estado)?.nombre.toLowerCase() : null;
      return { clave: req, etiqueta: estado ? `${sing[0]!.toUpperCase()}${sing.slice(1)} ${estado}` : `Una ${sing} por venir`, cumplido: act.has(rr.estado ? `${rr.tipo}:${rr.estado}` : rr.tipo) };
    }
    const campo = pl.campos.find((c) => c.clave === req);
    return { clave: req, etiqueta: campo?.etiqueta ?? req, cumplido: valorLleno(v[req]) };
  });
  return {
    leadId: lead.id,
    etapaActual,
    siguiente: { id: sig.id, nombre: sig.nombre, criterio: sig.criterio ?? null, requisitos, cumple: requisitos.length > 0 && requisitos.every((r) => r.cumplido) },
  };
}
