import { and, asc, eq, ilike, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { normalizeMx } from "@/lib/meta/client";
import { perfilDesdeFicha } from "@/lib/perfil-cliente";
import { todayInTz } from "@/lib/time/slots";
import { notaWeb, telefonoWeb, tipoDe, tituloTarea, webIdDeUrl, type TipoWeb, type WebLead } from "@/lib/web-leads";
import { businessTimezone } from "@/server/analytics/period";
import { createLeadForContact } from "@/server/inbox/lead-activity";
import { fusionarAutomatico } from "@/server/perfil/service";
import { vincular } from "@/server/propiedades/interes";
import { crearTarea } from "@/server/tareas/service";

export class WebLeadError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "WebLeadError";
  }
}

export type ResultadoWeb = { contactId: string; duplicado: boolean; propertyId: string | null; referidorId: string | null };

const hhmm = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const fechaCorta = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("es-CR", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

/** La propiedad del CRM que corresponde a la del sitio: por id web, por su URL, por código o por título. */
async function propiedadDe(organizationId: string, p: WebLead["property"]) {
  if (!p) return null;
  const db = getDb();
  const P = schema.property;
  const sel = { id: P.id, code: P.code, title: P.title, webId: P.webId };
  const webId = (p.id ?? webIdDeUrl(p.url) ?? "").toLowerCase() || null;
  if (webId) {
    const [a] = await db.select(sel).from(P).where(scoped(P.organizationId, organizationId, eq(P.webId, webId))).limit(1);
    if (a) return a;
    const [b] = await db.select(sel).from(P).where(scoped(P.organizationId, organizationId, ilike(P.urlExterna, `%${webId}%`))).limit(1);
    if (b) return { ...b, nuevoWebId: webId };
  }
  if (p.code) {
    const [c] = await db.select(sel).from(P).where(scoped(P.organizationId, organizationId, eq(P.code, p.code.toUpperCase()))).limit(1);
    if (c) return { ...c, nuevoWebId: webId };
  }
  if (p.title) {
    const [d] = await db
      .select(sel)
      .from(P)
      .where(scoped(P.organizationId, organizationId, sql`lower(${P.title}) = lower(${p.title})`, isNull(P.archivedAt)))
      .limit(1);
    if (d) return { ...d, nuevoWebId: webId };
  }
  return null;
}

/** A quién le toca: el propietario con menos tareas pendientes (reparto parejo entre socios). */
async function responsable(organizationId: string): Promise<string | null> {
  const db = getDb();
  const filas = await db
    .select({
      userId: schema.member.userId,
      pendientes: sql<number>`(select count(*) from ${schema.task} t where t.organization_id = ${organizationId} and t.assigned_user_id = ${schema.member.userId} and t.done_at is null)`.mapWith(Number),
    })
    .from(schema.member)
    .where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.role, "owner")))
    .orderBy(asc(schema.member.createdAt));
  if (filas.length === 0) return null;
  return [...filas].sort((a, b) => a.pendientes - b.pendientes)[0]!.userId;
}

async function upsertReferidor(organizationId: string, r: NonNullable<WebLead["referrer"]>): Promise<string | null> {
  if (!r.id && !r.code) return null;
  const db = getDb();
  const R = schema.referidor;
  const [hay] = await db
    .select({ id: R.id })
    .from(R)
    .where(scoped(R.organizationId, organizationId, r.id ? eq(R.webId, r.id) : eq(R.codigo, r.code!)))
    .limit(1);
  if (hay) {
    if (r.name || r.code) {
      await db
        .update(R)
        .set({ ...(r.name ? { nombre: r.name } : {}), ...(r.code ? { codigo: r.code } : {}), updatedAt: new Date() })
        .where(eq(R.id, hay.id))
        .catch(() => undefined); // un código repetido no tumba el lead
    }
    return hay.id;
  }
  const id = newId("referidor");
  const [nuevo] = await db
    .insert(R)
    .values({
      id,
      organizationId,
      webId: r.id ?? null,
      codigo: r.code ?? null,
      nombre: r.name ?? r.code ?? "Referidor",
      email: r.email ?? null,
      telefono: r.phone ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: R.id });
  if (nuevo) return nuevo.id;
  const [otro] = await db
    .select({ id: R.id })
    .from(R)
    .where(scoped(R.organizationId, organizationId, r.code ? eq(R.codigo, r.code) : eq(R.webId, r.id!)))
    .limit(1);
  return otro?.id ?? null;
}

