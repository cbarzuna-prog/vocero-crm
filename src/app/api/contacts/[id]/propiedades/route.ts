import { withAuth } from "@/lib/api";
import { propiedadesDisabledResponse, propiedadesEnabled } from "@/server/propiedades/flag";
import { propiedadesDeContacto } from "@/server/propiedades/queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 046 — Lo que vende este contacto y las propiedades que le interesan. */
export const GET = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const { id } = await ctx.params;
  return Response.json(await propiedadesDeContacto(session.organizationId, id));
});
