import { notFound, redirect } from "next/navigation";
import { Bienvenida } from "@/components/fork/plantillas/bienvenida";
import { canConfigure } from "@/lib/auth/roles";
import { getSessionOrNull } from "@/lib/auth/session";
import { plantillasOfrecidas, resumenPlantilla } from "@/lib/plantillas/catalogo";
import { getBranding } from "@/server/branding";
import { configNegocio } from "@/server/plantillas/config";
import { plantillasDemoEnabled, plantillasEnabled } from "@/server/plantillas/flag";

export const dynamic = "force-dynamic";

/**
 * 068 (fork · Hiyou) — El setup en tres pasos: tipo de negocio, marca y
 * WhatsApp. Pantalla completa, sin menú. Retoma donde quedó.
 */
export default async function BienvenidaPage() {
  if (!plantillasEnabled()) notFound();
  const session = await getSessionOrNull();
  if (!session) redirect("/login");
  if (!canConfigure(session.role)) redirect("/hoy");
  const [negocio, branding] = await Promise.all([configNegocio(session.organizationId), getBranding(session.organizationId)]);
  const pasoInicial = !negocio ? 1 : (negocio.setupPaso ?? 3);
  return (
    <Bienvenida
      plantillas={plantillasOfrecidas(plantillasDemoEnabled()).map(resumenPlantilla)}
      actual={negocio?.plantilla ?? null}
      pasoInicial={pasoInicial}
      marca={{ name: branding.name, accent: branding.accent, currency: branding.currency, favicon: !!branding.favicon }}
      esPropietario={session.role === "owner"}
    />
  );
}
