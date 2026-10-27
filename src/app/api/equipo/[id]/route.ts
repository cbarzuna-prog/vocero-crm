import { parseBody, withAuth } from "@/lib/api";
import { editarMiembroSchema } from "@/lib/equipo";
import { equipoDisabledResponse, equipoEnabled } from "@/server/equipo/flag";
import { equipoErrorResponse } from "@/server/equipo/http";
import { editarMiembro, EquipoError, quitarMiembro } from "@/server/equipo/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 054 (fork) — Editar nombre, correo o rol de alguien del equipo (solo propietarios). */
export const PATCH = withAuth(async (session, req: Request, ctx: Ctx) => {
  if (!equipoEnabled()) return equipoDisabledResponse();
  const { id } = await ctx.params;
  const body = await parseBody(req, editarMiembroSchema);
  if (!body.ok) return body.response;
  try {
    await editarMiembro(session, id, body.data);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof EquipoError) return equipoErrorResponse(err);
    throw err;
  }
});

/** 054 (fork) — Quitar a alguien del equipo; sus tareas pendientes pasan a quien lo quita. */
export const DELETE = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!equipoEnabled()) return equipoDisabledResponse();
  const { id } = await ctx.params;
  try {
    return Response.json(await quitarMiembro(session, id));
  } catch (err) {
    if (err instanceof EquipoError) return equipoErrorResponse(err);
    throw err;
  }
});
