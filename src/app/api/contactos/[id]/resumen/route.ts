import { apiError, withAuth } from "@/lib/api";
import { forkActivo, forkApagadoResponse } from "@/server/fork-activo";
import { generarResumen, leerResumen, ResumenError } from "@/server/resumen/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 063 — El último resumen guardado (o null). */
export const GET = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!forkActivo()) return forkApagadoResponse();
  const { id } = await ctx.params;
  return Response.json({ resumen: await leerResumen(session.organizationId, id) });
});

/** 063 — Pedirle a la IA un resumen nuevo. */
export const POST = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!forkActivo()) return forkApagadoResponse();
  const { id } = await ctx.params;
  try {
    return Response.json({ resumen: await generarResumen(session.organizationId, id) });
  } catch (err) {
    if (err instanceof ResumenError) return apiError(err.code === "no_encontrado" ? 404 : err.code === "sin_ia" ? 409 : 502, err.code, err.message);
    throw err;
  }
});