async function contactoDe(organizationId: string, telefono: string | null, email: string | null, nombre: string, referido: boolean) {
  const db = getDb();
  const C = schema.contact;
  if (telefono) {
    const [c] = await db
      .select({ id: C.id, source: C.source, notes: C.notes })
      .from(C)
      .where(scoped(C.organizationId, organizationId, eq(C.channel, "whatsapp"), eq(C.waIdentity, telefono)))
      .limit(1);
    if (c) return { ...c, nuevo: false };
  }
  if (email) {
    const [c] = await db
      .select({ id: C.id, source: C.source, notes: C.notes })
      .from(C)
      .innerJoin(schema.contactPerfil, eq(schema.contactPerfil.contactId, C.id))
      .where(scoped(C.organizationId, organizationId, eq(schema.contactPerfil.email, email)))
      .limit(1);
    if (c) return { ...c, nuevo: false };
  }
  const id = newId("contact");
  const identidad = telefono ?? `web:${email}`;
  const [creado] = await db
    .insert(C)
    .values({
      id,
      organizationId,
      name: nombre,
      nameSource: "manual",
      phone: telefono,
      waIdentity: identidad,
      source: referido ? "referido" : "organico",
    })
    .onConflictDoNothing()
    .returning({ id: C.id, source: C.source, notes: C.notes });
  if (creado) {
    await createLeadForContact({ organizationId, contactId: creado.id, source: "sistema" });
    return { ...creado, nuevo: true };
  }
  // Carrera con otro envío del mismo teléfono: el que ganó.
  const [c] = await db
    .select({ id: C.id, source: C.source, notes: C.notes })
    .from(C)
    .where(scoped(C.organizationId, organizationId, eq(C.channel, "whatsapp"), eq(C.waIdentity, identidad)))
    .limit(1);
  if (!c) throw new WebLeadError("contacto", "No se pudo crear el contacto");
  return { ...c, nuevo: false };
}

/** Lo que el formulario dice que busca → ficha inmobiliaria (mismo traductor que usa el agente). */
function perfilDesdeWeb(tipo: TipoWeb, lead: WebLead, email: string | null) {
  const pref = lead.preferences ?? {};
  const moneda = pref.currency ?? "USD";
  const ficha: Record<string, unknown> = {
    correo: email ?? undefined,
    tipo_cliente: tipo === "vendedor" ? "vendedor" : tipo === "contacto" ? undefined : "comprador",
    operacion: pref.operation,
    tipo_propiedad: pref.types,
    zonas: pref.zones,
    presupuesto_min: pref.budgetMin !== undefined ? `${pref.budgetMin} ${moneda}` : undefined,
    presupuesto_max: pref.budgetMax !== undefined ? `${pref.budgetMax} ${moneda}` : undefined,
    habitaciones: pref.bedrooms,
    para_cuando: pref.timeline,
    idioma: lead.language?.toLowerCase().startsWith("en") ? "inglés" : undefined,
  };
  for (const k of Object.keys(ficha)) if (ficha[k] === undefined) delete ficha[k];
  return perfilDesdeFicha(ficha);
}

/**
 * 058 — Un envío de un formulario del sitio, de punta a punta: contacto (sin
 * duplicar por teléfono ni por correo), lead en el pipeline, ficha
 * inmobiliaria, interés en la propiedad, referidor, nota y UNA tarea para
 * responder. Idempotente por el `id` del envío: si el sitio reintenta, no se
 * duplica nada.
 */
