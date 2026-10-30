import { withAuth } from "@/lib/api";
import { forkActivo, forkApagadoResponse } from "@/server/fork-activo";
import { listarReferidos } from "@/server/referidos/queries";

export const dynamic = "force-dynamic";

/** 058 (fork) — Referidores con lo que trajo cada uno. */
export const GET = withAuth(async (session) => {
  if (!forkActivo()) return forkApagadoResponse();
  return Response.json({ referidos: await listarReferidos(session.organizationId) });
});
