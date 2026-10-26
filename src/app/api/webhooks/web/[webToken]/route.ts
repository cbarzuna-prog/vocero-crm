import { webLeadSchema } from "@/lib/leads-web";
import { isValidWebLeadsToken, leadsWebEnabled } from "@/server/leads-web/flag";
import { recibirLeadWeb, WebLeadError } from "@/server/leads-web/service";

/**
 * 054 (fork Knock Knock) — Webhook de los formularios de la web.
 *
 * La URL secreta es la llave (D2): bandera apagada o token malo → 404 sin
 * efectos, igual que el webhook de WhatsApp. Lo llama el SERVIDOR de la web,
 * nunca el navegador: por eso no hay CORS.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ webToken: string }> };

function autorizado(webToken: string): boolean {
  return leadsWebEnabled() && isValidWebLeadsToken(webToken, process.env.WEB_LEADS_TOKEN);
}

/** Para comprobar la URL a mano desde el navegador o con curl. */
export async function GET(_req: Request, { params }: Params) {
  const { webToken } = await params;
  if (!autorizado(webToken)) return new Response(null, { status: 404 });
  return Response.json({ ok: true });
}

export async function POST(req: Request, { params }: Params) {
  const { webToken } = await params;
  if (!autorizado(webToken)) return new Response(null, { status: 404 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ ok: false, error: "El cuerpo no es JSON" }, { status: 400 });
  }

  const parsed = webLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Datos inválidos",
        issues: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      },
      { status: 400 }
    );
  }

  try {
    const result = await recibirLeadWeb(parsed.data, raw as Record<string, unknown>);
    return Response.json(result);
  } catch (err) {
    if (err instanceof WebLeadError) {
      const status = err.code === "telefono_invalido" ? 400 : 503;
      return Response.json({ ok: false, error: err.message, code: err.code }, { status });
    }
    console.error("[leads-web] error procesando la solicitud:", err);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
