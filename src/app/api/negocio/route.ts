import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { canConfigure } from "@/lib/auth/roles";
import { marcarPasoSetup } from "@/server/plantillas/aplicar";
import { configNegocio } from "@/server/plantillas/config";
import { plantillasDisabledResponse, plantillasEnabled } from "@/server/plantillas/flag";

export const dynamic = "force-dynamic";

/** 068 — La configuración en uso del negocio (la copia editable de su plantilla). */
export const GET = withAuth(async (session) => {
  if (!plantillasEnabled()) return plantillasDisabledResponse();
  return Response.json({ negocio: await configNegocio(session.organizationId) });
});

const patchSchema = z.object({ setupPaso: z.number().int().min(1).max(3).nullable() });

/** 068 — Avanzar o terminar el setup (para retomar donde quedó). */
export const PATCH = withAuth(async (session, req: Request) => {
  if (!plantillasEnabled()) return plantillasDisabledResponse();
  if (!canConfigure(session.role)) return apiError(403, "forbidden", "Solo quien administra puede hacer el setup");
  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;
  if (!(await configNegocio(session.organizationId))) return apiError(409, "sin_plantilla", "Primero elija el tipo de negocio");
  await marcarPasoSetup(session.organizationId, body.data.setupPaso);
  return Response.json({ ok: true });
});
