import { parseBody, withAuth } from "@/lib/api";
import { contrasenaSchema } from "@/lib/equipo";
import { equipoDisabledResponse, equipoEnabled } from "@/server/equipo/flag";
import { equipoErrorResponse } from "@/server/equipo/http";
import { EquipoError, restablecerContrasena } from "@/server/equipo/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 054 (fork) — Contraseña temporal puesta por un propietario. */
export const POST = withAuth(async (session, req: Request, ctx: Ctx) => {
  if (!equipoEnabled()) return equipoDisabledResponse();
  const { id } = await ctx.params;
  const body = await parseBody(req, contrasenaSchema);
  if (!body.ok) return body.response;
  try {
    await restablecerContrasena(session, id, body.data.password, body.data.quitarDosPasos ?? false);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof EquipoError) return equipoErrorResponse(err);
    throw err;
  }
});
