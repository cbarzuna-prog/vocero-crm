import { parseBody, withAuth } from "@/lib/api";
import { cambiarInteresSchema } from "@/lib/propiedades";
import { propiedadesDisabledResponse, propiedadesEnabled } from "@/server/propiedades/flag";
import { propiedadErrorResponse } from "@/server/propiedades/http";
import { cambiar, historial, quitar } from "@/server/propiedades/interes";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Historial de cambios de estado del vínculo. */
export const GET = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const { id } = await ctx.params;
  return Response.json({ events: await historial(session.organizationId, id) });
});

export const PATCH = withAuth(async (session, req: Request, ctx: Ctx) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const { id } = await ctx.params;
  const body = await parseBody(req, cambiarInteresSchema);
  if (!body.ok) return body.response;
  try {
    await cambiar(session.organizationId, session.userId, id, body.data);
    return Response.json({ ok: true });
  } catch (err) {
    const res = propiedadErrorResponse(err);
    if (res) return res;
    throw err;
  }
});

export const DELETE = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const { id } = await ctx.params;
  try {
    await quitar(session.organizationId, id);
    return new Response(null, { status: 204 });
  } catch (err) {
    const res = propiedadErrorResponse(err);
    if (res) return res;
    throw err;
  }
});
