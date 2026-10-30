import { asc, eq, ilike, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import {
  COMISION_VENTA_BP,
  DIAS_AVISO_RENOVAR,
  estadoParaEtapa,
  MESES_EXCLUSIVA,
  restarDias,
  sumarMeses,
  tituloRenovar,
  type CaptacionTarjeta,
  type MoverCaptacionInput,
  type NuevaCaptacionInput,
} from "@/lib/captaciones";
import { coverUrl } from "@/lib/propiedades";
import { todayInTz } from "@/lib/time/slots";
import { telefonoWeb } from "@/lib/web-leads";
import { businessTimezone } from "@/server/analytics/period";
import { guardarPerfil, leerPerfil } from "@/server/perfil/service";
import { crearPropiedad } from "@/server/propiedades/service";
import { participantesDe } from "@/server/colaboracion/service";
import { crearTarea, dueInstant } from "@/server/tareas/service";

/**
 * 048 (fork) — Captaciones: el pipeline de vendedores. Cada tarjeta es una
 * propiedad con `captacion_etapa`; el dueño es su `seller_contact_id`.
 */

export class CaptacionError extends Error {
  constructor(
    readonly code: "no_encontrada" | "telefono_invalido" | "sin_dueno",
    message: string
  ) {
    super(message);
    this.name = "CaptacionError";
  }
}

const coverAsset = sql<string | null>`(
  select pph."media_asset_id" from "property_photo" pph
  where pph."property_id" = "property"."id"
  order by pph."position" asc limit 1
)`;

/** Las tarjetas del tablero. Publicadas y no captadas, solo las de los últimos 60 días. */
export async function listarCaptaciones(organizationId: string): Promise<CaptacionTarjeta[]> {
  const P = schema.property;
  const rows = await getDb()
    .select({
      p: P,
      cover: coverAsset,
      duenoNombre: schema.contact.name,
      duenoTel: schema.contact.phone,
    })
    .from(P)
    .leftJoin(schema.contact, eq(schema.contact.id, P.sellerContactId))
    .where(
      scoped(
        P.organizationId,
        organizationId,
        isNotNull(P.captacionEtapa),
        isNull(P.archivedAt),
        // Lo que ya salió del embudo (publicada o no captada) solo un tiempo: lo viejo estorba.
        sql`(${P.captacionEtapa} not in ('perdida', 'publicada') or ${P.captacionDesde} > now() - interval '60 days')`
      )
    )
    .orderBy(asc(P.captacionDesde));
  const participantes = await participantesDe(organizationId, rows.map((r) => r.p.id));
  return rows.map(({ p, cover, duenoNombre, duenoTel }) => ({
    participantes: participantes.get(p.id) ?? [],
    id: p.id,
    code: p.code,
    title: p.title,
    operation: p.operation,
    type: p.type,
    status: p.status,
    etapa: p.captacionEtapa!,
    desde: (p.captacionDesde ?? p.createdAt).toISOString(),
    priceCents: p.priceCents,
    currency: p.currency,
    zona: p.zona,
    canton: p.canton,
    provincia: p.provincia,
    comisionBp: p.comisionBp,
    exclusivaVence: p.exclusivaVence,
    motivo: p.motivoNoCaptada,
    coverUrl: coverUrl(cover),
    dueno: p.sellerContactId && duenoNombre ? { id: p.sellerContactId, name: duenoNombre, phone: duenoTel } : null,
  }));
}

/** El dueño: el contacto elegido, el que ya tiene ese teléfono, o uno nuevo. */
async function duenoDe(organizationId: string, input: NuevaCaptacionInput): Promise<string> {
  const db = getDb();
  const C = schema.contact;
  if (input.contactId) {
    const [c] = await db.select({ id: C.id }).from(C).where(scoped(C.organizationId, organizationId, eq(C.id, input.contactId))).limit(1);
    if (!c) throw new CaptacionError("sin_dueno", "Ese contacto no existe");
    return c.id;
  }
  return contactoPorTelefono(organizationId, input.nombre!, input.telefono ?? "");
}

/**
 * 048/060 — El contacto con ese teléfono, o uno nuevo con ese nombre. Sin trato
 * en el Pipeline: un dueño o un co-corredor no es un comprador.
 */
export async function contactoPorTelefono(organizationId: string, nombre: string, telefono: string): Promise<string> {
  const db = getDb();
  const C = schema.contact;
  const tel = telefonoWeb(telefono);
  if (!tel) throw new CaptacionError("telefono_invalido", "Revise el teléfono: 8 dígitos de Costa Rica o con código de país");
  const [ya] = await db
    .select({ id: C.id })
    .from(C)
    .where(scoped(C.organizationId, organizationId, eq(C.channel, "whatsapp"), eq(C.waIdentity, tel)))
    .limit(1);
  if (ya) return ya.id;
  const [nuevo] = await db
    .insert(C)
    .values({ id: newId("contact"), organizationId, name: nombre, phone: tel, waIdentity: tel, source: null })
    .onConflictDoNothing({ target: [C.organizationId, C.channel, C.waIdentity] })
    .returning({ id: C.id });
  if (nuevo) return nuevo.id;
  const [carrera] = await db.select({ id: C.id }).from(C).where(scoped(C.organizationId, organizationId, eq(C.waIdentity, tel))).limit(1);
  return carrera!.id;
}

/** Marca al dueño como «vendedor» en su ficha, sin quitarle lo demás. */
async function marcarVendedor(organizationId: string, contactId: string) {
  const perfil = await leerPerfil(organizationId, contactId).catch(() => null);
  if (!perfil || perfil.tiposCliente.includes("vendedor")) return;
  await guardarPerfil(organizationId, contactId, { tiposCliente: [...perfil.tiposCliente, "vendedor"] }).catch(() => undefined);
}

async function registrar(organizationId: string, propertyId: string, de: CaptacionTarjeta["etapa"] | null, a: CaptacionTarjeta["etapa"], actor: string) {
  await getDb()
    .insert(schema.captacionEvento)
    .values({ id: newId("captacionEvento"), organizationId, propertyId, deEtapa: de, aEtapa: a, actorUserId: actor });
}

export async function crearCaptacion(organizationId: string, actorUserId: string, input: NuevaCaptacionInput): Promise<{ id: string; code: string; contactId: string }> {
  const contactId = await duenoDe(organizationId, input);
  const creada = await crearPropiedad(organizationId, actorUserId, {
    operation: input.operation,
    type: input.type,
    provincia: input.provincia,
    canton: input.canton,
    zona: input.zona,
    priceCents: input.priceCents ?? null,
    currency: input.currency,
    status: "captacion",
  });
  await getDb()
    .update(schema.property)
    .set({
      sellerContactId: contactId,
      captacionEtapa: "contacto",
      captacionDesde: new Date(),
      comisionBp: input.operation === "venta" ? COMISION_VENTA_BP : null,
      notasInternas: input.nota ?? null,
    })
    .where(eq(schema.property.id, creada.id));
  await registrar(organizationId, creada.id, null, "contacto", actorUserId);
  await marcarVendedor(organizationId, contactId);
  return { ...creada, contactId };
}

export async function moverCaptacion(organizationId: string, actorUserId: string, propertyId: string, input: MoverCaptacionInput): Promise<void> {
  const db = getDb();
  const P = schema.property;
  const [p] = await db.select().from(P).where(scoped(P.organizationId, organizationId, eq(P.id, propertyId))).limit(1);
  if (!p) throw new CaptacionError("no_encontrada", "La captación no existe");

  const tz = await businessTimezone(organizationId);
  const hoy = todayInTz(new Date(), tz);
  const patch: Partial<typeof P.$inferInsert> = {
    captacionEtapa: input.etapa,
    status: estadoParaEtapa(input.etapa, p.status),
    motivoNoCaptada: input.etapa === "perdida" ? (input.motivo ?? "otro") : null,
    updatedAt: new Date(),
  };
  if (p.captacionEtapa !== input.etapa) patch.captacionDesde = new Date();
  if (input.etapa === "firmada") {
    const firma = input.firmadaEl ?? p.captadaAt ?? hoy;
    patch.exclusiva = true;
    patch.captadaAt = firma;
    patch.exclusivaVence = input.exclusivaVence === undefined ? (p.exclusivaVence ?? sumarMeses(firma, MESES_EXCLUSIVA)) : input.exclusivaVence;
    if (input.comisionBp !== undefined && p.operation === "venta") patch.comisionBp = input.comisionBp;
  }
  await db.update(P).set(patch).where(scoped(P.organizationId, organizationId, eq(P.id, propertyId)));
  if (p.captacionEtapa !== input.etapa) await registrar(organizationId, propertyId, p.captacionEtapa, input.etapa, actorUserId);
  if (input.etapa === "firmada" || patch.exclusivaVence !== undefined) {
    await sincronizarRenovacion(organizationId, actorUserId, propertyId);
  }
}

/**
 * La tarea «Renovar exclusiva» para 15 días antes del vencimiento: la crea,
 * la mueve si cambió la fecha, o la cierra si ya no hay vencimiento. Una sola
 * abierta por propiedad. Sin dueño no hay a quién ligarla y no se crea.
 */
export async function sincronizarRenovacion(organizationId: string, actorUserId: string, propertyId: string): Promise<void> {
  const db = getDb();
  const P = schema.property;
  const T = schema.task;
  const [p] = await db.select().from(P).where(scoped(P.organizationId, organizationId, eq(P.id, propertyId))).limit(1);
  if (!p) return;
  const [abierta] = await db
    .select({ id: T.id, assigned: T.assignedUserId })
    .from(T)
    .where(scoped(T.organizationId, organizationId, eq(T.propertyId, propertyId), isNull(T.doneAt), ilike(T.title, "Renovar exclusiva%")))
    .limit(1);
  const vigente = p.exclusiva && p.exclusivaVence && p.captacionEtapa !== "perdida";
  if (!vigente) {
    if (abierta) await db.update(T).set({ doneAt: new Date(), updatedAt: new Date() }).where(eq(T.id, abierta.id));
    return;
  }
  const tz = await businessTimezone(organizationId);
  const hoy = todayInTz(new Date(), tz);
  const aviso = restarDias(p.exclusivaVence!, DIAS_AVISO_RENOVAR);
  const dia = aviso < hoy ? hoy : aviso;
  if (abierta) {
    await db
      .update(T)
      .set({ dueAt: dueInstant(dia, "09:00", tz), allDay: false, title: tituloRenovar(p.code, p.title), updatedAt: new Date() })
      .where(eq(T.id, abierta.id));
    return;
  }
  if (!p.sellerContactId) return;
  await crearTarea(organizationId, actorUserId, {
    contactId: p.sellerContactId,
    propertyId,
    title: tituloRenovar(p.code, p.title),
    type: "llamada",
    day: dia,
    time: "09:00",
    assignedUserId: actorUserId,
  });
}

