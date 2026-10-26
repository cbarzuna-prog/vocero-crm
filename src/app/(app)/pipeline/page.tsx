import { PipelineClient } from "@/components/pipeline/pipeline-client";
import { tareasEnabled } from "@/server/tareas/flag";
import { propiedadesEnabled } from "@/server/propiedades/flag";

export const dynamic = "force-dynamic";

export default function PipelinePage() {
  // Fork (052): la vista del celular solo con los módulos del fork encendidos;
  // apagados, el pipeline es el de upstream.
  return <PipelineClient movil={tareasEnabled() || propiedadesEnabled()} />;
}
