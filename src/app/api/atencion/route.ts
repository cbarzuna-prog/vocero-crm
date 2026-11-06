import { withAuth } from "@/lib/api";
import { calcularAtencion } from "@/server/atencion/service";
import { forkActivo, forkApagadoResponse } from "@/server/fork-activo";

export const dynamic = "force-dynamic";

/** 062 — El semáforo de cada trato y captación abierta, calculado ahora. */
export const GET = withAuth(async (session) => {
  if (!forkActivo()) return forkApagadoResponse();
  return Response.json(await calcularAtencion(session.organizationId));
});
