import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { cantonDe } from "@/lib/cr-zonas";
import {
  banosToX2,
  defaultTitle,
  PROPERTY_CODE_PREFIX,
  type CrearPropiedadInput,
  type EditarPropiedadInput,
} from "@/lib/propiedades";

/**
 * 046 — Escrituras de propiedades. Todo por `scoped()`; el vendedor se valida
 * contra la organización (un id ajeno se trata igual que uno inexistente).
 */

export class PropiedadError extends Error {
  constructor(
    public readonly code:
      | "no_encontrada"
      | "codigo_repetido"
      | "vendedor_inexistente"
      | "canton_invalido"
      | "demasiadas_fotos"
      | "foto_invalida",
    message: string
  ) {
    super(message);
    this.name = "PropiedadError";
  }
}

/** 23505 = unique_violation de Postgres (Drizzle lo envuelve en `cause`). */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if ((err as { code?: unknown }).code === "23505") return true;
  const cause = (err as { cause?: unknown }).cause;
  return typeof cause === "object" && cause !== null && (cause as { code?: unknown }).code === "23505";
}

/** `KK-0007` → siguiente `KK-0008`. Solo cuenta los códigos con el formato propio. */
export async function nextCode(organizationId: string): Promise<string> {
  const rows = await getDb()
    .select({ code: schema.property.code })
    .from(schema.property)
    .where(
      scoped(
        schema.property.organizationId,
        organizationId,
        sql`${schema.property.code} ~ ${`^${PROPERTY_CODE_PREFIX}-[0-9]+$`}`
      )
    )
    .orderBy(desc(sql`length(${schema.property.code})`), desc(schema.property.code))
    .limit(1);
  const last = rows[0]?.code;
  const n = last ? Number(last.slice(PROPERTY_CODE_PREFIX.length + 1)) + 1 : 1;
  return `${PROPERTY_CODE_PREFIX}-${String(n).padStart(4, "0")}`;
}

async function assertSeller(organizationId: string, contactId: string | null | undefined) {
  if (!contactId) return;
  const rows = await getDb()
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(scoped(schema.contact.organizationId, organizationId, eq(schema.contact.id, contactId)))
    .limit(1);
  if (!rows[0]) throw new PropiedadError("vendedor_inexistente", "Ese contacto no existe");
}

export async function crearPropiedad(
  organizationId: string,
  actorUserId: string,
  input: CrearPropiedadInput
): Promise<{ id: string; code: string }> {
  const db = getDb();
  const canton = input.canton || null;
  const zona = input.zona || null;
  // El código es «el siguiente»: dos altas a la vez pueden calcular el mismo.
  // El índice único decide y la perdedora reintenta con el nuevo siguiente.
  for (let intento = 0; intento < 5; intento++) {
    const id = newId("property");
    const code = await nextCode(organizationId);
    try {
      await db.insert(schema.property).values({
        id,
        organizationId,
        code,
        title: input.title || defaultTitle(input.type, zona ?? canton ?? input.provincia),
        operation: input.operation,
        type: input.type,
        status: input.status ?? "disponible",
        priceCents: input.priceCents ?? null,
        currency: input.currency ?? "USD",
        provincia: input.provincia,
        canton,
        zona,
        createdBy: actorUserId,
      });
      return { id, code };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new PropiedadError("codigo_repetido", "No se pudo asignar un código; intenta de nuevo");
}

export async function editarPropiedad(
  organizationId: string,
  propertyId: string,
  input: EditarPropiedadInput
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.property)
    .where(scoped(schema.property.organizationId, organizationId, eq(schema.property.id, propertyId)))
    .limit(1);
  const current = rows[0];
  if (!current) throw new PropiedadError("no_encontrada", "La propiedad no existe");

  // El par provincia/cantón se valida con lo que quedará, no solo con lo enviado.
  const provincia = input.provincia ?? current.provincia;
  const canton = input.canton !== undefined ? input.canton : current.canton;
  if (canton && !cantonDe(provincia, canton)) {
    throw new PropiedadError("canton_invalido", "Ese cantón no es de esa provincia");
  }
  await assertSeller(organizationId, input.sellerContactId);

  const { banos, ...rest } = input;
  const patch: Partial<typeof schema.property.$inferInsert> = { ...rest, updatedAt: new Date() };
  if (banos !== undefined) patch.banosX2 = banosToX2(banos);
  // Cambiar de provincia sin mandar cantón borra el cantón viejo (ya no aplica).
  if (input.provincia && input.provincia !== current.provincia && input.canton === undefined) {
    patch.canton = null;
  }

  try {
    await db
      .update(schema.property)
      .set(patch)
      .where(scoped(schema.property.organizationId, organizationId, eq(schema.property.id, propertyId)));
  } catch (err) {
    if (isUniqueViolation(err)) throw new PropiedadError("codigo_repetido", "Ese código ya lo usa otra propiedad");
    throw err;
  }
}

/** Borrado suave (D: una propiedad con interesados no se borra físico). */
export async function archivarPropiedad(
  organizationId: string,
  propertyId: string,
  archived: boolean
): Promise<void> {
  const rows = await getDb()
    .update(schema.property)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(scoped(schema.property.organizationId, organizationId, eq(schema.property.id, propertyId))))
    .returning({ id: schema.property.id });
  if (!rows[0]) throw new PropiedadError("no_encontrada", "La propiedad no existe");
}
