import { z } from "zod";
import { parseBody, withAuth } from "@/lib/api";
import { guardarValor, leerFicha } from "@/server/plantillas/ficha";
import { plantillasDisabledResponse, plantillasEnabled } from "@/server/plantillas/flag";
import { respuestaFichaError } from "@/server/plantillas/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** 068 — Los campos de la plantilla del negocio y sus valores para este contacto. */
export const GET = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!plantillasEnabled()) return plantillasDisabledResponse();
  const { id } = await ctx.params;
  try {
    return Response.json(await leerFicha(session.organizationId, id));
  } catch (e) {
    return respuestaFichaError(e);
  }
});

const putSchema = z.object({ campo: z.string().min(1).max(60), valor: z.unknown() });

/** 068 — Guardar un dato de la ficha (`valor: null` lo borra). Validado contra la plantilla. */
export const PUT = withAuth(async (session, req: Request, ctx: Ctx) => {
  if (!plantillasEnabled()) return plantillasDisabledResponse();
  const { id } = await ctx.params;
  const body = await parseBody(req, putSchema);
  if (!body.ok) return body.response;
  try {
    const valor = await guardarValor(session.organizationId, id, body.data.campo, body.data.valor ?? null, session.userId, "manual");
    return Response.json({ ok: true, valor });
  } catch (e) {
    return respuestaFichaError(e);
  }
});
