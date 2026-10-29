import { inArray } from "drizzle-orm";
import { parseBody, withAuth } from "@/lib/api";
import { loteSchema } from "@/lib/contactos";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { forkActivo, forkApagadoResponse } from "@/server/fork-activo";

export const dynamic = "force-dynamic";

/**
 * 057 (fork) — Archivar o restaurar varios contactos de una vez (la lista
 * ofrece «Deshacer»: restaurar es la misma llamada al revés). Mover de etapa
 * en lote va por la ruta del pipeline, contacto por contacto, para que cada
 * cambio deje su registro en la bitácora de etapas.
 */
export const POST = withAuth(async (session, req: Request) => {
  if (!forkActivo()) return forkApagadoResponse();
  const body = await parseBody(req, loteSchema);
  if (!body.ok) return body.response;
  const hechos = await getDb()
    .update(schema.contact)
    .set({ archivedAt: body.data.accion === "archivar" ? new Date() : null, updatedAt: new Date() })
    .where(scoped(schema.contact.organizationId, session.organizationId, inArray(schema.contact.id, body.data.ids)))
    .returning({ id: schema.contact.id });
  return Response.json({ cambiados: hechos.length });
});
