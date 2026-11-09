import { eq } from "drizzle-orm";
import { z } from "zod";
import { chatJson } from "@/lib/ai";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { detalleContacto } from "@/server/contactos/queries";

/**
 * 063 (fork) — El resumen de un contacto escrito por la IA con la llave de
 * Ajustes → IA: qué busca, qué ha pasado y qué está esperando. Se guarda y
 * se regenera a pedido (no en cada visita: cuesta y no cambia tanto).
 */

export const RESUMEN_MARCA = "[[RESUMEN_CONTACTO]]";

export type ResumenDto = { texto: string; siguientePaso: string | null; generadoAt: string } | null;

const salidaSchema = z.object({
  resumen: z.string().trim().min(1).max(900),
  siguientePaso: z.string().trim().max(200).nullish(),
});

export class ResumenError extends Error {
  constructor(
    readonly code: "no_encontrado" | "sin_ia" | "fallo",
    message: string
  ) {
    super(message);
    this.name = "ResumenError";
  }
}

export async function leerResumen(organizationId: string, contactId: string): Promise<ResumenDto> {
  const R = schema.resumenContacto;
  const [r] = await getDb().select().from(R).where(scoped(R.organizationId, organizationId, eq(R.contactId, contactId))).limit(1);
  return r ? { texto: r.texto, siguientePaso: r.siguientePaso, generadoAt: r.generadoAt.toISOString() } : null;
}

export async function generarResumen(organizationId: string, contactId: string): Promise<NonNullable<ResumenDto>> {
  const d = await detalleContacto(organizationId, contactId);
  if (!d) throw new ResumenError("no_encontrado", "Ese contacto no existe");
  const c = d.contacto;
  const p = d.perfil;
  const ficha = [
    `Nombre: ${c.name}`,
    c.lead ? `Etapa: ${c.lead.stageName} (desde ${c.lead.desde.slice(0, 10)})` : "Sin trato en el embudo",
    p.tiposCliente.length ? `Es: ${p.tiposCliente.join(", ")}` : null,
    p.operacion ? `Busca: ${p.operacion}` : null,
    p.tiposPropiedad.length ? `Tipo: ${p.tiposPropiedad.join(", ")}` : null,
    p.zonas.length ? `Zonas: ${p.zonas.join(", ")}` : null,
    p.presupuestoMaxCents ? `Presupuesto: hasta ${p.moneda} ${Math.round(p.presupuestoMaxCents / 100).toLocaleString("es-CR")}` : null,
    p.habitaciones ? `Habitaciones: ${p.habitaciones}` : null,
    p.plazo ? `Plazo: ${p.plazo}` : null,
    p.pago ? `Pago: ${p.pago}` : null,
    c.propiedades.length ? `Propiedades de interés: ${c.propiedades.join(", ")}` : null,
    c.notes ? `Notas del equipo: ${c.notes.slice(0, 600)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const historia = d.historial
    .slice(0, 15)
    .map((h) => `- ${h.en.slice(0, 16).replace("T", " ")}: ${h.texto}`)
    .join("\n");
  const chat = d.mensajes
    .slice(-15)
    .map((m) => `${m.direction === "in" ? "Cliente" : m.deAgente ? "Agente" : "Equipo"}: ${m.text ?? `[${m.type}]`}`)
    .join("\n");

  const r = await chatJson(
    salidaSchema,
    [
      {
        role: "system",
        content: `${RESUMEN_MARCA}
Usted resume a un cliente de una inmobiliaria de Costa Rica para el corredor que lo atiende.
Responda SOLO con JSON: {"resumen": "...", "siguientePaso": "..."}.
- "resumen": 2 o 3 frases, en español, en tercera persona: qué busca (tipo, zona, presupuesto, plazo), qué ha pasado (propiedades enviadas o visitadas, etapa) y qué está esperando o pidió de último. Solo hechos que estén en los datos; no invente cifras ni nombres.
- "siguientePaso": una acción concreta y corta para el corredor (por ejemplo «Responder si KK-0021 acepta mascotas»), o null si no hay suficiente información.`,
      },
      { role: "user", content: `FICHA:\n${ficha}\n\nHISTORIA:\n${historia || "(sin eventos)"}\n\nÚLTIMOS MENSAJES:\n${chat || "(sin mensajes)"}` },
    ],
    { organizationId, timeoutMs: 30_000 }
  );
  if (!r.ok) {
    if (r.error === "not_configured") throw new ResumenError("sin_ia", "Configure la IA en Ajustes → IA para poder resumir");
    throw new ResumenError("fallo", "La IA no respondió bien. Intente de nuevo en un momento");
  }
  const fila = {
    contactId,
    organizationId,
    texto: r.data.resumen,
    siguientePaso: r.data.siguientePaso ?? null,
    generadoAt: new Date(),
  };
  await getDb()
    .insert(schema.resumenContacto)
    .values(fila)
    .onConflictDoUpdate({ target: schema.resumenContacto.contactId, set: { texto: fila.texto, siguientePaso: fila.siguientePaso, generadoAt: fila.generadoAt } });
  return { texto: fila.texto, siguientePaso: fila.siguientePaso, generadoAt: fila.generadoAt.toISOString() };
}
