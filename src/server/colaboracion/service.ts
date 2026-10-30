import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { comisionEstimadaCents } from "@/lib/captaciones";
import { repartir, type ColaboracionDeContacto, type GuardarParticipantesInput, type Participante } from "@/lib/colaboracion";
import { guardarPerfil, leerPerfil } from "@/server/perfil/service";

/** 060 (fork) — Quién trajo y quién vende cada propiedad, con su parte de la comisión. */

export class ColaboracionError extends Error {
  constructor(
    readonly code: "no_encontrada" | "persona_inexistente",
    message: string
  ) {
    super(message);
    this.name = "ColaboracionError";
  }
}

const T = schema.propiedadParticipante;

/** Los participantes de varias propiedades a la vez (para listas y tableros). */
export async function participantesDe(organizationId: string, propertyIds?: readonly string[]): Promise<Map<string, Participante[]>> {
  if (propertyIds && propertyIds.length === 0) return new Map();
  const rows = await getDb()
    .select({
      propertyId: T.propertyId,
      userId: T.userId,
      contactId: T.contactId,
      rol: T.rol,
      porcentajeBp: T.porcentajeBp,
      usuario: schema.user.name,
      contacto: schema.contact.name,
    })
    .from(T)
    .leftJoin(schema.user, eq(schema.user.id, T.userId))
    .leftJoin(schema.contact, eq(schema.contact.id, T.contactId))
    .where(scoped(T.organizationId, organizationId, propertyIds ? inArray(T.propertyId, [...propertyIds]) : undefined))
    .orderBy(T.createdAt);
  const m = new Map<string, Participante[]>();
  for (const r of rows) {
    const p: Participante = {
      key: r.userId ? `u:${r.userId}` : `c:${r.contactId}`,
      userId: r.userId,
      contactId: r.contactId,
      nombre: (r.userId ? r.usuario : r.contacto) ?? "—",
      externo: !r.userId,
      rol: r.rol,
      porcentajeBp: r.porcentajeBp,
    };
    m.set(r.propertyId, [...(m.get(r.propertyId) ?? []), p]);
  }
  return m;
}

/**
 * Reemplaza el reparto de una propiedad. Cada persona se valida contra la
 * organización (equipo: miembro; colaborador: contacto de la org) y el
 * colaborador queda marcado como tal en su ficha.
 */
export async function guardarParticipantes(organizationId: string, propertyId: string, input: GuardarParticipantesInput): Promise<Participante[]> {
  const db = getDb();
  const [p] = await db
    .select({ id: schema.property.id })
    .from(schema.property)
    .where(scoped(schema.property.organizationId, organizationId, eq(schema.property.id, propertyId)))
    .limit(1);
  if (!p) throw new ColaboracionError("no_encontrada", "La propiedad no existe");

  const userIds = input.participantes.flatMap((x) => (x.userId ? [x.userId] : []));
  const contactIds = input.participantes.flatMap((x) => (x.contactId ? [x.contactId] : []));
  if (userIds.length) {
    const ok = await db
      .select({ id: schema.member.userId })
      .from(schema.member)
      .where(and(eq(schema.member.organizationId, organizationId), inArray(schema.member.userId, userIds)));
    if (ok.length !== new Set(userIds).size) throw new ColaboracionError("persona_inexistente", "Esa persona no es del equipo");
  }
  if (contactIds.length) {
    const ok = await db
      .select({ id: schema.contact.id })
      .from(schema.contact)
      .where(scoped(schema.contact.organizationId, organizationId, inArray(schema.contact.id, contactIds)));
    if (ok.length !== new Set(contactIds).size) throw new ColaboracionError("persona_inexistente", "Ese contacto no existe");
  }

  await db.transaction(async (tx) => {
    await tx.delete(T).where(scoped(T.organizationId, organizationId, eq(T.propertyId, propertyId)));
    if (input.participantes.length) {
      await tx.insert(T).values(
        input.participantes.map((x) => ({
          id: newId("participante"),
          organizationId,
          propertyId,
          userId: x.userId ?? null,
          contactId: x.contactId ?? null,
          rol: x.rol,
          porcentajeBp: x.porcentajeBp,
        }))
      );
    }
  });

  for (const id of new Set(contactIds)) {
    const perfil = await leerPerfil(organizationId, id).catch(() => null);
    if (perfil && !perfil.tiposCliente.includes("colaborador")) {
      await guardarPerfil(organizationId, id, { tiposCliente: [...perfil.tiposCliente, "colaborador"] }).catch(() => undefined);
    }
  }
  return (await participantesDe(organizationId, [propertyId])).get(propertyId) ?? [];
}

/** En qué propiedades participa un colaborador, con su parte estimada. */
export async function colaboracionesDeContacto(organizationId: string, contactId: string): Promise<ColaboracionDeContacto[]> {
  const P = schema.property;
  const rows = await getDb()
    .select({ t: T, p: P })
    .from(T)
    .innerJoin(P, eq(P.id, T.propertyId))
    .where(scoped(T.organizationId, organizationId, eq(T.contactId, contactId)))
    .orderBy(P.code);
  return rows.map(({ t, p }) => {
    const total = comisionEstimadaCents(p);
    return {
      propertyId: p.id,
      code: p.code,
      title: p.title,
      status: p.status,
      captacionEtapa: p.captacionEtapa,
      rol: t.rol,
      porcentajeBp: t.porcentajeBp,
      montoCents: repartir(total, [t]).montos[0] ?? null,
      currency: p.currency,
    };
  });
}
