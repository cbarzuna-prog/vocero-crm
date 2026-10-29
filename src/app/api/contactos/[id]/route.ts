import { apiError, withAuth } from "@/lib/api";
import { forkActivo, forkApagadoResponse } from "@/server/fork-activo";
import { detalleContacto } from "@/server/contactos/queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 057 (fork) — La página de un contacto: datos, ficha, historial y últimos mensajes. */
export const GET = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!forkActivo()) return forkApagadoResponse();
  const { id } = await ctx.params;
  const d = await detalleContacto(session.organizationId, id);
  if (!d) return apiError(404, "not_found", "Contacto no encontrado");
  return Response.json(d);
});
