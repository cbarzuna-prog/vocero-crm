import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Plantilla } from "@/lib/plantillas/tipos";
import { plantillasEnabled } from "./flag";

/**
 * 068 — La configuración en uso del negocio: la copia de su plantilla, con lo
 * que el negocio haya cambiado. `null` si la bandera está apagada o si todavía
 * no eligió plantilla (entonces todo funciona como antes).
 */
export type ConfigNegocio = {
  plantilla: string;
  version: number;
  setupPaso: number | null;
  config: Plantilla;
};

export async function configNegocio(organizationId: string): Promise<ConfigNegocio | null> {
  if (!plantillasEnabled()) return null;
  const N = schema.configNegocio;
  const [r] = await getDb().select().from(N).where(eq(N.organizationId, organizationId)).limit(1);
  if (!r) return null;
  return { plantilla: r.plantilla, version: r.version, setupPaso: r.setupPaso, config: r.config as unknown as Plantilla };
}

/** 068 — ¿Hay que llevar a esta persona al setup? Solo a quien administra, con la bandera, sin terminar. */
export async function necesitaSetup(organizationId: string, puedeConfigurar: boolean): Promise<boolean> {
  if (!plantillasEnabled() || !puedeConfigurar) return false;
  const n = await configNegocio(organizationId);
  return !n || n.setupPaso != null;
}
