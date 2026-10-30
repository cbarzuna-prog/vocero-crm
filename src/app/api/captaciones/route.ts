import { apiError, parseBody, withAuth } from "@/lib/api";
import { nuevaCaptacionSchema } from "@/lib/captaciones";
import { CaptacionError, crearCaptacion, listarCaptaciones } from "@/server/captaciones/service";
import { propiedadesDisabledResponse, propiedadesEnabled } from "@/server/propiedades/flag";
import { propiedadErrorResponse } from "@/server/propiedades/http";

export const dynamic = "force-dynamic";

/** 048 — Las tarjetas del tablero de Captaciones. */
export const GET = withAuth(async (session) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  return Response.json({ captaciones: await listarCaptaciones(session.organizationId) });
});

/** 048 — Nueva captación: dueño + propiedad en etapa Contacto. */
export const POST = withAuth(async (session, req: Request) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const body = await parseBody(req, nuevaCaptacionSchema);
  if (!body.ok) return body.response;
  try {
    return Response.json(await crearCaptacion(session.organizationId, session.userId, body.data), { status: 201 });
  } catch (err) {
    if (err instanceof CaptacionError) return apiError(err.code === "no_encontrada" ? 404 : 422, err.code, err.message);
    const res = propiedadErrorResponse(err);
    if (res) return res;
    throw err;
  }
});
