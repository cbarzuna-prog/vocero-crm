import { and, desc, eq, inArray, isNull, max, ne } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import type { ContactoFila, ContactoDetalle, EventoHistorial, MensajeReciente } from "@/lib/contactos";
import { effectiveSource } from "@/server/contact-source";
import { leerPerfil } from "@/server/perfil/service";

const ACTIVOS = ["interesado", "enviada", "visitada", "oferto"] as const;

/**
 * 057 (fork) — La lista de Contactos con lo que hace falta para trabajarla:
 * etapa y días en ella, la ficha inmobiliaria resumida, propiedades que le
 * interesan, tareas pendientes/vencidas y última actividad. Varias consultas
 * por tabla y la unión en memoria: un join de todo duplicaría filas (varias
 * propiedades, varias tareas) y la lista es de cientos, no de millones.
 * Excluye los contactos del Laboratorio (solo conversaciones de prueba).
 */
export async function listarContactos(organizationId: string): Promise<ContactoFila[]> {
  const db = getDb();
  const [contactos, leads, eventos, convs, perfiles, intereses, tareas, anuncios] = await Promise.all([
    db.select().from(schema.contact).where(scoped(schema.contact.organizationId, organizationId)).orderBy(desc(schema.contact.updatedAt)).limit(2000),
    db
      .select({
        id: schema.lead.id,
        contactId: schema.lead.contactId,
        stageId: schema.lead.stageId,
        createdAt: schema.lead.createdAt,
        priority: schema.lead.priority,
        stageName: schema.pipelineStage.name,
        stageKind: schema.pipelineStage.kind,
      })
      .from(schema.lead)
      .innerJoin(schema.pipelineStage, eq(schema.pipelineStage.id, schema.lead.stageId))
      .where(scoped(schema.lead.organizationId, organizationId)),
    db
      .select({ leadId: schema.leadStageEvent.leadId, en: max(schema.leadStageEvent.occurredAt) })
      .from(schema.leadStageEvent)
      .where(scoped(schema.leadStageEvent.organizationId, organizationId))
      .groupBy(schema.leadStageEvent.leadId),
    db
      .select({
        id: schema.conversation.id,
        contactId: schema.conversation.contactId,
        isTest: schema.conversation.isTest,
        lastMessageAt: schema.conversation.lastMessageAt,
        unread: schema.conversation.unreadCount,
      })
      .from(schema.conversation)
      .where(scoped(schema.conversation.organizationId, organizationId)),
    db.select().from(schema.contactPerfil).where(scoped(schema.contactPerfil.organizationId, organizationId)),
    db
      .select({ contactId: schema.propertyInterest.contactId, code: schema.property.code, status: schema.propertyInterest.status })
      .from(schema.propertyInterest)
      .innerJoin(schema.property, eq(schema.property.id, schema.propertyInterest.propertyId))
      .where(scoped(schema.propertyInterest.organizationId, organizationId, inArray(schema.propertyInterest.status, [...ACTIVOS]))),
    db
      .select({ contactId: schema.task.contactId, dueAt: schema.task.dueAt })
      .from(schema.task)
      .where(scoped(schema.task.organizationId, organizationId, isNull(schema.task.doneAt))),
    db
      .select({ contactId: schema.adAttribution.contactId })
      .from(schema.adAttribution)
      .where(scoped(schema.adAttribution.organizationId, organizationId)),
  ]);

  const leadDe = new Map(leads.map((l) => [l.contactId, l]));
  const entradaDe = new Map(eventos.map((e) => [e.leadId, e.en]));
  const perfilDe = new Map(perfiles.map((p) => [p.contactId, p]));
  const conAnuncio = new Set(anuncios.map((a) => a.contactId));
  const convsDe = new Map<string, typeof convs>();
  for (const c of convs) convsDe.set(c.contactId, [...(convsDe.get(c.contactId) ?? []), c]);
  const interesDe = new Map<string, string[]>();
  for (const i of intereses) if (!interesDe.get(i.contactId)?.includes(i.code)) interesDe.set(i.contactId, [...(interesDe.get(i.contactId) ?? []), i.code]);
  const ahora = Date.now();
  const tareasDe = new Map<string, { pendientes: number; vencidas: number }>();
  for (const t of tareas) {
    const x = tareasDe.get(t.contactId) ?? { pendientes: 0, vencidas: 0 };
    x.pendientes++;
    if (t.dueAt.getTime() < ahora) x.vencidas++;
    tareasDe.set(t.contactId, x);
  }

  const filas: ContactoFila[] = [];
  for (const c of contactos) {
    const cs = convsDe.get(c.id) ?? [];
    if (cs.length > 0 && cs.every((x) => x.isTest)) continue; // Laboratorio
    const reales = cs.filter((x) => !x.isTest);
    const conv = reales.sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0))[0] ?? null;
    const l = leadDe.get(c.id);
    const p = perfilDe.get(c.id);
    const enEtapa = l ? (entradaDe.get(l.id) ?? l.createdAt) : null;
    filas.push({
      id: c.id,
      name: c.name,
      phone: c.phone,
      notes: c.notes,
      aiPaused: c.aiPaused,
      archivedAt: c.archivedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      source: effectiveSource(c.source, conAnuncio.has(c.id)),
      priority: l?.priority ?? null,
      lead: l ? { id: l.id, stageId: l.stageId, stageName: l.stageName, stageKind: l.stageKind, desde: enEtapa!.toISOString() } : null,
      conversationId: conv?.id ?? null,
      noLeidos: conv?.unread ?? 0,
      ultimaActividad: (conv?.lastMessageAt ?? c.updatedAt).toISOString(),
      email: p?.email ?? null,
      tiposCliente: (p?.tiposCliente ?? []) as ContactoFila["tiposCliente"],
      operacion: p?.operacion ?? null,
      zonas: p?.zonas ?? [],
      presupuestoMinCents: p?.presupuestoMinCents ?? null,
      presupuestoMaxCents: p?.presupuestoMaxCents ?? null,
      moneda: p?.moneda ?? "USD",
      propiedades: interesDe.get(c.id) ?? [],
      tareas: tareasDe.get(c.id) ?? { pendientes: 0, vencidas: 0 },
    });
  }
  return filas;
}

