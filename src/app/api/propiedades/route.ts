import { apiError, parseBody, withAuth } from "@/lib/api";
import { crearPropiedadSchema, filtroPropiedadesSchema } from "@/lib/propiedades";
import { propiedadesDisabledResponse, propiedadesEnabled } from "@/server/propiedades/flag";
import { propiedadErrorResponse } from "@/server/propiedades/http";
import { listarPropiedades } from "@/server/propiedades/queries";
import { crearPropiedad } from "@/server/propiedades/service";

export const dynamic = "force-dynamic";

/** 046 — Lista con filtros (`?operation=&type=&status=&provincia=&canton=&currency=&min=&max=&q=`). */
export const GET = withAuth(async (session, req: Request) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const params = Object.fromEntries(
    [...new URL(req.url).searchParams.entries()].filter(([, v]) => v !== "")
  );
  const f = filtroPropiedadesSchema.safeParse(params);
  if (!f.success) return apiError(422, "invalid_query", f.error.issues[0]?.message ?? "filtro inválido");
  return Response.json({ properties: await listarPropiedades(session.organizationId, f.data) });
});

/** 046 — Alta rápida (D8). */
export const POST = withAuth(async (session, req: Request) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const body = await parseBody(req, crearPropiedadSchema);
  if (!body.ok) return body.response;
  try {
    const created = await crearPropiedad(session.organizationId, session.userId, body.data);
    return Response.json(created, { status: 201 });
  } catch (err) {
    const res = propiedadErrorResponse(err);
    if (res) return res;
    throw err;
  }
});
