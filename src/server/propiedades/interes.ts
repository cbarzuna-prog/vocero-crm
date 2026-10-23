import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import type { DiscardReason, InterestStatus } from "@/lib/propiedades";
import { PropiedadError } from "./service";

/**
 * 046 — LA PUERTA ÚNICA del interés comprador↔propiedad (D5).
 *
 * Es el único archivo que escribe `property_interest` y
 * `property_interest_event`, y siempre los dos en la misma transacción: un
 * cambio de estado sin su evento no truena, solo hace que «cuántas visitas
 * hasta ofertar» mienta meses después. Un test de vigilancia
 * (`tests/unit/046-propiedades.test.ts`) falla si aparece otra escritura.
 */

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function registrar(
  tx: Tx,
  e: {
    organizationId: string;
    interestId: string;
    contactId: string;
    propertyId: string;
    from: InterestStatus | null;
    to: InterestStatus;
    discardReason?: DiscardReason | null;
    actorUserId: string | null;
  }
) {
  await tx.insert(schema.propertyInterestEvent).values({
    id: newId("propertyInterestEvent"),
    organizationId: e.organizationId,
    interestId: e.interestId,
    contactId: e.contactId,
    propertyId: e.propertyId,
    fromStatus: e.from,
    toStatus: e.to,
    discardReason: e.to === "descartada" ? (e.discardReason ?? null) : null,
    actorUserId: e.actorUserId,
  });
}

async function assertPar(organizationId: string, contactId: string, propertyId: string) {
  const db = getDb();
  const [c, p] = await Promise.all([
    db
      .select({ id: schema.contact.id })
      .from(schema.contact)
      .where(scoped(schema.contact.organizationId, organizationId, eq(schema.contact.id, contactId)))
      .limit(1),
    db
      .select({ id: schema.property.id })
      .from(schema.property)
      .where(scoped(schema.property.organizationId, organizationId, eq(schema.property.id, propertyId)))
      .limit(1),
  ]);
  if (!c[0]) throw new PropiedadError("no_encontrada", "El contacto no existe");
  if (!p[0]) throw new PropiedadError("no_encontrada", "La propiedad no existe");
}

/**
 * Vincula a un comprador con una propiedad. Idempotente: si ya estaban
 * vinculados devuelve el vínculo existente (y aplica el estado pedido, si
 * viene, como un cambio normal).
 */
export async function vincular(
  organizationId: string,
  actorUserId: string | null,
  input: { contactId: string; propertyId: string; status?: InterestStatus; note?: string | null }
): Promise<{ interestId: string; created: boolean }> {
  await assertPar(organizationId, input.contactId, input.propertyId);
  const db = getDb();
  const existing = await db
    .select({ id: schema.propertyInterest.id })
    .from(schema.propertyInterest)
    .where(
      scoped(
        schema.propertyInterest.organizationId,
        organizationId,
        eq(schema.propertyInterest.contactId, input.contactId),
        eq(schema.propertyInterest.propertyId, input.propertyId)
      )
    )
    .limit(1);
  if (existing[0]) {
    if (input.status) {
      await cambiar(organizationId, actorUserId, existing[0].id, { status: input.status, note: input.note });
    }
    return { interestId: existing[0].id, created: false };
  }

  const interestId = newId("propertyInterest");
  const status = input.status ?? "interesado";
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.propertyInterest).values({
        id: interestId,
        organizationId,
        contactId: input.contactId,
        propertyId: input.propertyId,
        status,
        note: input.note ?? null,
      });
      await registrar(tx, {
        organizationId,
        interestId,
        contactId: input.contactId,
        propertyId: input.propertyId,
        from: null,
        to: status,
        actorUserId,
      });
    });
  } catch (err) {
    // Carrera: otro request creó el mismo par entre la lectura y el insert.
    const again = await db
      .select({ id: schema.propertyInterest.id })
      .from(schema.propertyInterest)
      .where(
        and(
          eq(schema.propertyInterest.organizationId, organizationId),
          eq(schema.propertyInterest.contactId, input.contactId),
          eq(schema.propertyInterest.propertyId, input.propertyId)
        )
      )
      .limit(1);
    if (again[0]) return { interestId: again[0].id, created: false };
    throw err;
  }
  return { interestId, created: true };
}

/** Cambia el estado (con su evento) y/o la nota de un vínculo. */
export async function cambiar(
  organizationId: string,
  actorUserId: string | null,
  interestId: string,
  input: { status?: InterestStatus; discardReason?: DiscardReason | null; note?: string | null }
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.propertyInterest)
    .where(scoped(schema.propertyInterest.organizationId, organizationId, eq(schema.propertyInterest.id, interestId)))
    .limit(1);
  const current = rows[0];
  if (!current) throw new PropiedadError("no_encontrada", "El vínculo no existe");

  const statusChanges = input.status !== undefined && input.status !== current.status;
  await db.transaction(async (tx) => {
    await tx
      .update(schema.propertyInterest)
      .set({
        ...(statusChanges ? { status: input.status } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        updatedAt: new Date(),
      })
      .where(scoped(schema.propertyInterest.organizationId, organizationId, eq(schema.propertyInterest.id, interestId)));
    if (statusChanges) {
      await registrar(tx, {
        organizationId,
        interestId,
        contactId: current.contactId,
        propertyId: current.propertyId,
        from: current.status,
        to: input.status!,
        discardReason: input.discardReason,
        actorUserId,
      });
    }
  });
}

/**
 * Quita un vínculo hecho por error. Arrastra su historial (cascade): para
 * «ya no le interesa» está `descartada`, que conserva la historia.
 */
export async function quitar(organizationId: string, interestId: string): Promise<void> {
  const rows = await getDb()
    .delete(schema.propertyInterest)
    .where(scoped(schema.propertyInterest.organizationId, organizationId, eq(schema.propertyInterest.id, interestId)))
    .returning({ id: schema.propertyInterest.id });
  if (!rows[0]) throw new PropiedadError("no_encontrada", "El vínculo no existe");
}

/** Historial de un vínculo, del más reciente al más viejo. */
export async function historial(organizationId: string, interestId: string) {
  return getDb()
    .select({
      from: schema.propertyInterestEvent.fromStatus,
      to: schema.propertyInterestEvent.toStatus,
      discardReason: schema.propertyInterestEvent.discardReason,
      occurredAt: schema.propertyInterestEvent.occurredAt,
    })
    .from(schema.propertyInterestEvent)
    .where(
      scoped(
        schema.propertyInterestEvent.organizationId,
        organizationId,
        eq(schema.propertyInterestEvent.interestId, interestId)
      )
    )
    .orderBy(schema.propertyInterestEvent.occurredAt);
}
