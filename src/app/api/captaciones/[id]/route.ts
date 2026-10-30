import { apiError, parseBody, withAuth } from "@/lib/api";
import { moverCaptacionSchema } from "@/lib/captaciones";
import { CaptacionError, moverCaptacion } from "@/server/captaciones/service";
import { propiedadesDisabledResponse, propiedadesEnabled } from "@/server/propiedades/flag";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 048 — Mover de etapa (al firmar: fecha, vencimiento y comisión; al perderla: motivo). */
export const PATCH = withAuth(async (session, req: Request, ctx: Ctx) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const { id } = await ctx.params;
  const body = await parseBody(req, moverCaptacionSchema);
  if (!body.ok) return body.response;
  try {
    await moverCaptacion(session.organizationId, session.userId, id, body.data);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof CaptacionError) return apiError(err.code === "no_encontrada" ? 404 : 422, err.code, err.message);
    throw err;
  }
});
