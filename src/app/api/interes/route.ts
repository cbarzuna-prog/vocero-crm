import { parseBody, withAuth } from "@/lib/api";
import { vincularSchema } from "@/lib/propiedades";
import { propiedadesDisabledResponse, propiedadesEnabled } from "@/server/propiedades/flag";
import { propiedadErrorResponse } from "@/server/propiedades/http";
import { vincular } from "@/server/propiedades/interes";

export const dynamic = "force-dynamic";

/** 046 — Vincula comprador↔propiedad (idempotente: 200 si ya existía, 201 si es nuevo). */
export const POST = withAuth(async (session, req: Request) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const body = await parseBody(req, vincularSchema);
  if (!body.ok) return body.response;
  try {
    const r = await vincular(session.organizationId, session.userId, body.data);
    return Response.json(r, { status: r.created ? 201 : 200 });
  } catch (err) {
    const res = propiedadErrorResponse(err);
    if (res) return res;
    throw err;
  }
});
