import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { esquemaValor } from "@/lib/plantillas/reglas";
import type { Campo, Plantilla, TipoRegistro } from "@/lib/plantillas/tipos";
import { configNegocio } from "./config";

/**
 * 068 — La ficha según la plantilla del negocio: valores de los campos y
 * registros vinculados (citas, pedidos…). Todo se valida contra la COPIA de
 * la plantilla que tiene el negocio, nunca contra lo que mande el cliente.
 */

export class FichaError extends Error {
  constructor(
    readonly code: "sin_plantilla" | "no_encontrado" | "campo" | "valor" | "tipo" | "estado",
    message: string
  ) {
    super(message);
    this.name = "FichaError";
  }
}

export type ValorFicha = { valor: unknown; fuente: "manual" | "ia" | "web" | "importado"; porNombre: string | null; updatedAt: string };

export type FichaDto = {
  campos: Campo[];
  valores: Record<string, ValorFicha>;
  tiposRegistro: TipoRegistro[];
  catalogo: Plantilla["catalogo"];
};

export type RegistroDto = {
  id: string;
  tipo: string;
  titulo: string;
  estado: string;
  fecha: string | null;
  importeCents: number | null;
  moneda: "CRC" | "USD" | null;
  datos: Record<string, unknown>;
  createdAt: string;
};

async function requerirConfig(organizationId: string): Promise<Plantilla> {
  const n = await configNegocio(organizationId);
  if (!n) throw new FichaError("sin_plantilla", "Este negocio todavía no eligió su tipo de negocio");
  return n.config;
}

async function requerirContacto(organizationId: string, contactId: string): Promise<void> {
  const C = schema.contact;
  const [c] = await getDb().select({ id: C.id }).from(C).where(scoped(C.organizationId, organizationId, eq(C.id, contactId))).limit(1);
  if (!c) throw new FichaError("no_encontrado", "Ese contacto no existe");
}

export async function leerFicha(organizationId: string, contactId: string): Promise<FichaDto> {
  const pl = await requerirConfig(organizationId);
  await requerirContacto(organizationId, contactId);
  const V = schema.fichaValor;
  const filas = await getDb()
    .select({ campo: V.campo, valor: V.valor, fuente: V.fuente, updatedAt: V.updatedAt, porNombre: schema.user.name })
    .from(V)
    .leftJoin(schema.user, eq(schema.user.id, V.porUserId))
    .where(scoped(V.organizationId, organizationId, eq(V.contactId, contactId)));
  const valores: Record<string, ValorFicha> = {};
  for (const f of filas) valores[f.campo] = { valor: f.valor, fuente: f.fuente, porNombre: f.porNombre ?? null, updatedAt: f.updatedAt.toISOString() };
  return { campos: pl.campos, valores, tiposRegistro: pl.registros, catalogo: pl.catalogo };
}

/** Guarda (o borra, con `null`) el valor de un campo. Devuelve el valor guardado. */
export async function guardarValor(
  organizationId: string,
  contactId: string,
  clave: string,
  valor: unknown,
  porUserId: string | null,
  fuente: ValorFicha["fuente"] = "manual"
): Promise<unknown> {
  const pl = await requerirConfig(organizationId);
  await requerirContacto(organizationId, contactId);
  const campo = pl.campos.find((c) => c.clave === clave);
  if (!campo) throw new FichaError("campo", "Ese dato no existe en la ficha de este negocio");
  const V = schema.fichaValor;
  if (valor === null) {
    await getDb().delete(V).where(scoped(V.organizationId, organizationId, and(eq(V.contactId, contactId), eq(V.campo, clave))));
    return null;
  }
  const r = esquemaValor(campo).safeParse(valor);
  if (!r.success) throw new FichaError("valor", `«${campo.etiqueta}» no tiene un valor válido`);
  await getDb()
    .insert(V)
    .values({ id: newId("fichaValor"), organizationId, contactId, campo: clave, valor: r.data, fuente, porUserId, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [V.contactId, V.campo], set: { valor: r.data, fuente, porUserId, updatedAt: new Date() } });
  return r.data;
}

/** Valores de varios contactos a la vez (para criterios de etapa y listas). */
export async function valoresDeContactos(organizationId: string, contactIds: string[]): Promise<Map<string, Record<string, unknown>>> {
  const m = new Map<string, Record<string, unknown>>();
  if (!contactIds.length) return m;
  const V = schema.fichaValor;
  const filas = await getDb()
    .select({ contactId: V.contactId, campo: V.campo, valor: V.valor })
    .from(V)
    .where(scoped(V.organizationId, organizationId, inArray(V.contactId, contactIds)));
  for (const f of filas) m.set(f.contactId, { ...(m.get(f.contactId) ?? {}), [f.campo]: f.valor });
  return m;
}

// ---------------- Registros vinculados ----------------

function dto(r: typeof schema.registro.$inferSelect): RegistroDto {
  return {
    id: r.id,
    tipo: r.tipo,
    titulo: r.titulo,
    estado: r.estado,
    fecha: r.fecha?.toISOString() ?? null,
    importeCents: r.importeCents,
    moneda: r.moneda,
    datos: r.datos,
    createdAt: r.createdAt.toISOString(),
  };
}

