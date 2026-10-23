import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { propiedadesDisabledResponse, propiedadesEnabled } from "@/server/propiedades/flag";
import { ordenarFotos, subirFoto } from "@/server/propiedades/fotos";
import { propiedadErrorResponse } from "@/server/propiedades/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 046 — Sube una foto (multipart, campo `file`). */
export const POST = withAuth(async (session, req: Request, ctx: Ctx) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const { id } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return apiError(422, "invalid", "Falta la foto (campo `file`)");
  try {
    const photo = await subirFoto(session.organizationId, id, {
      data: Buffer.from(await file.arrayBuffer()),
      fileName: file.name || undefined,
    });
    return Response.json({ photo }, { status: 201 });
  } catch (err) {
    const res = propiedadErrorResponse(err);
    if (res) return res;
    throw err;
  }
});

/** Reordena: `{ ids: [...] }` con todas las fotos; la primera es la portada. */
export const PUT = withAuth(async (session, req: Request, ctx: Ctx) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const { id } = await ctx.params;
  const body = await parseBody(req, z.object({ ids: z.array(z.string().min(1)).max(50) }));
  if (!body.ok) return body.response;
  try {
    await ordenarFotos(session.organizationId, id, body.data.ids);
    return Response.json({ ok: true });
  } catch (err) {
    const res = propiedadErrorResponse(err);
    if (res) return res;
    throw err;
  }
});
