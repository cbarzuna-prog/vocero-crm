import { and, eq, inArray, isNotNull, isNull, max, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import {
  completarConfig,
  estadoAtencion,
  tiempoDeEtapa,
  ordenarPendientes,
  type AtencionDto,
  type PendienteAtencion,
  type ConfigAtencion,
  type EstadoAtencion,
} from "@/lib/atencion";
import { businessTimezone } from "@/server/analytics/period";
import { ETAPA_LABELS } from "@/lib/captaciones";

/** 062 (fork) — Semáforo de atención: la configuración y el cálculo. */

export async function leerConfigAtencion(organizationId: string): Promise<ConfigAtencion> {
  const [row] = await getDb()
    .select({ config: schema.configAtencion.config })
    .from(schema.configAtencion)
    .where(eq(schema.configAtencion.organizationId, organizationId))
    .limit(1);
  return completarConfig(row?.config ?? null);
}

export async function guardarConfigAtencion(organizationId: string, config: ConfigAtencion): Promise<ConfigAtencion> {
  await getDb()
    .insert(schema.configAtencion)
    .values({ organizationId, config, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.configAtencion.organizationId, set: { config, updatedAt: new Date() } });
  return completarConfig(config);
}

type Mensajes = { entrante: Date | null; saliente: Date | null };

/** Último mensaje entrante y saliente por contacto (sin conversaciones del Laboratorio). */
async function mensajesPorContacto(organizationId: string, contactIds: string[]): Promise<Map<string, Mensajes>> {
  const m = new Map<string, Mensajes>();
  if (contactIds.length === 0) return m;
  const db = getDb();
  const C = schema.conversation;
  const M = schema.message;
  const rows = await db
    .select({ contactId: C.contactId, direction: M.direction, en: max(M.createdAt) })
    .from(M)
    .innerJoin(C, eq(C.id, M.conversationId))
    .where(and(scoped(C.organizationId, organizationId, eq(C.isTest, false), inArray(C.contactId, contactIds)), sql`${M.type} <> 'reaction'`))
    .groupBy(C.contactId, M.direction);
  for (const r of rows) {
    if (!r.en) continue;
    const x = m.get(r.contactId) ?? { entrante: null, saliente: null };
    if (r.direction === "in") x.entrante = r.en;
    else x.saliente = r.en;
    m.set(r.contactId, x);
  }
  return m;
}

export async function calcularAtencion(organizationId: string, ahora = new Date()): Promise<AtencionDto> {
  const db = getDb();
  const [cfg, tz] = await Promise.all([leerConfigAtencion(organizationId), businessTimezone(organizationId)]);

  const [leads, etapas, captaciones] = await Promise.all([
    db
      .select({
        id: schema.lead.id,
        contactId: schema.lead.contactId,
        createdAt: schema.lead.createdAt,
        stageId: schema.lead.stageId,
        stageName: schema.pipelineStage.name,
        stageKind: schema.pipelineStage.kind,
        nombre: schema.contact.name,
      })
      .from(schema.lead)
      .innerJoin(schema.pipelineStage, eq(schema.pipelineStage.id, schema.lead.stageId))
      .innerJoin(schema.contact, eq(schema.contact.id, schema.lead.contactId))
      .where(scoped(schema.lead.organizationId, organizationId)),
    db
      .select({ leadId: schema.leadStageEvent.leadId, en: max(schema.leadStageEvent.occurredAt) })
      .from(schema.leadStageEvent)
      .where(scoped(schema.leadStageEvent.organizationId, organizationId))
      .groupBy(schema.leadStageEvent.leadId),
    db
      .select({
        id: schema.property.id,
        etapa: schema.property.captacionEtapa,
        desde: schema.property.captacionDesde,
        createdAt: schema.property.createdAt,
        sellerContactId: schema.property.sellerContactId,
        code: schema.property.code,
        title: schema.property.title,
      })
      .from(schema.property)
      .where(scoped(schema.property.organizationId, organizationId, isNotNull(schema.property.captacionEtapa), isNull(schema.property.archivedAt), sql`${schema.property.captacionEtapa} <> 'perdida'`)),
  ]);

  const contactIds = [...new Set([...leads.map((l) => l.contactId), ...captaciones.flatMap((c) => (c.sellerContactId ? [c.sellerContactId] : []))])];
  const T = schema.task;
  const [mensajes, abiertas, hechasContacto, abiertasProp, hechasProp] = await Promise.all([
    mensajesPorContacto(organizationId, contactIds),
    // La próxima tarea abierta de cada contacto (la de vencimiento más cercano).
    contactIds.length
      ? db
          .selectDistinctOn([T.contactId], { contactId: T.contactId, titulo: T.title, vence: T.dueAt })
          .from(T)
          .where(scoped(T.organizationId, organizationId, isNull(T.doneAt), inArray(T.contactId, contactIds)))
          .orderBy(T.contactId, T.dueAt)
      : Promise.resolve([]),
    contactIds.length
      ? db
          .select({ contactId: T.contactId, en: max(T.doneAt) })
          .from(T)
          .where(scoped(T.organizationId, organizationId, isNotNull(T.doneAt), inArray(T.contactId, contactIds)))
          .groupBy(T.contactId)
      : Promise.resolve([]),
    captaciones.length
      ? db
          .selectDistinctOn([T.propertyId], { propertyId: T.propertyId, titulo: T.title, vence: T.dueAt })
          .from(T)
          .where(scoped(T.organizationId, organizationId, isNull(T.doneAt), inArray(T.propertyId, captaciones.map((c) => c.id))))
          .orderBy(T.propertyId, T.dueAt)
      : Promise.resolve([]),
    captaciones.length
      ? db
          .select({ propertyId: T.propertyId, en: max(T.doneAt) })
          .from(T)
          .where(scoped(T.organizationId, organizationId, isNotNull(T.doneAt), inArray(T.propertyId, captaciones.map((c) => c.id))))
          .groupBy(T.propertyId)
      : Promise.resolve([]),
  ]);

  const etapaDe = new Map(etapas.map((e) => [e.leadId, e.en]));
  const proxima = new Map(abiertas.map((t) => [t.contactId, { titulo: t.titulo, vence: t.vence }]));
  const hecha = new Map(hechasContacto.map((t) => [t.contactId, t.en]));
  const proximaProp = new Map(abiertasProp.map((t) => [t.propertyId!, { titulo: t.titulo, vence: t.vence }]));
  const hechaProp = new Map(hechasProp.map((t) => [t.propertyId!, t.en]));
  const masReciente = (...ds: (Date | null | undefined)[]) => ds.filter((d): d is Date => !!d).reduce((a, b) => (a > b ? a : b));

  const out: AtencionDto = { horario: cfg.horario, leads: {}, captaciones: {}, pendientes: [] };
  const pendientes: PendienteAtencion[] = [];
  for (const l of leads) {
    const msg = mensajes.get(l.contactId);
    const e = estadoAtencion(
      {
        abierta: l.stageKind === "open",
        tiempo: tiempoDeEtapa(cfg, { id: l.stageId, name: l.stageName }),
        ultimoEntrante: msg?.entrante ?? null,
        ultimoSaliente: msg?.saliente ?? null,
        ultimoContacto: masReciente(l.createdAt, etapaDe.get(l.id), hecha.get(l.contactId)),
        proximaTarea: proxima.get(l.contactId) ?? null,
      },
      cfg,
      ahora,
      tz
    );
    if (e) {
      out.leads[l.id] = e;
      pendientes.push({ ...e, tipo: "trato", id: l.id, nombre: l.nombre, etapa: l.stageName, href: `/contacts/${l.contactId}` });
    }
  }
  for (const c of captaciones) {
    const tiempo = cfg.captaciones[c.etapa!];
    if (!tiempo) continue;
    const msg = c.sellerContactId ? mensajes.get(c.sellerContactId) : undefined;
    const e = estadoAtencion(
      {
        abierta: true,
        tiempo,
        // En captaciones el mensaje del dueño sin responder también manda.
        ultimoEntrante: msg?.entrante ?? null,
        ultimoSaliente: msg?.saliente ?? null,
        ultimoContacto: masReciente(c.desde ?? c.createdAt, hechaProp.get(c.id)),
        proximaTarea: proximaProp.get(c.id) ?? null,
      },
      cfg,
      ahora,
      tz
    );
    if (e) {
      out.captaciones[c.id] = e;
      pendientes.push({ ...e, tipo: "captacion", id: c.id, nombre: `${c.code} · ${c.title}`, etapa: ETAPA_LABELS[c.etapa!], href: `/propiedades/${c.id}` });
    }
  }
  out.pendientes = ordenarPendientes(pendientes);
  return out;
}

/** Cuántos tratos y captaciones están en rojo (para el menú y «Hoy»). */
export function contarRojos(a: AtencionDto): number {
  return [...Object.values(a.leads), ...Object.values(a.captaciones)].filter((e: EstadoAtencion) => e.nivel === "rojo").length;
}