function validarDatos(tipo: TipoRegistro, datos: Record<string, unknown>): Record<string, unknown> {
  const limpio: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(datos)) {
    if (v === null || v === "" || v === undefined) continue;
    const campo = tipo.campos.find((c) => c.clave === k);
    if (!campo) throw new FichaError("campo", `«${k}» no es un dato de ${tipo.singular.toLowerCase()}`);
    const r = esquemaValor(campo).safeParse(v);
    if (!r.success) throw new FichaError("valor", `«${campo.etiqueta}» no tiene un valor válido`);
    limpio[k] = r.data;
  }
  return limpio;
}

export async function listarRegistros(organizationId: string, contactId: string): Promise<RegistroDto[]> {
  await requerirConfig(organizationId);
  await requerirContacto(organizationId, contactId);
  const R = schema.registro;
  const filas = await getDb()
    .select()
    .from(R)
    .where(scoped(R.organizationId, organizationId, eq(R.contactId, contactId)))
    .orderBy(desc(R.fecha), desc(R.createdAt));
  return filas.map(dto);
}

export type NuevoRegistro = {
  tipo: string;
  estado?: string;
  fecha?: string | null;
  importeCents?: number | null;
  moneda?: "CRC" | "USD" | null;
  datos?: Record<string, unknown>;
};

export async function crearRegistro(organizationId: string, contactId: string, n: NuevoRegistro, porUserId: string | null): Promise<RegistroDto> {
  const pl = await requerirConfig(organizationId);
  await requerirContacto(organizationId, contactId);
  const tipo = pl.registros.find((t) => t.clave === n.tipo);
  if (!tipo) throw new FichaError("tipo", "Ese tipo de registro no existe en este negocio");
  const estado = n.estado ?? tipo.estados.find((e) => !e.final)!.clave;
  if (!tipo.estados.some((e) => e.clave === estado)) throw new FichaError("estado", "Ese estado no existe");
  const datos = validarDatos(tipo, n.datos ?? {});
  // El precio del catálogo, si no se dio y el registro nombra un servicio del catálogo.
  const servicio = typeof datos.servicio === "string" ? pl.catalogo?.find((i) => i.nombre === datos.servicio) : undefined;
  const importeCents = n.importeCents ?? (tipo.usaImporte ? (servicio?.precioCents ?? null) : null);
  const moneda = importeCents != null ? (n.moneda ?? servicio?.moneda ?? "CRC") : null;
  const fecha = tipo.usaFecha && n.fecha ? new Date(n.fecha) : null;
  if (fecha && Number.isNaN(fecha.getTime())) throw new FichaError("valor", "La fecha no es válida");
  const titulo = (typeof datos.servicio === "string" ? datos.servicio : null) ?? tipo.singular;
  const R = schema.registro;
  const [fila] = await getDb()
    .insert(R)
    .values({ id: newId("registro"), organizationId, contactId, tipo: tipo.clave, titulo, estado, fecha, importeCents, moneda, datos, creadoPorUserId: porUserId })
    .returning();
  return dto(fila!);
}

export async function actualizarRegistro(
  organizationId: string,
  id: string,
  p: { estado?: string; fecha?: string | null; importeCents?: number | null; datos?: Record<string, unknown> }
): Promise<RegistroDto> {
  const pl = await requerirConfig(organizationId);
  const R = schema.registro;
  const [actual] = await getDb().select().from(R).where(scoped(R.organizationId, organizationId, eq(R.id, id))).limit(1);
  if (!actual) throw new FichaError("no_encontrado", "Ese registro no existe");
  const tipo = pl.registros.find((t) => t.clave === actual.tipo);
  if (!tipo) throw new FichaError("tipo", "Ese tipo de registro ya no existe en este negocio");
  const set: Partial<typeof R.$inferInsert> = { updatedAt: new Date() };
  if (p.estado !== undefined) {
    if (!tipo.estados.some((e) => e.clave === p.estado)) throw new FichaError("estado", "Ese estado no existe");
    set.estado = p.estado;
  }
  if (p.fecha !== undefined) set.fecha = p.fecha ? new Date(p.fecha) : null;
  if (p.importeCents !== undefined) set.importeCents = p.importeCents;
  if (p.datos !== undefined) set.datos = { ...actual.datos, ...validarDatos(tipo, p.datos) };
  const [fila] = await getDb().update(R).set(set).where(scoped(R.organizationId, organizationId, eq(R.id, id))).returning();
  return dto(fila!);
}

/** ¿Tiene el contacto un registro activo (estado no final) de ese tipo? Para los criterios de etapa. */
export async function registrosActivos(organizationId: string, contactIds: string[]): Promise<Map<string, Set<string>>> {
  const m = new Map<string, Set<string>>();
  if (!contactIds.length) return m;
  const pl = await requerirConfig(organizationId);
  const R = schema.registro;
  const filas = await getDb()
    .select({ contactId: R.contactId, tipo: R.tipo, estado: R.estado })
    .from(R)
    .where(scoped(R.organizationId, organizationId, inArray(R.contactId, contactIds)));
  for (const f of filas) {
    const tipo = pl.registros.find((t) => t.clave === f.tipo);
    const final = tipo?.estados.find((e) => e.clave === f.estado)?.final;
    if (final) continue;
    if (!m.has(f.contactId)) m.set(f.contactId, new Set());
    m.get(f.contactId)!.add(f.tipo);
  }
  return m;
}
