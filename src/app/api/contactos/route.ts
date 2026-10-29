import { withAuth } from "@/lib/api";
import { forkActivo, forkApagadoResponse } from "@/server/fork-activo";
import { listarContactos } from "@/server/contactos/queries";

export const dynamic = "force-dynamic";

/** 057 (fork) — La lista de Contactos con etapa, ficha, propiedades y tareas. */
export const GET = withAuth(async (session) => {
  if (!forkActivo()) return forkApagadoResponse();
  return Response.json({ contactos: await listarContactos(session.organizationId) });
});
