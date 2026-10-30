import { apiError, parseBody, withAuth } from "@/lib/api";
import { guardarParticipantesSchema } from "@/lib/colaboracion";
import { ColaboracionError, guardarParticipantes, participantesDe } from "@/server/colaboracion/service";
import { propiedadesDisabledResponse, propiedadesEnabled } from "@/server/propiedades/flag";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 060 — Quién trajo y quién vende la propiedad, con su parte de la comisión. */
export const GET = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const { id } = await ctx.params;
  return Response.json({ participantes: (await participantesDe(session.organizationId, [id])).get(id) ?? [] });
});

/** 060 — Reemplaza el reparto completo (máx. 10 personas, suma ≤ 100 %). */
export const PUT = withAuth(async (session, req: Request, ctx: Ctx) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const { id } = await ctx.params;
  const body = await parseBody(req, guardarParticipantesSchema);
  if (!body.ok) return body.response;
  try {
    return Response.json({ participantes: await guardarParticipantes(session.organizationId, id, body.data) });
  } catch (err) {
    if (err instanceof ColaboracionError) return apiError(err.code === "no_encontrada" ? 404 : 422, err.code, err.message);
    throw err;
  }
});
