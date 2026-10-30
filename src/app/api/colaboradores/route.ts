import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { eq } from "drizzle-orm";
import { CaptacionError, contactoPorTelefono } from "@/server/captaciones/service";
import { participantesDe } from "@/server/colaboracion/service";
import { propiedadesDisabledResponse, propiedadesEnabled } from "@/server/propiedades/flag";

export const dynamic = "force-dynamic";

const schemaNuevo = z.object({ nombre: z.string().trim().min(1).max(120), telefono: z.string().trim().min(7).max(40) });

/** 060 — Quiénes colaboran en alguna propiedad (equipo y externos), para los filtros. */
export const GET = withAuth(async (session) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const m = await participantesDe(session.organizationId);
  const xs = new Map<string, { key: string; nombre: string; externo: boolean }>();
  for (const ps of m.values()) for (const p of ps) xs.set(p.key, { key: p.key, nombre: p.nombre, externo: p.externo });
  return Response.json({ colaboradores: [...xs.values()].sort((a, b) => Number(b.externo) - Number(a.externo) || a.nombre.localeCompare(b.nombre, "es")) });
});

/** 060 — Registrar un co-corredor como contacto (sin trato de comprador). Si el teléfono ya existe, devuelve ese contacto. */
export const POST = withAuth(async (session, req: Request) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const body = await parseBody(req, schemaNuevo);
  if (!body.ok) return body.response;
  try {
    const id = await contactoPorTelefono(session.organizationId, body.data.nombre, body.data.telefono);
    const [c] = await getDb()
      .select({ id: schema.contact.id, name: schema.contact.name })
      .from(schema.contact)
      .where(scoped(schema.contact.organizationId, session.organizationId, eq(schema.contact.id, id)))
      .limit(1);
    return Response.json({ contacto: c }, { status: 201 });
  } catch (err) {
    if (err instanceof CaptacionError) return apiError(422, err.code, err.message);
    throw err;
  }
});
