import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import {
  campoDe,
  PERFIL_VACIO,
  perfilDesdeFicha,
  type CampoPerfil,
  type Fuente,
  type PerfilDto,
  type PerfilPatch,
} from "@/lib/perfil-cliente";

/** 055 (fork) — Errores de dominio de la ficha inmobiliaria. */
export class PerfilError extends Error {
  constructor(
    readonly status: 404 | 422,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "PerfilError";
  }
}

type Fila = typeof schema.contactPerfil.$inferSelect;

function aDto(f: Fila | undefined): PerfilDto {
  if (!f) return { ...PERFIL_VACIO };
  return {
    email: f.email,
    telefono2: f.telefono2,
    viveProvincia: f.viveProvincia,
    viveCanton: f.viveCanton,
    viveDetalle: f.viveDetalle,
    idioma: f.idioma,
    tiposCliente: f.tiposCliente as PerfilDto["tiposCliente"],
    operacion: f.operacion,
    tiposPropiedad: f.tiposPropiedad as PerfilDto["tiposPropiedad"],
    zonas: f.zonas,
    presupuestoMinCents: f.presupuestoMinCents,
    presupuestoMaxCents: f.presupuestoMaxCents,
    moneda: f.moneda,
    habitaciones: f.habitaciones,
    plazo: f.plazo,
    pago: f.pago,
    fuentes: f.fuentes as PerfilDto["fuentes"],
  };
}

async function contactoDeLaOrg(organizationId: string, contactId: string): Promise<boolean> {
  const [c] = await getDb()
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(and(scoped(schema.contact.organizationId, organizationId), eq(schema.contact.id, contactId)))
    .limit(1);
  return !!c;
}

async function filaDe(organizationId: string, contactId: string): Promise<Fila | undefined> {
  const [f] = await getDb()
    .select()
    .from(schema.contactPerfil)
    .where(and(scoped(schema.contactPerfil.organizationId, organizationId), eq(schema.contactPerfil.contactId, contactId)))
    .limit(1);
  return f;
}

export async function leerPerfil(organizationId: string, contactId: string): Promise<PerfilDto> {
  if (!(await contactoDeLaOrg(organizationId, contactId))) throw new PerfilError(404, "no_encontrado", "Contacto no encontrado");
  return aDto(await filaDe(organizationId, contactId));
}

async function escribir(organizationId: string, contactId: string, patch: PerfilPatch, fuentes: Partial<Record<CampoPerfil, Fuente>>) {
  const valores = { ...patch, fuentes, updatedAt: new Date() };
  await getDb()
    .insert(schema.contactPerfil)
    .values({ contactId, organizationId, ...valores })
    .onConflictDoUpdate({ target: schema.contactPerfil.contactId, set: valores });
}

const presupuestoValido = (p: Pick<PerfilDto, "presupuestoMinCents" | "presupuestoMaxCents">) =>
  p.presupuestoMinCents === null || p.presupuestoMaxCents === null || p.presupuestoMinCents <= p.presupuestoMaxCents;

/** Edición de una persona: lo que toca queda como `manual` y el agente ya no lo pisa. */
export async function guardarPerfil(organizationId: string, contactId: string, patch: PerfilPatch): Promise<PerfilDto> {
  if (!(await contactoDeLaOrg(organizationId, contactId))) throw new PerfilError(404, "no_encontrado", "Contacto no encontrado");
  const actual = aDto(await filaDe(organizationId, contactId));
  const nuevo = { ...actual, ...patch };
  if (!presupuestoValido(nuevo)) {
    throw new PerfilError(422, "presupuesto", "El presupuesto mínimo no puede ser mayor que el máximo.");
  }
  const fuentes = { ...actual.fuentes };
  for (const k of Object.keys(patch) as (keyof PerfilPatch)[]) {
    const campo = campoDe(k);
    const v = patch[k];
    // Vaciar un campo lo devuelve al agente: «no sé» no es un dato que proteger.
    const vacio = v === null || (Array.isArray(v) && v.length === 0);
    if (vacio && k !== "moneda") delete fuentes[campo];
    else fuentes[campo] = "manual";
  }
  await escribir(organizationId, contactId, patch, fuentes);
  return aDto(await filaDe(organizationId, contactId));
}

/**
 * Lo que el agente anotó en la ficha libre, a la ficha inmobiliaria. Nunca
 * lanza: un dato mal anotado jamás tumba el turno del agente. Solo llena o
 * actualiza campos que no tocó una persona.
 */
export async function sincronizarDesdeFicha(
  organizationId: string,
  contactId: string,
  ficha: Record<string, unknown>
): Promise<void> {
  try {
    await fusionarAutomatico(organizationId, contactId, perfilDesdeFicha(ficha), "agente");
  } catch (err) {
    console.warn(`[perfil] no se pudo pasar la ficha del agente a la ficha inmobiliaria: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * 058 — Lo que llega solo (el agente al conversar, el formulario del sitio):
 * llena o actualiza los campos que no tocó una persona. Las listas (tipo de
 * cliente, tipos de propiedad, zonas) se suman en vez de reemplazarse: que
 * un formulario diga «comprador» no borra el «inversionista» que anotó el agente.
 */
export async function fusionarAutomatico(
  organizationId: string,
  contactId: string,
  propuesto: PerfilPatch,
  fuente: "agente" | "web",
  opciones: { sumarListas?: boolean } = {}
): Promise<void> {
  if (Object.keys(propuesto).length === 0) return;
  const actual = aDto(await filaDe(organizationId, contactId));
  const patch: PerfilPatch = {};
  const fuentes = { ...actual.fuentes };
  for (const k of Object.keys(propuesto) as (keyof PerfilPatch)[]) {
    const campo = campoDe(k);
    if (actual.fuentes[campo] === "manual") continue;
    let valor = propuesto[k] as unknown;
    if (opciones.sumarListas && Array.isArray(valor) && Array.isArray(actual[k])) {
      valor = [...new Set([...(actual[k] as unknown[]), ...valor])];
    }
    (patch as Record<string, unknown>)[k] = valor;
    fuentes[campo] = fuente;
  }
  if (!presupuestoValido({ ...actual, ...patch })) {
    delete patch.presupuestoMinCents;
    delete patch.presupuestoMaxCents;
    delete patch.moneda;
  }
  if (Object.keys(patch).length === 0) return;
  await escribir(organizationId, contactId, patch, fuentes);
}