export async function recibirLeadWeb(organizationId: string, lead: WebLead): Promise<ResultadoWeb> {
  const db = getDb();
  const tipo = tipoDe(lead);
  const telefono = (() => {
    const t = telefonoWeb(lead.phone);
    return t ? normalizeMx(t) : null;
  })();
  const email = lead.email?.toLowerCase().match(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i)?.[0] ?? null;
  if (!telefono && !email) throw new WebLeadError("sin_contacto", "El envío no trae un teléfono ni un correo válidos");

  // Reclamo del recibo primero: dos reintentos simultáneos no crean dos leads.
  const [reclamo] = await db
    .insert(schema.webLead)
    .values({ id: lead.id, organizationId, tipo, propiedadTitulo: lead.property?.title ?? null, paginaUrl: lead.pageUrl ?? lead.property?.url ?? null })
    .onConflictDoNothing()
    .returning({ id: schema.webLead.id });
  if (!reclamo) {
    const [r] = await db
      .select({ contactId: schema.webLead.contactId, propertyId: schema.webLead.propertyId, referidorId: schema.webLead.referidorId })
      .from(schema.webLead)
      .where(scoped(schema.webLead.organizationId, organizationId, eq(schema.webLead.id, lead.id)))
      .limit(1);
    if (r?.contactId) return { contactId: r.contactId, duplicado: true, propertyId: r.propertyId, referidorId: r.referidorId };
    throw new WebLeadError("en_proceso", "Ese envío ya se está procesando");
  }

  try {
    const tz = await businessTimezone(organizationId);
    const ahora = new Date();
    const referidorId = lead.referrer ? await upsertReferidor(organizationId, lead.referrer) : null;
    const nombre = lead.name ?? email ?? (telefono ? `+${telefono}` : "Sitio web");
    const contacto = await contactoDe(organizationId, telefono, email, nombre, !!referidorId);

    const prop = await propiedadDe(organizationId, lead.property);
    if (prop && "nuevoWebId" in prop && prop.nuevoWebId && !prop.webId) {
      await db.update(schema.property).set({ webId: prop.nuevoWebId }).where(eq(schema.property.id, prop.id)).catch(() => undefined);
    }
    if (prop && tipo !== "vendedor") {
      await vincular(organizationId, null, { contactId: contacto.id, propertyId: prop.id }).catch(() => undefined);
    }

    if (referidorId) {
      await db
        .insert(schema.contactReferencia)
        .values({ contactId: contacto.id, organizationId, referidorId, propertyId: prop?.id ?? null })
        .onConflictDoNothing();
      if (!contacto.source) {
        await db.update(schema.contact).set({ source: "referido" }).where(eq(schema.contact.id, contacto.id));
      }
    }

    await fusionarAutomatico(organizationId, contacto.id, perfilDesdeWeb(tipo, lead, email), "web", { sumarListas: true });

    const propTexto = prop ? `${prop.code} · ${prop.title}` : (lead.property?.title ?? null);
    const refTexto = lead.referrer ? [lead.referrer.name, lead.referrer.code].filter(Boolean).join(" · ") : null;
    const nota = notaWeb(tipo, lead, propTexto, refTexto, fechaCorta(ahora, tz));
    await db
      .update(schema.contact)
      .set({ notes: contacto.notes ? `${contacto.notes}\n\n${nota}` : nota, updatedAt: ahora })
      .where(eq(schema.contact.id, contacto.id));

    // Una sola tarea abierta por propiedad: si vuelve a escribir, no se apilan.
    const titulo = tituloTarea(tipo, prop ? { code: prop.code, title: prop.title } : lead.property ? { title: lead.property.title } : null);
    const [abierta] = await db
      .select({ id: schema.task.id })
      .from(schema.task)
      .where(scoped(schema.task.organizationId, organizationId, eq(schema.task.contactId, contacto.id), eq(schema.task.title, titulo), isNull(schema.task.doneAt)))
      .limit(1);
    if (!abierta) {
      const quien = await responsable(organizationId);
      if (quien) {
        await crearTarea(organizationId, quien, {
          contactId: contacto.id,
          propertyId: prop?.id ?? null,
          title: titulo,
          type: "whatsapp",
          day: todayInTz(ahora, tz),
          time: hhmm(ahora, tz),
          assignedUserId: quien,
        });
      }
    }

    await db
      .update(schema.webLead)
      .set({ contactId: contacto.id, propertyId: prop?.id ?? null, referidorId })
      .where(eq(schema.webLead.id, lead.id));
    return { contactId: contacto.id, duplicado: false, propertyId: prop?.id ?? null, referidorId };
  } catch (err) {
    // Sin recibo a medias: el sitio puede reintentar.
    await db.delete(schema.webLead).where(eq(schema.webLead.id, lead.id)).catch(() => undefined);
    throw err;
  }
}
