import { notFound } from "next/navigation";
import { CaptacionesClient } from "@/components/fork/captaciones-client";
import { propiedadesEnabled } from "@/server/propiedades/flag";

export const dynamic = "force-dynamic";

/** 048 (fork) — Captaciones: el pipeline de vendedores. */
export default function CaptacionesPage() {
  if (!propiedadesEnabled()) notFound();
  return <CaptacionesClient />;
}
