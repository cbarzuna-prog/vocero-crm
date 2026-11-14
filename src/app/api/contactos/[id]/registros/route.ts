import { z } from "zod";
import { parseBody, withAuth } from "@/lib/api";
import { crearRegistro, listarRegistros } from "@/server/plantillas/ficha";
import { plantillasDisabledResponse, plantillasEnabled } from "@/server/plantillas/flag";
import { respuestaFichaError } from "@/server/plantillas/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** 068 — Los registros vinculados del contacto (citas, pedidos…), lo más reciente primero. */
export const GET = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!plantillasEnabled()) return plantillasDisabledResponse();
  const { id } = await ctx.params;
  try {
    return Response.json({ registros: await listarRegistros(session.organizationId, id) });
  } catch (e) {
    return respuestaFichaError(e);
  }
});

const postSchema = z.object({
  tipo: z.string().min(1).max(40),
  estado: z.string().min(1).max(40).optional(),
  fecha: z.string().datetime({ offset: true }).nullable().optional(),
  importeCents: z.number().int().min(0).nullable().optional(),
  moneda: z.enum(["CRC", "USD"]).nullable().optional(),
  datos: z.record(z.unknown()).optional(),
});

export const POST = withAuth(async (session, req: Request, ctx: Ctx) => {
  if (!plantillasEnabled()) return plantillasDisabledResponse();
  const { id } = await ctx.params;
  const body = await parseBody(req, postSchema);
  if (!body.ok) return body.response;
  try {
    return Response.json({ registro: await crearRegistro(session.organizationId, id, body.data, session.userId) }, { status: 201 });
  } catch (e) {
    return respuestaFichaError(e);
  }
});
