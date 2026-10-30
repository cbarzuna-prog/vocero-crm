import { desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import type { ReferidorFila } from "@/lib/contactos";

const VISITO = ["visitada", "oferto", "ganada"] as const;

/**
 * 058 (fork) — Qué trajo cada referidor: leads, cuántos siguen en juego,
 * cuántos llegaron a visitar y cuántos cerraron (etapa ganada o propiedad
 * «ganada»). Con eso se sabe a quién agradecer y a quién pagarle.
 */
export async function listarReferidos(organizationId: string): Promise<ReferidorFila[]> {
  const db = getDb();
  const [refs, vinculos] = await Promise.all([
    db.select().from(schema.referidor).where(scoped(schema.referidor.organizationId, organizationId)).orderBy(desc(schema.referidor.createdAt)),
    db
      .select({ referidorId: schema.contactReferencia.referidorId, contactId: schema.contactReferencia.contactId, en: schema.contactReferencia.createdAt })
      .from(schema.contactReferencia)
      .where(scoped(schema.contactReferencia.organizationId, organizationId)),
  ]);
  const contactIds = [...new Set(vinculos.map((v) => v.contactId))];
  const [leads, intereses] = contactIds.length
    ? await Promise.all([
        db
          .select({ contactId: schema.lead.contactId, kind: schema.pipelineStage.kind })
          .from(schema.lead)
          .innerJoin(schema.pipelineStage, eq(schema.pipelineStage.id, schema.lead.stageId))
          .where(scoped(schema.lead.organizationId, organizationId, inArray(schema.lead.contactId, contactIds))),
        db
          .select({ contactId: schema.propertyInterest.contactId, status: schema.propertyInterest.status })
          .from(schema.propertyInterest)
          .where(scoped(schema.propertyInterest.organizationId, organizationId, inArray(schema.propertyInterest.contactId, contactIds))),
      ])
    : [[], []];
  const etapa = new Map(leads.map((l) => [l.contactId, l.kind]));
  const visito = new Set(intereses.filter((i) => (VISITO as readonly string[]).includes(i.status)).map((i) => i.contactId));
  const gano = new Set(intereses.filter((i) => i.status === "ganada").map((i) => i.contactId));

  return refs.map((r) => {
    const suyos = vinculos.filter((v) => v.referidorId === r.id);
    const ids = suyos.map((v) => v.contactId);
    return {
      id: r.id,
      nombre: r.nombre,
      codigo: r.codigo,
      email: r.email,
      telefono: r.telefono,
      leads: ids.length,
      activos: ids.filter((id) => etapa.get(id) === "open").length,
      visitas: ids.filter((id) => visito.has(id)).length,
      cierres: ids.filter((id) => etapa.get(id) === "won" || gano.has(id)).length,
      ultimoLead: suyos.reduce<string | null>((m, v) => (!m || v.en.toISOString() > m ? v.en.toISOString() : m), null),
    };
  });
}
