import { apiError, parseBody, withAuth } from "@/lib/api";
import { enviarFichaSchema } from "@/lib/propiedades";
import { SendError } from "@/server/inbox/send";
import { enviarFicha } from "@/server/propiedades/enviar";
import { propiedadesDisabledResponse, propiedadesEnabled } from "@/server/propiedades/flag";
import { propiedadErrorResponse } from "@/server/propiedades/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const SEND_STATUS: Partial<Record<SendError["code"], number>> = {
  window_closed: 409,
  message_limit: 409,
  not_connected: 409,
  reconnect_required: 409,
  sandbox_violation: 409,
  meta_unavailable: 503,
};

/** 050 — Envía la ficha (texto compartible + fotos) por la conversación del comprador. */
export const POST = withAuth(async (session, req: Request, ctx: Ctx) => {
  if (!propiedadesEnabled()) return propiedadesDisabledResponse();
  const { id } = await ctx.params;
  const body = await parseBody(req, enviarFichaSchema);
  if (!body.ok) return body.response;
  try {
    const r = await enviarFicha(session.organizationId, session.userId, {
      propertyId: id,
      contactId: body.data.contactId,
      fotos: body.data.fotos ?? 3,
    });
    return Response.json(r);
  } catch (err) {
    if (err instanceof SendError) {
      const msg =
        err.code === "window_closed"
          ? err.message.includes("conversación")
            ? err.message
            : "Pasaron más de 24 h desde el último mensaje de esta persona: WhatsApp solo deja escribirle con una plantilla."
          : err.message;
      return apiError(SEND_STATUS[err.code] ?? 422, err.code, msg);
    }
    const res = propiedadErrorResponse(err);
    if (res) return res;
    throw err;
  }
});
