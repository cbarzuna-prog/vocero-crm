import { webLeadSchema } from "@/lib/web-leads";
import { resolveInstanceOrg } from "@/server/bot/auth";
import { forkActivo } from "@/server/fork-activo";
import { isValidWebhookToken } from "@/server/inbox/webhook";
import { recibirLeadWeb, WebLeadError } from "@/server/web-leads/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

const MAX_BYTES = 64 * 1024;

/**
 * 058 (fork) — Leads de knockknockcr.com. La llave va en la ruta, como los
 * webhooks de Meta: `WEB_LEADS_TOKEN` del .env (la misma que tiene el sitio).
 * Llave mala o sin configurar → 404 sin efectos. GET responde `{ ok: true }`
 * para que el sitio pueda probar la conexión sin mandar un lead.
 */
function autorizado(token: string): boolean {
  return forkActivo() && isValidWebhookToken(token, (process.env.WEB_LEADS_TOKEN ?? "").trim());
}

export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;
  if (!autorizado(token)) return new Response(null, { status: 404 });
  return Response.json({ ok: true });
}

export async function POST(req: Request, { params }: Params) {
  const { token } = await params;
  if (!autorizado(token)) return new Response(null, { status: 404 });

  const crudo = await req.text().catch(() => "");
  if (crudo.length > MAX_BYTES) return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(crudo);
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = webLeadSchema.safeParse(json);
  if (!parsed.success) return Response.json({ ok: false, error: "invalid_input" }, { status: 422 });

  const organizationId = await resolveInstanceOrg();
  if (!organizationId) return Response.json({ ok: false, error: "no_org" }, { status: 409 });

  try {
    const r = await recibirLeadWeb(organizationId, parsed.data);
    return Response.json({ ok: true, contactId: r.contactId, duplicate: r.duplicado });
  } catch (err) {
    if (err instanceof WebLeadError) {
      return Response.json({ ok: false, error: err.code }, { status: err.code === "en_proceso" ? 409 : 422 });
    }
    console.error(`[web-leads] no se pudo registrar el envío ${parsed.data.id}: ${err instanceof Error ? err.message : err}`);
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
