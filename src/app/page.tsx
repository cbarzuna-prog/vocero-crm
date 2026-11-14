import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/auth/session";
import { guideFirst } from "@/server/onboarding/guide";
import { tareasEnabled } from "@/server/tareas/flag";
import { canConfigure } from "@/lib/auth/roles";
import { necesitaSetup } from "@/server/plantillas/config";

export const dynamic = "force-dynamic";

/**
 * La raíz decide a dónde se entra (issue #86): mientras falte un paso de la
 * guía de inicio o el agente siga apagado, a `/onboarding`; con todo listo,
 * a la Bandeja como siempre. Sin sesión, `/inbox` manda al login.
 */
export default async function Home() {
  const session = await getSessionOrNull();
  // 068 (fork): con PLANTILLAS, antes que nada el setup del tipo de negocio.
  if (session && (await necesitaSetup(session.organizationId, canConfigure(session.role)))) redirect("/bienvenida");
  if (session && (await guideFirst(session))) redirect("/onboarding");
  // 046 — con tareas, se entra a «Hoy»: lo primero es saber qué toca hoy.
  redirect(tareasEnabled() ? "/hoy" : "/inbox");
}
