import { notFound, redirect } from "next/navigation";
import { FichaClient } from "@/components/propiedades/ficha-client";
import { getSessionOrNull } from "@/lib/auth/session";
import { propiedadesEnabled } from "@/server/propiedades/flag";
import { fichaPropiedad } from "@/server/propiedades/queries";

export const dynamic = "force-dynamic";

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  if (!propiedadesEnabled()) notFound();
  const session = await getSessionOrNull();
  if (!session) redirect("/login");
  const { id } = await params;
  const property = await fichaPropiedad(session.organizationId, id);
  if (!property) notFound();
  return <FichaClient initial={property} />;
}
