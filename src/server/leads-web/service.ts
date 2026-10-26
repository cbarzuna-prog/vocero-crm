import { and, asc, eq, ilike, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import {
  externalIdFor,
  normalizePhoneCr,
  notaDelFormulario,
  tituloTarea,
  type WebLeadInput,
} from "@/lib/leads-web";
import { businessTimezone } from "@/server/analytics/period";
import { resolveInstanceOrg } from "@/server/bot/auth";
import { upsertFicha } from "@/server/bot/ficha";
import { publish } from "@/server/events/bus";
import { findWhatsappContact, getOrCreateContactByIdentity } from "@/server/inbox/identity";
import { createLeadForContact } from "@/server/inbox/lead-activity";
import { propiedadesEnabled } from "@/server/propiedades/flag";
import { vincular } from "@/server/propiedades/interes";
import { tareasEnabled } from "@/server/tareas/flag";

/**
 * 054 — Un formulario de la web → contacto, trato, vínculo con la propiedad y
 * tarea de seguimiento. Ver `specs/054-leads-desde-la-web/spec.md`.
 */

export class WebLeadError extends Error {
  constructor(
    public readonly code: "telefono_invalido" | "sin_organizacion",
    message: string
  ) {
    super(message);
    this.name = "WebLeadError";
  }
}

export type WebLeadResult = {
  ok: true;
  duplicate: boolean;
  contactId: string | null;
  leadCreated: boolean;
  propertyId: string | null;
  taskId: string | null;
};

type PropiedadEncontrada = { id: string; code: string; title: string };

/** D6 — código del CRM, luego el id de la web dentro de `url_externa`, luego la URL exacta. */
export async function encontrarPropiedad(
  organizationId: string,
  ref: WebLeadInput["property"]
): Promise<PropiedadEncontrada | null> {
  if (!ref) return null;
  const db = getDb();
  const cols = { id: schema.property.id, code: schema.property.code, title: schema.property.title };
  const vivas = (cond: ReturnType<typeof eq>) =>
    scoped(schema.property.organizationId, organizationId, isNull(schema.property.archivedAt), cond);

  if (ref.code) {
    const rows = await db
      .select(cols)
      .from(schema.property)
      .where(vivas(sql`upper(${schema.property.code}) = ${ref.code.toUpperCase()}`))
      .limit(1);
    if (rows[0]) return rows[0];
  }
  // Un id corto podría coincidir con cualquier URL: solo ids con cuerpo.
  if (ref.id && ref.id.length >= 8) {
    const patron = `%${ref.id.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await db
      .select(cols)
      .from(schema.property)
      .where(vivas(ilike(schema.property.urlExterna, patron)))
      .orderBy(asc(schema.property.createdAt))
      .limit(1);
    if (rows[0]) return rows[0];
  }
  if (ref.url) {
    const rows = await db
      .select(cols)
      .from(schema.property)
      .where(vivas(eq(schema.property.urlExterna, ref.url)))
      .limit(1);
    if (rows[0]) return rows[0];
  }
  return null;
}

/** D9 — la tarea es del dueño de la organización; si no hay, de nadie. */
async function duenoDeLaOrganizacion(organizationId: string): Promise<string | null> {
  const rows = await getDb()
    .select({ userId: schema.member.userId })
    .from(schema.member)
    .where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.role, "owner")))
    .orderBy(asc(schema.member.createdAt))
    .limit(1);
  return rows[0]?.userId ?? null;
}

function fechaDelNegocio(tz: string, at: Date): string {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
}

export async function recibirLeadWeb(
  input: WebLeadInput,
  rawPayload: Record<string, unknown>
): Promise<WebLeadResult> {
  const organizationId = await resolveInstanceOrg();
  if (!organizationId) throw new WebLeadError("sin_organizacion", "La instancia no tiene organización todavía");

  const phone = normalizePhoneCr(input.phone);
  if (!phone) throw new WebLeadError("telefono_invalido", "El teléfono no parece válido");

  const db = getDb();
  const externalId = externalIdFor(input, phone);

  // D8 — se reclama la llave ANTES de crear nada: dos reintentos simultáneos
  // no pueden pasar los dos.
  const webLeadId = newId("webLead");
  const claimed = await db
    .insert(schema.webLead)
    .values({ id: webLeadId, organizationId, externalId, payload: rawPayload })
    .onConflictDoNothing({ target: [schema.webLead.organizationId, schema.webLead.externalId] })
    .returning({ id: schema.webLead.id });
  if (!claimed[0]) {
    const prev = await db
      .select({ contactId: schema.webLead.contactId, propertyId: schema.webLead.propertyId })
      .from(schema.webLead)
      .where(scoped(schema.webLead.organizationId, organizationId, eq(schema.webLead.externalId, externalId)))
      .limit(1);
    return {
      ok: true,
      duplicate: true,
      contactId: prev[0]?.contactId ?? null,
      leadCreated: false,
      propertyId: prev[0]?.propertyId ?? null,
      taskId: null,
    };
  }

  try {
    return await procesar(organizationId, webLeadId, input, phone);
  } catch (err) {
    // Sin esto, un fallo a medias dejaría la llave tomada y el reintento de la
    // web se tomaría por duplicado: el lead se perdería en silencio.
    await db
      .delete(schema.webLead)
      .where(scoped(schema.webLead.organizationId, organizationId, eq(schema.webLead.id, webLeadId)));
    throw err;
  }
}

async function procesar(
  organizationId: string,
  webLeadId: string,
  input: WebLeadInput,
  phone: string
): Promise<WebLeadResult> {
  const db = getDb();
  const now = new Date();

  // H4 — quien ya escribió por WhatsApp es el mismo contacto. Su nombre no se
  // pisa con el del formulario; el nombre del formulario solo bautiza a los nuevos.
  const resolved = { identity: phone, phone, waUserId: null, profileName: null };
  const existing = await findWhatsappContact(organizationId, resolved);
  const { contact } = existing
    ? await getOrCreateContactByIdentity(organizationId, resolved)
    : await getOrCreateContactByIdentity(organizationId, { ...resolved, profileName: input.name });

  if (input.email) {
    await upsertFicha({ organizationId, contactId: contact.id, ficha: { email: input.email } });
  }

  // D5 — el trato nace en la primera etapa; si ya existe, no se mueve.
  const leads = await db
    .select({ id: schema.lead.id })
    .from(schema.lead)
    .where(scoped(schema.lead.organizationId, organizationId, eq(schema.lead.contactId, contact.id)))
    .limit(1);
  let leadCreated = false;
  if (leads[0]) {
    await db
      .update(schema.lead)
      .set({ lastActivityAt: now, updatedAt: now })
      .where(scoped(schema.lead.organizationId, organizationId, eq(schema.lead.id, leads[0].id)));
  } else {
    const creado = await createLeadForContact({ organizationId, contactId: contact.id, at: now, source: "sistema" });
    leadCreated = creado !== null;
  }

  // H2 — vínculo con la propiedad.
  const propiedad = propiedadesEnabled() ? await encontrarPropiedad(organizationId, input.property) : null;
  if (propiedad) {
    await vincular(organizationId, null, {
      contactId: contact.id,
      propertyId: propiedad.id,
      note: input.message,
    });
  }
  const etiqueta = propiedad
    ? `${propiedad.code} · ${propiedad.title}`
    : (input.property?.title ?? input.property?.code ?? null);

  // D7 — el mensaje anexado a las notas del contacto.
  const tz = await businessTimezone(organizationId);
  const nota = notaDelFormulario({
    fecha: fechaDelNegocio(tz, now),
    propiedad: etiqueta,
    mensaje: input.message,
    email: input.email,
  });
  await db
    .update(schema.contact)
    .set({
      notes: sql`case when coalesce(${schema.contact.notes}, '') = '' then ${nota} else ${schema.contact.notes} || E'\n\n' || ${nota} end`,
      updatedAt: now,
    })
    .where(scoped(schema.contact.organizationId, organizationId, eq(schema.contact.id, contact.id)));

  // H3 — la tarea para contestarle, vencida desde ya.
  let taskId: string | null = null;
  if (tareasEnabled()) {
    taskId = newId("task");
    await db.insert(schema.task).values({
      id: taskId,
      organizationId,
      contactId: contact.id,
      propertyId: propiedad?.id ?? null,
      title: tituloTarea(etiqueta),
      type: "whatsapp",
      dueAt: now,
      allDay: false,
      assignedUserId: await duenoDeLaOrganizacion(organizationId),
      createdBy: null,
    });
    publish(organizationId, { type: "task.changed", data: { taskId, contactId: contact.id } });
  }

  await db
    .update(schema.webLead)
    .set({ contactId: contact.id, propertyId: propiedad?.id ?? null })
    .where(scoped(schema.webLead.organizationId, organizationId, eq(schema.webLead.id, webLeadId)));

  return {
    ok: true,
    duplicate: false,
    contactId: contact.id,
    leadCreated,
    propertyId: propiedad?.id ?? null,
    taskId,
  };
}
