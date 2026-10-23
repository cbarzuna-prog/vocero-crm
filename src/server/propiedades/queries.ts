import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import {
  ACTIVE_STATUSES,
  banosFromX2,
  coverUrl,
  type FiltroPropiedades,
  type InteresDeContactoDto,
  type PropertyDetail,
  type PropertyListItem,
  type PropiedadesDeContactoDto,
} from "@/lib/propiedades";

/** 046 — Lecturas de propiedades. Todo por `scoped()`. */

const LIST_LIMIT = 300;

/** Portada = la foto en posición 0. */
const coverAsset = sql<string | null>`(
  select ${schema.propertyPhoto.mediaAssetId} from ${schema.propertyPhoto}
  where ${schema.propertyPhoto.propertyId} = ${schema.property.id}
  order by ${schema.propertyPhoto.position} asc limit 1
)`;

/** Interesados vigentes (no descartados). */
const interesadosCount = sql<number>`(
  select count(*) from ${schema.propertyInterest}
  where ${schema.propertyInterest.propertyId} = ${schema.property.id}
    and ${schema.propertyInterest.status} <> 'descartada'
)`.mapWith(Number);

const listColumns = {
  p: schema.property,
  cover: coverAsset,
  interesados: interesadosCount,
};

function toListItem(r: { p: typeof schema.property.$inferSelect; cover: string | null; interesados: number }): PropertyListItem {
  const p = r.p;
  return {
    id: p.id,
    code: p.code,
    title: p.title,
    operation: p.operation,
    type: p.type,
    status: p.status,
    priceCents: p.priceCents,
    currency: p.currency,
    provincia: p.provincia,
    canton: p.canton,
    zona: p.zona,
    habitaciones: p.habitaciones,
    banos: banosFromX2(p.banosX2),
    m2Construccion: p.m2Construccion,
    m2Terreno: p.m2Terreno,
    coverUrl: coverUrl(r.cover),
    interesados: r.interesados,
    archived: p.archivedAt !== null,
  };
}

