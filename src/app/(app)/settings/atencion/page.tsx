import { notFound } from "next/navigation";
import { AtencionAjustes } from "@/components/fork/atencion-ajustes";
import { forkActivo } from "@/server/fork-activo";

export const dynamic = "force-dynamic";

/** 062 (fork) — Tiempos de atención por etapa y horario de oficina. */
export default function AtencionAjustesPage() {
  if (!forkActivo()) notFound();
  return <AtencionAjustes />;
}
