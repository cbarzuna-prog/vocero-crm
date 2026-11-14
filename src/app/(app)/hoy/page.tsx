import { notFound, redirect } from "next/navigation";
import { HoyClient } from "@/components/hoy/hoy-client";
import { getSessionOrNull } from "@/lib/auth/session";
import { tareasEnabled } from "@/server/tareas/flag";
import { hoy } from "@/server/tareas/queries";
import { canConfigure } from "@/lib/auth/roles";
import { necesitaSetup } from "@/server/plantillas/config";

export const dynamic = "force-dynamic";

/** 046 — «Hoy». Sin la bandera `TAREAS` esta pantalla no existe en esta instancia. */
export default async function HoyPage() {
  if (!tareasEnabled()) notFound();
  const session = await getSessionOrNull();
  if (!session) redirect("/login");
  if (await necesitaSetup(session.organizationId, canConfigure(session.role))) redirect("/bienvenida"); // 068
  const initial = await hoy(session.organizationId);
  return <HoyClient initial={initial} />;
}
