import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { editarPropiedadSchema } from "@/lib/propiedades";
import { propiedadesDisabledResponse, propiedadesEnabled } from "@/server/propiedades/flag";
import { propiedadErrorResponse } from "@/server/propiedades/http";
import { fichaPropiedad } from "@/server/propiedades/queries";
import { archivarPropiedad, editarPropiedad } from "@/server/propiedades/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const { id } = await ctx.params;
  const property = await fichaPropiedad(session.organizationId, id);
  if (!property) return apiError(404, "no_encontrada", "La propiedad no existe");
  return Response.json({ property });
});

const patchSchema = z.union([z.object({ archived: z.boolean() }).strict(), editarPropiedadSchema]);

/** Editar cualquier campo; `{ archived: true|false }` archiva o restaura. */
export const PATCH = withAuth(async (session, req: Request, ctx: Ctx) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const { id } = await ctx.params;
  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;
  try {
    if ("archived" in body.data && typeof body.data.archived === "boolean") {
      await archivarPropiedad(session.organizationId, id, body.data.archived);
    } else {
      await editarPropiedad(session.organizationId, id, body.data as z.infer<typeof editarPropiedadSchema>);
    }
    return Response.json({ ok: true });
  } catch (err) {
    const res = propiedadErrorResponse(err);
    if (res) return res;
    throw err;
  }
});
