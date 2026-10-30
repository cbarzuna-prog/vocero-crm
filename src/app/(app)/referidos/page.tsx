import { notFound } from "next/navigation";
import { ReferidosClient } from "@/components/fork/referidos-client";
import { propiedadesEnabled } from "@/server/propiedades/flag";

export const dynamic = "force-dynamic";

/** 058 (fork) — Referidos: quién trae clientes con su enlace del sitio. */
export default function ReferidosPage() {
  if (!propiedadesEnabled()) notFound();
  return <ReferidosClient />;
}
