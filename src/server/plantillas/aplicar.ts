import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { plantillaPorClave } from "@/lib/plantillas/catalogo";
import { revisarPlantilla } from "@/lib/plantillas/reglas";
import type { Plantilla } from "@/lib/plantillas/tipos";
import { guardarConfigAtencion, leerConfigAtencion } from "@/server/atencion/service";

/**
 * 068 — Aplicar una plantilla a un negocio. Idempotente: aplicarla dos veces
 * deja lo mismo. Nunca borra datos (spec §3, regla 8):
 * - Sin tratos todavía: las etapas del negocio se reemplazan por las de la
 *   plantilla.
 * - Con tratos: se reconocen las etapas por nombre (o por la clave guardada en
 *   su criterio), se agregan las que faltan y no se borra ninguna.
 * Guarda una COPIA de la plantilla en `kk_config_negocio`: lo que el negocio
 * edite después es suyo.
 */

export class PlantillaError extends Error {
  constructor(
    readonly code: "no_existe" | "invalida",
    message: string
  ) {
    super(message);
    this.name = "PlantillaError";
  }
}

/** Un día de oficina en minutos (mismo reloj que 062). */
const DIA = 600;

export async function aplicarPlantilla(organizationId: string, clave: string): Promise<{ plantilla: Plantilla; etapas: number }> {
  const pl = plantillaPorClave(clave);
  if (!pl) throw new PlantillaError("no_existe", "Esa plantilla no existe");
  const problemas = revisarPlantilla(pl);
  if (problemas.length) throw new PlantillaError("invalida", problemas.map((p) => `${p.donde}: ${p.regla}`).join("; "));

  const db = getDb();
  const S = schema.pipelineStage;
  const C = schema.etapaCriterio;

  const idsPorClave = await db.transaction(async (tx) => {
    const [{ tratos }] = (await tx
      .select({ tratos: sql<number>`count(*)::int` })
      .from(schema.lead)
      .where(scoped(schema.lead.organizationId, organizationId))) as [{ tratos: number }];
    const actuales = await tx.select().from(S).where(scoped(S.organizationId, organizationId));
    const criterios = actuales.length
      ? await tx.select({ stageId: C.stageId, clave: C.clave }).from(C).where(scoped(C.organizationId, organizationId, inArray(C.stageId, actuales.map((s) => s.id))))
      : [];
    const claveDe = new Map(criterios.map((c) => [c.stageId, c.clave]));

    const ids = new Map<string, string>();
    const usadas = new Set<string>();
    const reconocer = (e: Plantilla["etapas"][number], conAncla: boolean) =>
      actuales.find((s) => !usadas.has(s.id) && claveDe.get(s.id) === e.clave) ??
      actuales.find((s) => !usadas.has(s.id) && s.name.trim().toLowerCase() === e.nombre.toLowerCase() && s.kind === e.tipo) ??
      (conAncla && e.tipo !== "open" ? actuales.find((s) => !usadas.has(s.id) && s.kind === e.tipo) : undefined);

    if (tratos === 0) {
      // Negocio sin tratos: las etapas quedan exactamente como la plantilla,
      // reusando las que ya son suyas (mismos ids: reaplicar no cambia nada).
      for (const [i, e] of pl.etapas.entries()) {
        const existente = reconocer(e, false);
        if (existente) {
          usadas.add(existente.id);
          ids.set(e.clave, existente.id);
          await tx.update(S).set({ name: e.nombre, position: i, kind: e.tipo }).where(scoped(S.organizationId, organizationId, eq(S.id, existente.id)));
        } else {
          const id = newId("stage");
          await tx.insert(S).values({ id, organizationId, name: e.nombre, position: i, kind: e.tipo });
          ids.set(e.clave, id);
        }
      }
      const sobran = actuales.filter((s) => !usadas.has(s.id)).map((s) => s.id);
      if (sobran.length) await tx.delete(S).where(scoped(S.organizationId, organizationId, inArray(S.id, sobran)));
    } else {
      // Con tratos: reconocer, agregar lo que falta y no borrar nada.
      for (const e of pl.etapas) {
        const existente = reconocer(e, true);
        if (existente) {
          usadas.add(existente.id);
          ids.set(e.clave, existente.id);
          continue;
        }
        const id = newId("stage");
        await tx.insert(S).values({ id, organizationId, name: e.nombre, position: 999, kind: e.tipo });
        ids.set(e.clave, id);
      }
      // Orden: las abiertas (las de siempre y luego las nuevas), después ganada y perdida.
      const todas = await tx.select().from(S).where(scoped(S.organizationId, organizationId));
      const peso = (k: string) => (k === "open" ? 0 : k === "won" ? 1 : 2);
      const orden = [...todas].sort((a, b) => peso(a.kind) - peso(b.kind) || a.position - b.position);
      for (const [i, s] of orden.entries()) {
        if (s.position !== i) await tx.update(S).set({ position: i }).where(scoped(S.organizationId, organizationId, eq(S.id, s.id)));
      }
    }

    for (const e of pl.etapas) {
      const stageId = ids.get(e.clave)!;
      const fila = { stageId, organizationId, clave: e.clave, criterio: e.criterio ?? null, requisitos: e.requisitos ?? [], accion: e.accion ?? null };
      await tx.insert(C).values(fila).onConflictDoUpdate({ target: C.stageId, set: { clave: fila.clave, criterio: fila.criterio, requisitos: fila.requisitos, accion: fila.accion } });
    }

    const N = schema.configNegocio;
    const config = JSON.parse(JSON.stringify(pl)) as Record<string, unknown>;
    await tx
      .insert(N)
      .values({ organizationId, plantilla: pl.clave, version: pl.version, config, setupPaso: 2 })
      .onConflictDoUpdate({ target: N.organizationId, set: { plantilla: pl.clave, version: pl.version, config, aplicadaAt: new Date(), updatedAt: new Date() } });
    return ids;
  });

  // Semáforo (062): acción y tiempos de cada etapa abierta de la plantilla.
  const atencion = await leerConfigAtencion(organizationId);
  const vigentes = new Set(
    (await getDb().select({ id: S.id }).from(S).where(scoped(S.organizationId, organizationId))).map((s) => s.id)
  );
  for (const id of Object.keys(atencion.etapas)) if (!vigentes.has(id)) delete atencion.etapas[id];
  for (const e of pl.etapas) {
    if (e.tipo !== "open" || !e.accion) continue;
    const id = idsPorClave.get(e.clave)!;
    atencion.etapas[id] = { accion: e.accion, ambarMin: e.ambarMin ?? DIA, rojoMin: e.rojoMin ?? 2 * DIA };
  }
  await guardarConfigAtencion(organizationId, atencion);

  return { plantilla: pl, etapas: pl.etapas.length };
}

/** El paso del setup en que quedó el negocio (para retomar). */
export async function marcarPasoSetup(organizationId: string, paso: number | null): Promise<void> {
  const N = schema.configNegocio;
  await getDb().update(N).set({ setupPaso: paso, updatedAt: new Date() }).where(and(eq(N.organizationId, organizationId)));
}
