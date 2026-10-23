import { and, asc, desc, eq, gte, isNull, lt, notExists, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { addDaysISO, todayInTz, zonedWallClockToUtc } from "@/lib/time/slots";
import { compareTasks, type HoyDto, type SinSiguientePasoDto, type TaskDto } from "@/lib/tareas";
import { businessTimezone } from "@/server/analytics/period";
import { notLabContact } from "@/server/analytics/shared";

/**
 * 046 — Lecturas de tareas. «Hoy» se decide en la zona del NEGOCIO, no en la
 * del navegador ni en UTC: quien mira puede estar de viaje.
 */

const SECTION_LIMIT = 200;

async function selectTasks(organizationId: string, where: SQL | undefined, order: "asc" | "desc" = "asc") {
  const rows = await getDb()
    .select({
      task: schema.task,
      contactName: schema.contact.name,
      propertyCode: schema.property.code,
      propertyTitle: schema.property.title,
      userName: schema.user.name,
    })
    .from(schema.task)
    .innerJoin(schema.contact, eq(schema.contact.id, schema.task.contactId))
    .leftJoin(schema.property, eq(schema.property.id, schema.task.propertyId))
    .leftJoin(schema.user, eq(schema.user.id, schema.task.assignedUserId))
    .where(scoped(schema.task.organizationId, organizationId, where))
    .orderBy(order === "asc" ? asc(schema.task.dueAt) : desc(schema.task.dueAt))
    .limit(SECTION_LIMIT);

  return rows.map(
    (r): TaskDto => ({
      id: r.task.id,
      title: r.task.title,
      type: r.task.type,
      dueAt: r.task.dueAt.toISOString(),
      allDay: r.task.allDay,
      doneAt: r.task.doneAt?.toISOString() ?? null,
      contact: { id: r.task.contactId, name: r.contactName },
      property:
        r.task.propertyId && r.propertyCode
          ? { id: r.task.propertyId, code: r.propertyCode, title: r.propertyTitle ?? "" }
          : null,
      assignedUserId: r.task.assignedUserId,
      assignedUserName: r.userName ?? null,
    })
  );
}

/** Límites UTC del día de hoy en la zona del negocio. */
export function todayBounds(now: Date, tz: string) {
  const today = todayInTz(now, tz);
  const start = zonedWallClockToUtc(today, "00:00", tz)!;
  const end = zonedWallClockToUtc(addDaysISO(today, 1), "00:00", tz)!;
  return { today, start, end };
}

export async function hoy(
  organizationId: string,
  opts: { soloDe?: string | null; now?: Date } = {}
): Promise<HoyDto> {
  const now = opts.now ?? new Date();
  const timezone = await businessTimezone(organizationId);
  const { today, start, end } = todayBounds(now, timezone);
  const mine = opts.soloDe ? eq(schema.task.assignedUserId, opts.soloDe) : undefined;
  const pending = isNull(schema.task.doneAt);

  const [vencidas, deHoy, sinSiguientePaso] = await Promise.all([
    selectTasks(organizationId, and(pending, lt(schema.task.dueAt, start), mine)),
    selectTasks(
      organizationId,
      and(pending, gte(schema.task.dueAt, start), lt(schema.task.dueAt, end), mine)
    ),
    sinSiguiente(organizationId),
  ]);

  return {
    today,
    timezone,
    vencidas,
    hoy: deHoy.sort(compareTasks),
    sinSiguientePaso,
  };
}

/**
 * D7 — Tratos abiertos (etapa `open`) de contactos reales (fuera del
 * Laboratorio) sin ninguna tarea pendiente. El más olvidado primero.
 */
export async function sinSiguiente(organizationId: string): Promise<SinSiguientePasoDto[]> {
  const db = getDb();
  const rows = await db
    .select({
      leadId: schema.lead.id,
      contactId: schema.contact.id,
      contactName: schema.contact.name,
      stageName: schema.pipelineStage.name,
      lastActivityAt: schema.lead.lastActivityAt,
    })
    .from(schema.lead)
    .innerJoin(schema.contact, eq(schema.contact.id, schema.lead.contactId))
    .innerJoin(schema.pipelineStage, eq(schema.pipelineStage.id, schema.lead.stageId))
    .where(
      scoped(
        schema.lead.organizationId,
        organizationId,
        eq(schema.pipelineStage.kind, "open"),
        isNull(schema.contact.archivedAt),
        notLabContact(schema.lead.contactId),
        notExists(
          db
            .select({ one: sql`1` })
            .from(schema.task)
            .where(
              and(
                eq(schema.task.organizationId, organizationId),
                eq(schema.task.contactId, schema.lead.contactId),
                isNull(schema.task.doneAt)
              )
            )
        )
      )
    )
    .orderBy(sql`${schema.lead.lastActivityAt} asc nulls first`)
    .limit(SECTION_LIMIT);

  return rows.map((r) => ({
    leadId: r.leadId,
    contact: { id: r.contactId, name: r.contactName },
    stageName: r.stageName,
    lastActivityAt: r.lastActivityAt?.toISOString() ?? null,
  }));
}

/** Las del contacto: pendientes primero (por fecha) y las últimas 20 hechas. */
export async function tareasDelContacto(organizationId: string, contactId: string, now = new Date()) {
  const byContact = eq(schema.task.contactId, contactId);
  const [timezone, pendientes, hechas] = await Promise.all([
    businessTimezone(organizationId),
    selectTasks(organizationId, and(byContact, isNull(schema.task.doneAt))),
    selectTasks(organizationId, and(byContact, sql`${schema.task.doneAt} is not null`), "desc"),
  ]);
  return {
    today: todayInTz(now, timezone),
    timezone,
    pendientes,
    hechas: hechas.slice(0, 20),
  };
}

/** Para el contador del menú: vencidas y de hoy, pendientes. */
export async function contador(
  organizationId: string,
  opts: { soloDe?: string | null; now?: Date } = {}
): Promise<{ vencidas: number; hoy: number }> {
  const timezone = await businessTimezone(organizationId);
  const bounds = todayBounds(opts.now ?? new Date(), timezone);
  // En SQL crudo postgres-js no serializa Date: va como ISO (columna en UTC).
  const start = bounds.start.toISOString();
  const end = bounds.end.toISOString();
  const mine = opts.soloDe ? eq(schema.task.assignedUserId, opts.soloDe) : undefined;
  const rows = await getDb()
    .select({
      vencidas: sql<number>`count(*) filter (where ${schema.task.dueAt} < ${start})`.mapWith(Number),
      hoy: sql<number>`count(*) filter (where ${schema.task.dueAt} >= ${start} and ${schema.task.dueAt} < ${end})`.mapWith(Number),
    })
    .from(schema.task)
    .where(scoped(schema.task.organizationId, organizationId, isNull(schema.task.doneAt), mine));
  return { vencidas: rows[0]?.vencidas ?? 0, hoy: rows[0]?.hoy ?? 0 };
}