/** 057 — Todo lo de una persona para su página: datos, historial y lo último que se dijeron. */
export async function detalleContacto(organizationId: string, contactId: string): Promise<ContactoDetalle | null> {
  const fila = (await listarContactos(organizationId)).find((f) => f.id === contactId);
  if (!fila) return null;
  const db = getDb();
  const [convs, etapas, interes, tareas, perfil] = await Promise.all([
    db
      .select({ id: schema.conversation.id })
      .from(schema.conversation)
      .where(scoped(schema.conversation.organizationId, organizationId, eq(schema.conversation.contactId, contactId), eq(schema.conversation.isTest, false))),
    db
      .select()
      .from(schema.leadStageEvent)
      .where(scoped(schema.leadStageEvent.organizationId, organizationId, eq(schema.leadStageEvent.contactId, contactId)))
      .orderBy(desc(schema.leadStageEvent.occurredAt))
      .limit(50),
    db
      .select({
        e: schema.propertyInterestEvent,
        code: schema.property.code,
        title: schema.property.title,
      })
      .from(schema.propertyInterestEvent)
      .innerJoin(schema.property, eq(schema.property.id, schema.propertyInterestEvent.propertyId))
      .where(scoped(schema.propertyInterestEvent.organizationId, organizationId, eq(schema.propertyInterestEvent.contactId, contactId)))
      .orderBy(desc(schema.propertyInterestEvent.occurredAt))
      .limit(50),
    db
      .select({ id: schema.task.id, title: schema.task.title, doneAt: schema.task.doneAt, createdAt: schema.task.createdAt })
      .from(schema.task)
      .where(scoped(schema.task.organizationId, organizationId, eq(schema.task.contactId, contactId)))
      .orderBy(desc(schema.task.createdAt))
      .limit(50),
    leerPerfil(organizationId, contactId),
  ]);

  const convIds = convs.map((c) => c.id);
  const mensajes = convIds.length
    ? await db
        .select({
          id: schema.message.id,
          direction: schema.message.direction,
          text: schema.message.text,
          type: schema.message.type,
          origin: schema.message.origin,
          createdAt: schema.message.createdAt,
        })
        .from(schema.message)
        .where(and(inArray(schema.message.conversationId, convIds), ne(schema.message.type, "reaction")))
        .orderBy(desc(schema.message.createdAt))
        .limit(15)
    : [];
  const primerMensaje = convIds.length
    ? (
        await db
          .select({ en: schema.message.createdAt })
          .from(schema.message)
          .where(and(inArray(schema.message.conversationId, convIds), eq(schema.message.direction, "in")))
          .orderBy(schema.message.createdAt)
          .limit(1)
      )[0]
    : undefined;

  const historial: EventoHistorial[] = [
    { tipo: "alta" as const, en: fila.createdAt, texto: "Se creó el contacto" },
    ...(primerMensaje ? [{ tipo: "mensaje" as const, en: primerMensaje.en.toISOString(), texto: "Escribió por primera vez" }] : []),
    ...etapas.map((e) => ({
      tipo: "etapa" as const,
      en: e.occurredAt.toISOString(),
      texto: e.fromStageName ? `Pasó de «${e.fromStageName}» a «${e.toStageName}»` : `Entró al pipeline en «${e.toStageName}»`,
      quien: e.source === "bot" ? ("agente" as const) : undefined,
    })),
    ...interes.map(({ e, code, title }) => ({
      tipo: "propiedad" as const,
      en: e.occurredAt.toISOString(),
      texto: e.fromStatus === null ? `Se le vinculó ${code} · ${title}` : `${code}: ${ESTADO_INTERES[e.toStatus] ?? e.toStatus}`,
    })),
    ...tareas.flatMap((t) => [
      { tipo: "tarea" as const, en: t.createdAt.toISOString(), texto: `Tarea: ${t.title}` },
      ...(t.doneAt ? [{ tipo: "tarea_hecha" as const, en: t.doneAt.toISOString(), texto: `Hecha: ${t.title}` }] : []),
    ]),
  ].sort((a, b) => b.en.localeCompare(a.en));

  return {
    contacto: fila,
    perfil,
    historial: historial.slice(0, 60),
    mensajes: mensajes
      .reverse()
      .map((m): MensajeReciente => ({
        id: m.id,
        direction: m.direction,
        text: m.text,
        type: m.type,
        deAgente: m.origin === "ai",
        en: m.createdAt.toISOString(),
      })),
  };
}

const ESTADO_INTERES: Record<string, string> = {
  interesado: "interesado",
  enviada: "se le envió la ficha",
  visitada: "visitó la propiedad",
  oferto: "hizo una oferta",
  ganada: "cerró",
  descartada: "la descartó",
};
