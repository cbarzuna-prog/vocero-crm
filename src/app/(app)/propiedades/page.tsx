import { notFound, redirect } from "next/navigation";
import { PropiedadesClient } from "@/components/propiedades/propiedades-client";
import { getSessionOrNull } from "@/lib/auth/session";
import { propiedadesEnabled } from "@/server/propiedades/flag";

export const dynamic = "force-dynamic";

/** 046 — Inventario. Sin la bandera `PROPIEDADES` esta pantalla no existe. */
export default async function PropiedadesPage() {
  if (!propiedadesEnabled()) notFound();
  const session = await getSessionOrNull();
  if (!session) redirect("/login");
  return <PropiedadesClient />;
}
