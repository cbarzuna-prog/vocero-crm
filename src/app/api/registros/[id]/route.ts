import { z } from "zod";
import { parseBody, withAuth } from "@/lib/api";
import { actualizarRegistro } from "@/server/plantillas/ficha";
import { plantillasDisabledResponse, plantillasEnabled } from "@/server/plantillas/flag";
import { respuestaFichaError } from "@/server/plantillas/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  estado: z.string().min(1).max(40).optional(),
  fecha: z.string().datetime({ offset: true }).nullable().optional(),
  importeCents: z.number().int().min(0).nullable().optional(),
  datos: z.record(z.unknown()).optional(),
});

/** 068 — Cambiar el estado o los datos de un registro (por ejemplo, «Atendida» o «No llegó»). */
export const PATCH = withAuth(async (session, req: Request, ctx: Ctx) => {
  if (!plantillasEnabled()) return plantillasDisabledResponse();
  const { id } = await ctx.params;
  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;
  try {
    return Response.json({ registro: await actualizarRegistro(session.organizationId, id, body.data) });
  } catch (e) {
    return respuestaFichaError(e);
  }
});
