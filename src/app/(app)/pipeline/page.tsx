import { PipelineClient } from "@/components/pipeline/pipeline-client";
import { getSessionOrNull } from "@/lib/auth/session";
import { tareasEnabled } from "@/server/tareas/flag";
import { propiedadesEnabled } from "@/server/propiedades/flag";
import { configNegocio } from "@/server/plantillas/config";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  // Fork (052): la vista del celular solo con los módulos del fork encendidos;
  // apagados, el pipeline es el de upstream. 062: y el semáforo de atención.
  // 068: con plantilla, el embudo se llama como el negocio lo llama.
  const propiedades = propiedadesEnabled();
  const fork = tareasEnabled() || propiedades;
  const session = await getSessionOrNull();
  const negocio = session ? await configNegocio(session.organizationId) : null;
  const titulo = negocio?.config.vocabulario.embudo ?? (fork ? "Compradores" : "Pipeline");
  return <PipelineClient movil={fork} atencion={fork || !!negocio} titulo={titulo} conPropiedades={propiedades} />;
}
