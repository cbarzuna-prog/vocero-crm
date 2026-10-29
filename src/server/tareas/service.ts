import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { zonedWallClockToUtc } from "@/lib/time/slots";
import type { CrearTareaInput, EditarTareaInput } from "@/lib/tareas";
import { businessTimezone } from "@/server/analytics/period";
import { publish } from "@/server/events/bus";

/**
 * 046 — Escrituras de tareas. Todo por `scoped()` (constitución III) y cada
 * referencia (contacto, propiedad, usuario asignado) se valida contra la
 * organización: un id ajeno se trata igual que uno inexistente.
 */

export class TareaError extends Error {
  constructor(
    public readonly code: "contacto_inexistente" | "propiedad_inexistente" | "usuario_inexistente" | "fecha_invalida" | "no_encontrada",
    message: string
  ) {
    super(message);
    this.name = "TareaError";
  }
}

/** Día + hora del negocio → instante UTC. Sin hora: mediodía (D: «todo el día»). */
export function dueInstant(day: string, time: string | null | undefined, tz: string): Date {
  const instant = zonedWallClockToUtc(day, time ?? "12:00", tz);
  if (!instant) throw new TareaError("fecha_invalida", "La fecha o la hora no existen");
  return instant;
}

async function assertRefs(
  organizationId: string,
  refs: { contactId?: string; propertyId?: string | null; assignedUserId?: string | null }
) {
  const db = getDb();
  if (refs.contactId) {
    const c = await db
      .select({ id: schema.contact.id })
      .from(schema.contact)
      .where(scoped(schema.contact.organizationId, organizationId, eq(schema.contact.id, refs.contactId)))
      .limit(1);
    if (!c[0]) throw new TareaError("contacto_inexistente", "El contacto no existe");
  }
  if (refs.propertyId) {
    const p = await db
      .select({ id: schema.property.id })
      .from(schema.property)
      .where(scoped(schema.property.organizationId, organizationId, eq(schema.property.id, refs.propertyId)))
      .limit(1);
    if (!p[0]) throw new TareaError("propiedad_inexistente", "La propiedad no existe");
  }
  if (refs.assignedUserId) {
    const m = await db
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(
        and(
          eq(schema.member.organizationId, organizationId),
          eq(schema.member.userId, refs.assignedUserId)
        )
      )
      .limit(1);
    if (!m[0]) throw new TareaError("usuario_inexistente", "Esa persona no es del equipo");
  }
}

function avisar(organizationId: string, taskId: string, contactId: string) {
  // Después del commit, como pide el bus.
  publish(organizationId, { type: "task.changed", data: { taskId, contactId } });
}

export async function crearTarea(
  organizationId: string,
  actorUserId: string,
  input: CrearTareaInput
): Promise<string> {
  await assertRefs(organizationId, input);
  const tz = await businessTimezone(organizationId);
  const id = newId("task");
  await getDb()
    .insert(schema.task)
    .values({
      id,
      organizationId,
      contactId: input.contactId,
      propertyId: input.propertyId ?? null,
      title: input.title,
      type: input.type ?? "llamada",
      dueAt: dueInstant(input.day, input.time, tz),
      allDay: !input.time,
      // D6: sin asignar explícito, es de quien la crea.
      assignedUserId: input.assignedUserId ?? actorUserId,
      createdBy: actorUserId,
    });
  avisar(organizationId, id, input.contactId);
  return id;
}

export async function editarTarea(
  organizationId: string,
  taskId: string,
  input: EditarTareaInput
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.task)
    .where(scoped(schema.task.organizationId, organizationId, eq(schema.task.id, taskId)))
    .limit(1);
  const current = rows[0];
  if (!current) throw new TareaError("no_encontrada", "La tarea no existe");

  await assertRefs(organizationId, {
    propertyId: input.propertyId,
    assignedUserId: input.assignedUserId,
  });

  const patch: Partial<typeof schema.task.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.type !== undefined) patch.type = input.type;
  if (input.propertyId !== undefined) patch.propertyId = input.propertyId;
  if (input.assignedUserId !== undefined) patch.assignedUserId = input.assignedUserId;
  if (input.day !== undefined) {
    const tz = await businessTimezone(organizationId);
    // Cambiar el día sin mandar hora conserva el «todo el día» actual solo si
    // ya lo era; mandar `time: null` lo vuelve explícitamente de todo el día.
    const time = input.time === undefined ? (current.allDay ? null : undefined) : input.time;
    if (time === undefined) {
      // Conserva la hora de pared actual en la zona del negocio.
      const hhmm = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(current.dueAt);
      patch.dueAt = dueInstant(input.day, hhmm, tz);
      patch.allDay = false;
    } else {
      patch.dueAt = dueInstant(input.day, time, tz);
      patch.allDay = time === null;
    }
  }
  if (input.done !== undefined) patch.doneAt = input.done ? (current.doneAt ?? new Date()) : null;

  await db
    .update(schema.task)
    .set(patch)
    .where(scoped(schema.task.organizationId, organizationId, eq(schema.task.id, taskId)));
  avisar(organizationId, taskId, current.contactId);
}

export async function borrarTarea(organizationId: string, taskId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .delete(schema.task)
    .where(scoped(schema.task.organizationId, organizationId, eq(schema.task.id, taskId)))
    .returning({ contactId: schema.task.contactId });
  const row = rows[0];
  if (!row) throw new TareaError("no_encontrada", "La tarea no existe");
  avisar(organizationId, taskId, row.contactId);
}
