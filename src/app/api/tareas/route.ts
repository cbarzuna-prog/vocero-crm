import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { crearTareaSchema } from "@/lib/tareas";
import { tareasDisabledResponse, tareasEnabled } from "@/server/tareas/flag";
import { contador, hoy, tareasDelContacto } from "@/server/tareas/queries";
import { crearTarea, TareaError } from "@/server/tareas/service";
import { tareaErrorResponse } from "@/server/tareas/http";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  vista: z.enum(["hoy", "contador", "contacto"]).default("hoy"),
  contactId: z.string().min(1).optional(),
  /** `mias` = solo las asignadas a quien mira. */
  de: z.enum(["mias", "todas"]).default("todas"),
});

/**
 * 046 — Lecturas de tareas.
 * - `?vista=hoy` (default): vencidas, de hoy y tratos sin siguiente paso.
 * - `?vista=contador`: cuántas vencidas y de hoy (para el menú).
 * - `?vista=contacto&contactId=…`: las de un contacto.
 */
export const GET = withAuth(async (session, req: Request) => {
  if (!tareasEnabled()) return tareasDisabledResponse();
  const url = new URL(req.url);
  const q = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!q.success) return apiError(422, "invalid_query", q.error.issues[0]?.message ?? "consulta inválida");
  const soloDe = q.data.de === "mias" ? session.userId : null;

  if (q.data.vista === "contador") {
    return Response.json(await contador(session.organizationId, { soloDe }));
  }
  if (q.data.vista === "contacto") {
    if (!q.data.contactId) return apiError(422, "invalid_query", "falta contactId");
    return Response.json(await tareasDelContacto(session.organizationId, q.data.contactId));
  }
  return Response.json(await hoy(session.organizationId, { soloDe }));
});

export const POST = withAuth(async (session, req: Request) => {
  if (!tareasEnabled()) return tareasDisabledResponse();
  const body = await parseBody(req, crearTareaSchema);
  if (!body.ok) return body.response;
  try {
    const id = await crearTarea(session.organizationId, session.userId, body.data);
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof TareaError) return tareaErrorResponse(err);
    throw err;
  }
});
