import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { canConfigure } from "@/lib/auth/roles";
import { plantillasOfrecidas } from "@/lib/plantillas/catalogo";
import { aplicarPlantilla, PlantillaError } from "@/server/plantillas/aplicar";
import { configNegocio } from "@/server/plantillas/config";
import { plantillasDemoEnabled, plantillasDisabledResponse, plantillasEnabled } from "@/server/plantillas/flag";

export const dynamic = "force-dynamic";

/** 068 — Las plantillas que se ofrecen en el setup y cuál tiene el negocio. */
export const GET = withAuth(async (session) => {
  if (!plantillasEnabled()) return plantillasDisabledResponse();
  const actual = await configNegocio(session.organizationId);
  return Response.json({
    actual: actual ? { plantilla: actual.plantilla, setupPaso: actual.setupPaso } : null,
    plantillas: plantillasOfrecidas(plantillasDemoEnabled()).map((p) => ({
      clave: p.clave,
      nombre: p.nombre,
      descripcion: p.descripcion,
      demo: !!p.demo,
      etapas: p.etapas.filter((e) => e.tipo === "open").map((e) => e.nombre),
      clientes: p.vocabulario.clientes,
      embudo: p.vocabulario.embudo,
      catalogo: p.vocabulario.catalogo ?? null,
      camposDestacados: p.campos.filter((c) => c.destacado).map((c) => c.etiqueta),
      alerta: p.etapas.find((e) => e.ambarMin != null) ?? null,
    })),
  });
});

const bodySchema = z.object({ clave: z.string().min(1).max(40) });

/** 068 — Aplicar una plantilla (paso 1 del setup, o cambiarla después: nunca borra datos). */
export const POST = withAuth(async (session, req: Request) => {
  if (!plantillasEnabled()) return plantillasDisabledResponse();
  if (!canConfigure(session.role)) return apiError(403, "forbidden", "Solo quien administra puede elegir el tipo de negocio");
  const body = await parseBody(req, bodySchema);
  if (!body.ok) return body.response;
  const permitida = plantillasOfrecidas(plantillasDemoEnabled()).some((p) => p.clave === body.data.clave);
  if (!permitida) return apiError(404, "no_existe", "Esa plantilla no está disponible");
  try {
    const r = await aplicarPlantilla(session.organizationId, body.data.clave);
    return Response.json({ ok: true, plantilla: r.plantilla.clave, etapas: r.etapas });
  } catch (e) {
    if (e instanceof PlantillaError) return apiError(e.code === "no_existe" ? 404 : 422, e.code, e.message);
    throw e;
  }
});
