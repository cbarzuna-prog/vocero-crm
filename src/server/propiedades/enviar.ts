import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { textoFicha } from "@/lib/propiedades";
import { SendError, sendMediaMessage, sendText } from "@/server/inbox/send";
import { readMediaFile } from "@/server/whatsapp/media";
import { cambiar, vincular } from "./interes";
import { fichaPropiedad } from "./queries";
import { PropiedadError } from "./service";

/**
 * 050 — Enviar la ficha de una propiedad por la conversación del comprador:
 * el texto compartible y hasta 5 fotos, y el vínculo queda en «Ficha
 * enviada» (sin retroceder si ya iba más adelante). Todo pasa por el envío
 * normal de la Bandeja: ventana de 24 h, sandbox y canal incluidos.
 */
export async function enviarFicha(
  organizationId: string,
  actorUserId: string,
  input: { propertyId: string; contactId: string; fotos: number }
): Promise<{ conversationId: string; mensajes: number; fotosFallidas: number }> {
  const p = await fichaPropiedad(organizationId, input.propertyId);
  if (!p) throw new PropiedadError("no_encontrada", "La propiedad no existe");

  const db = getDb();
  const conv = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation)
    .where(
      scoped(
        schema.conversation.organizationId,
        organizationId,
        eq(schema.conversation.contactId, input.contactId),
        eq(schema.conversation.isTest, false)
      )
    )
    .limit(1);
  const conversationId = conv[0]?.id;
  if (!conversationId) {
    throw new SendError(
      "window_closed",
      "Esta persona todavía no tiene conversación de WhatsApp. Ábrala desde su contacto con una plantilla."
    );
  }

  await sendText({ conversationId, organizationId, text: textoFicha(p) });
  let mensajes = 1;
  let fotosFallidas = 0;

  const assets = await db
    .select({ assetId: schema.propertyPhoto.mediaAssetId, mime: schema.mediaAsset.mimeType, name: schema.mediaAsset.fileName })
    .from(schema.propertyPhoto)
    .innerJoin(schema.mediaAsset, eq(schema.mediaAsset.id, schema.propertyPhoto.mediaAssetId))
    .where(
      and(
        eq(schema.propertyPhoto.organizationId, organizationId),
        eq(schema.propertyPhoto.propertyId, input.propertyId)
      )
    )
    .orderBy(asc(schema.propertyPhoto.position))
    .limit(input.fotos);
  for (const a of assets) {
    try {
      const data = await readMediaFile(organizationId, a.assetId);
      await sendMediaMessage({
        conversationId,
        organizationId,
        file: { data, mimeType: a.mime ?? "image/jpeg", fileName: a.name ?? undefined },
      });
      mensajes++;
    } catch {
      // Una foto que falla no tumba el envío: el texto ya salió.
      fotosFallidas++;
    }
  }

  // El vínculo avanza a «enviada» solo si no iba ya más adelante.
  const actual = p.interesadosDetalle.find((i) => i.contact.id === input.contactId);
  if (!actual) {
    await vincular(organizationId, actorUserId, {
      contactId: input.contactId,
      propertyId: input.propertyId,
      status: "enviada",
    });
  } else if (actual.status === "interesado" || actual.status === "descartada") {
    await cambiar(organizationId, actorUserId, actual.interestId, { status: "enviada" });
  }

  return { conversationId, mensajes, fotosFallidas };
}
