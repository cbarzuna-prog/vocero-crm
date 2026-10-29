import { withAuth } from "@/lib/api";
import { propiedadesDisabledResponse, propiedadesEnabled } from "@/server/propiedades/flag";
import { borrarFoto } from "@/server/propiedades/fotos";
import { propiedadErrorResponse } from "@/server/propiedades/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; photoId: string }> };

export const DELETE = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const { id, photoId } = await ctx.params;
  try {
    await borrarFoto(session.organizationId, id, photoId);
    return new Response(null, { status: 204 });
  } catch (err) {
    const res = propiedadErrorResponse(err);
    if (res) return res;
    throw err;
  }
});
