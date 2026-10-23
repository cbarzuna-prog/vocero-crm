import { asc, count, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, PHOTO_MIME } from "@/lib/propiedades";
import { deleteMediaFile, saveMediaFile } from "@/server/whatsapp/media";
import { PropiedadError } from "./service";

/**
 * 046 — Galería de una propiedad (D4). Las fotos son `media_asset` normales,
 * guardadas por el mismo almacén que los adjuntos (disco o bucket) y servidas
 * por `/api/media/[id]`. Posición 0 = portada.
 */

/** El tipo se comprueba por los bytes, no por lo que diga el navegador. */
export function sniffImage(buf: Uint8Array): (typeof PHOTO_MIME)[number] | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (
    buf.length >= 12 &&
    String.fromCharCode(...buf.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...buf.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

async function assertProperty(organizationId: string, propertyId: string) {
  const rows = await getDb()
    .select({ id: schema.property.id })
    .from(schema.property)
    .where(scoped(schema.property.organizationId, organizationId, eq(schema.property.id, propertyId)))
    .limit(1);
  if (!rows[0]) throw new PropiedadError("no_encontrada", "La propiedad no existe");
}

async function photoIds(organizationId: string, propertyId: string) {
  return getDb()
    .select({ id: schema.propertyPhoto.id, assetId: schema.propertyPhoto.mediaAssetId })
    .from(schema.propertyPhoto)
    .where(scoped(schema.propertyPhoto.organizationId, organizationId, eq(schema.propertyPhoto.propertyId, propertyId)))
    .orderBy(asc(schema.propertyPhoto.position));
}

export async function subirFoto(
  organizationId: string,
  propertyId: string,
  file: { data: Buffer; fileName?: string }
): Promise<{ id: string; url: string }> {
  await assertProperty(organizationId, propertyId);
  if (file.data.byteLength > MAX_PHOTO_BYTES) {
    throw new PropiedadError("foto_invalida", "La foto pasa de 10 MB");
  }
  const mime = sniffImage(file.data);
  if (!mime) throw new PropiedadError("foto_invalida", "Solo fotos JPG, PNG o WebP");

  const db = getDb();
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(schema.propertyPhoto)
    .where(scoped(schema.propertyPhoto.organizationId, organizationId, eq(schema.propertyPhoto.propertyId, propertyId)));
  if (n >= MAX_PHOTOS) throw new PropiedadError("demasiadas_fotos", `Máximo ${MAX_PHOTOS} fotos por propiedad`);

  const assetId = newId("mediaAsset");
  const storagePath = await saveMediaFile(organizationId, assetId, file.data, mime);
  const photoId = newId("propertyPhoto");
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.mediaAsset).values({
        id: assetId,
        organizationId,
        kind: "image",
        mimeType: mime,
        fileName: (file.fileName ?? "foto").replace(/[^\w.-]/g, "_").slice(0, 120),
        fileSize: file.data.byteLength,
        payload: { origen: "propiedad", propertyId },
        storagePath,
        fetchStatus: "available",
      });
      await tx.insert(schema.propertyPhoto).values({
        id: photoId,
        organizationId,
        propertyId,
        mediaAssetId: assetId,
        position: n,
      });
    });
  } catch (err) {
    // Sin fila que lo apunte, el archivo es basura: se borra.
    await deleteMediaFile(organizationId, assetId).catch(() => {});
    throw err;
  }
  await tocar(organizationId, propertyId);
  return { id: photoId, url: `/api/media/${assetId}` };
}

/** Reordena con la lista completa de ids (la primera queda de portada). */
export async function ordenarFotos(organizationId: string, propertyId: string, ids: string[]) {
  const current = await photoIds(organizationId, propertyId);
  const same = current.length === ids.length && current.every((p) => ids.includes(p.id));
  if (!same) throw new PropiedadError("foto_invalida", "La lista de fotos no coincide");
  await getDb().transaction(async (tx) => {
    for (const [i, id] of ids.entries()) {
      await tx
        .update(schema.propertyPhoto)
        .set({ position: i })
        .where(scoped(schema.propertyPhoto.organizationId, organizationId, eq(schema.propertyPhoto.id, id)));
    }
  });
  await tocar(organizationId, propertyId);
}

export async function borrarFoto(organizationId: string, propertyId: string, photoId: string) {
  const current = await photoIds(organizationId, propertyId);
  const target = current.find((p) => p.id === photoId);
  if (!target) throw new PropiedadError("no_encontrada", "La foto no existe");
  const db = getDb();
  await db.transaction(async (tx) => {
    // Borrar el asset arrastra la fila de la foto (cascade).
    await tx
      .delete(schema.mediaAsset)
      .where(scoped(schema.mediaAsset.organizationId, organizationId, eq(schema.mediaAsset.id, target.assetId)));
    // Renumera sin huecos: la portada siempre es la 0.
    let i = 0;
    for (const p of current) {
      if (p.id === photoId) continue;
      await tx
        .update(schema.propertyPhoto)
        .set({ position: i++ })
        .where(scoped(schema.propertyPhoto.organizationId, organizationId, eq(schema.propertyPhoto.id, p.id)));
    }
  });
  await deleteMediaFile(organizationId, target.assetId).catch(() => {});
  await tocar(organizationId, propertyId);
}

async function tocar(organizationId: string, propertyId: string) {
  await getDb()
    .update(schema.property)
    .set({ updatedAt: new Date() })
    .where(scoped(schema.property.organizationId, organizationId, eq(schema.property.id, propertyId)));
}
