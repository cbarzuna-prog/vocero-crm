import { withAuth } from "@/lib/api";
import { criterioDeContacto } from "@/server/plantillas/criterio";
import { plantillasDisabledResponse, plantillasEnabled } from "@/server/plantillas/flag";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** 068 — Qué falta para la siguiente etapa del trato de este contacto (lista de verificación). */
export const GET = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!plantillasEnabled()) return plantillasDisabledResponse();
  const { id } = await ctx.params;
  return Response.json({ criterio: await criterioDeContacto(session.organizationId, id) });
});
