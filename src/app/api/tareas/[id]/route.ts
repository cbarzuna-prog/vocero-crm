import { parseBody, withAuth } from "@/lib/api";
import { editarTareaSchema } from "@/lib/tareas";
import { tareasDisabledResponse, tareasEnabled } from "@/server/tareas/flag";
import { borrarTarea, editarTarea, TareaError } from "@/server/tareas/service";
import { tareaErrorResponse } from "@/server/tareas/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 046 — Editar una tarea; `{ done: true }` la completa y `{ done: false }` la reabre. */
export const PATCH = withAuth(async (session, req: Request, ctx: Ctx) => {
  if (!tareasEnabled()) return tareasDisabledResponse();
  const { id } = await ctx.params;
  const body = await parseBody(req, editarTareaSchema);
  if (!body.ok) return body.response;
  try {
    await editarTarea(session.organizationId, id, body.data);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof TareaError) return tareaErrorResponse(err);
    throw err;
  }
});

export const DELETE = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!tareasEnabled()) return tareasDisabledResponse();
  const { id } = await ctx.params;
  try {
    await borrarTarea(session.organizationId, id);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof TareaError) return tareaErrorResponse(err);
    throw err;
  }
});
