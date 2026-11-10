import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { forkActivo, forkApagadoResponse } from "@/server/fork-activo";
import { cambiarTelefono, detalleContacto } from "@/server/contactos/queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 057 (fork) — La página de un contacto: datos, ficha, historial y últimos mensajes. */
export const GET = withAuth(async (session, _req: Request, ctx: Ctx) => {
  if (!forkActivo()) return forkApagadoResponse();
  const { id } = await ctx.params;
  const d = await detalleContacto(session.organizationId, id);
  if (!d) return apiError(404, "not_found", "Contacto no encontrado");
  return Response.json(d);
});

const patchSchema = z.object({ phone: z.string().max(40).nullable() });

/** 067 (fork) — Cambiar el teléfono desde la ficha (upstream no lo edita: es un atributo opcional). */
export const PATCH = withAuth(async (session, req: Request, ctx: Ctx) => {
  if (!forkActivo()) return forkApagadoResponse();
  const { id } = await ctx.params;
  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;
  const r = await cambiarTelefono(session.organizationId, id, body.data.phone);
  if (r === "no_encontrado") return apiError(404, "not_found", "Contacto no encontrado");
  if (r === "invalido") return apiError(422, "telefono_invalido", "Ese teléfono no parece válido: escriba 8 dígitos de Costa Rica o el número con su código de país");
  return Response.json({ ok: true });
});
