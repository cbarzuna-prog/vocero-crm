import { asc } from "drizzle-orm";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { canConfigure } from "@/lib/auth/roles";
import { configAtencionSchema, tiempoDeEtapa } from "@/lib/atencion";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { guardarConfigAtencion, leerConfigAtencion } from "@/server/atencion/service";
import { forkActivo, forkApagadoResponse } from "@/server/fork-activo";

export const dynamic = "force-dynamic";

async function etapas(organizationId: string) {
  return getDb()
    .select({ id: schema.pipelineStage.id, name: schema.pipelineStage.name, kind: schema.pipelineStage.kind })
    .from(schema.pipelineStage)
    .where(scoped(schema.pipelineStage.organizationId, organizationId))
    .orderBy(asc(schema.pipelineStage.position));
}

/** 062 — Horario, tiempos por etapa (con los sugeridos para las que no tienen) y captaciones. */
export const GET = withAuth(async (session) => {
  if (!forkActivo()) return forkApagadoResponse();
  const [cfg, es] = await Promise.all([leerConfigAtencion(session.organizationId), etapas(session.organizationId)]);
  return Response.json({
    config: cfg,
    etapas: es.map((e) => ({ ...e, tiempo: e.kind === "open" ? tiempoDeEtapa(cfg, e) : null, guardado: !!cfg.etapas[e.id] })),
  });
});

/** 062 — Guardar la configuración completa (solo quien configura el negocio). */
export const PUT = withAuth(async (session, req: Request) => {
  if (!forkActivo()) return forkApagadoResponse();
  if (!canConfigure(session.role)) return apiError(403, "forbidden", "Solo quien administra el negocio cambia los tiempos");
  const body = await parseBody(req, configAtencionSchema);
  if (!body.ok) return body.response;
  return Response.json({ config: await guardarConfigAtencion(session.organizationId, body.data) });
});