export async function listarPropiedades(
  organizationId: string,
  f: FiltroPropiedades
): Promise<PropertyListItem[]> {
  const P = schema.property;
  const conds: (SQL | undefined)[] = [
    f.archivadas === "1" ? isNotNull(P.archivedAt) : isNull(P.archivedAt),
    f.operation ? eq(P.operation, f.operation) : undefined,
    f.type ? eq(P.type, f.type) : undefined,
    f.status === "activas"
      ? inArray(P.status, ACTIVE_STATUSES)
      : f.status === "todas"
        ? undefined
        : eq(P.status, f.status),
    f.provincia ? eq(P.provincia, f.provincia) : undefined,
    f.canton ? eq(P.canton, f.canton) : undefined,
    f.currency ? eq(P.currency, f.currency) : undefined,
    // D2: el rango de precio solo tiene sentido dentro de una moneda.
    f.currency && f.min !== undefined ? gte(P.priceCents, Math.round(f.min * 100)) : undefined,
    f.currency && f.max !== undefined ? lte(P.priceCents, Math.round(f.max * 100)) : undefined,
  ];
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, "\\$&")}%`;
    conds.push(or(ilike(P.code, like), ilike(P.title, like), ilike(P.zona, like), ilike(P.canton, like)));
  }

  const rows = await getDb()
    .select(listColumns)
    .from(P)
    .where(scoped(P.organizationId, organizationId, ...conds))
    .orderBy(desc(P.updatedAt))
    .limit(LIST_LIMIT);
  return rows.map(toListItem);
}

export async function fichaPropiedad(organizationId: string, propertyId: string): Promise<PropertyDetail | null> {
  const db = getDb();
  const rows = await db
    .select({ ...listColumns, sellerName: schema.contact.name })
    .from(schema.property)
    .leftJoin(schema.contact, eq(schema.contact.id, schema.property.sellerContactId))
    .where(scoped(schema.property.organizationId, organizationId, eq(schema.property.id, propertyId)))
    .limit(1);
  const r = rows[0];
  if (!r) return null;

  const [photos, interesados] = await Promise.all([
    db
      .select({ id: schema.propertyPhoto.id, assetId: schema.propertyPhoto.mediaAssetId })
      .from(schema.propertyPhoto)
      .where(
        scoped(schema.propertyPhoto.organizationId, organizationId, eq(schema.propertyPhoto.propertyId, propertyId))
      )
      .orderBy(asc(schema.propertyPhoto.position)),
    db
      .select({
        interestId: schema.propertyInterest.id,
        status: schema.propertyInterest.status,
        note: schema.propertyInterest.note,
        updatedAt: schema.propertyInterest.updatedAt,
        contactId: schema.contact.id,
        contactName: schema.contact.name,
      })
      .from(schema.propertyInterest)
      .innerJoin(schema.contact, eq(schema.contact.id, schema.propertyInterest.contactId))
      .where(
        scoped(
          schema.propertyInterest.organizationId,
          organizationId,
          eq(schema.propertyInterest.propertyId, propertyId)
        )
      )
      // Lo vigente arriba; los descartados al final.
      .orderBy(
        sql`(${schema.propertyInterest.status} = 'descartada') asc`,
        desc(schema.propertyInterest.updatedAt)
      ),
  ]);

  const p = r.p;
  return {
    ...toListItem(r),
    distrito: p.distrito,
    parqueos: p.parqueos,
    descripcionPublica: p.descripcionPublica,
    notasInternas: p.notasInternas,
    seller: p.sellerContactId && r.sellerName ? { id: p.sellerContactId, name: r.sellerName } : null,
    comisionBp: p.comisionBp,
    exclusiva: p.exclusiva,
    captadaAt: p.captadaAt,
    urlExterna: p.urlExterna,
    photos: photos.map((ph) => ({ id: ph.id, url: `/api/media/${ph.assetId}` })),
    interesadosDetalle: interesados.map((i) => ({
      interestId: i.interestId,
      status: i.status,
      note: i.note,
      updatedAt: i.updatedAt.toISOString(),
      contact: { id: i.contactId, name: i.contactName },
    })),
  };
}

/** Lo que un contacto vende y las propiedades que le interesan (H2, H3). */
export async function propiedadesDeContacto(
  organizationId: string,
  contactId: string
): Promise<PropiedadesDeContactoDto> {
  const db = getDb();
  const lite = (r: { p: typeof schema.property.$inferSelect; cover: string | null }) => ({
    id: r.p.id,
    code: r.p.code,
    title: r.p.title,
    priceCents: r.p.priceCents,
    currency: r.p.currency,
    status: r.p.status,
    coverUrl: coverUrl(r.cover),
  });

  const [vende, interes] = await Promise.all([
    db
      .select({ p: schema.property, cover: coverAsset })
      .from(schema.property)
      .where(
        scoped(
          schema.property.organizationId,
          organizationId,
          eq(schema.property.sellerContactId, contactId),
          isNull(schema.property.archivedAt)
        )
      )
      .orderBy(desc(schema.property.updatedAt)),
    db
      .select({
        p: schema.property,
        cover: coverAsset,
        interestId: schema.propertyInterest.id,
        status: schema.propertyInterest.status,
        note: schema.propertyInterest.note,
      })
      .from(schema.propertyInterest)
      .innerJoin(schema.property, eq(schema.property.id, schema.propertyInterest.propertyId))
      .where(
        and(
          scoped(schema.propertyInterest.organizationId, organizationId),
          eq(schema.propertyInterest.contactId, contactId)
        )
      )
      .orderBy(
        sql`(${schema.propertyInterest.status} = 'descartada') asc`,
        desc(schema.propertyInterest.updatedAt)
      ),
  ]);

  return {
    vende: vende.map(lite),
    interes: interes.map(
      (r): InteresDeContactoDto => ({
        interestId: r.interestId,
        status: r.status,
        note: r.note,
        property: lite(r),
      })
    ),
  };
}
