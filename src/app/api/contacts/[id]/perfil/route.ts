import { apiError, parseBody, withAuth } from "@/lib/api";
import { editarPerfilSchema } from "@/lib/perfil-cliente";
import { propiedadesDisabledResponse, propiedadesEnabled } from "@/server/propiedades/flag";
import { guardarPerfil, leerPerfil, PerfilError } from "@/server/perfil/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const err = (e: PerfilError) => apiError(e.status, e.code, e.message);

/** 055 (fork) — La ficha inmobiliaria de un contacto (vacía si nadie la ha llenado). */
export const GET = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const { id } = await ctx.params;
  try {
    return Response.json({ perfil: await leerPerfil(session.organizationId, id) });
  } catch (e) {
    if (e instanceof PerfilError) return err(e);
    throw e;
  }
});

/** Edición parcial; `null` borra un campo. */
export const PUT = withAuth(async (session, req: Request, ctx: Ctx) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const { id } = await ctx.params;
  const body = await parseBody(req, editarPerfilSchema);
  if (!body.ok) return body.response;
  try {
    return Response.json({ perfil: await guardarPerfil(session.organizationId, id, body.data) });
  } catch (e) {
    if (e instanceof PerfilError) return err(e);
    throw e;
  }
});
