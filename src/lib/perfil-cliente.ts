import { z } from "zod";
import { CR_CANTONES, CR_PROVINCIAS } from "@/lib/cr-zonas";
import { PROPERTY_CURRENCIES, PROPERTY_TYPES } from "@/lib/propiedades-enums";
import {
  FORMAS_PAGO,
  IDIOMAS,
  OPERACIONES_BUSCADAS,
  PLAZOS,
  TIPOS_CLIENTE,
} from "@/lib/perfil-cliente-enums";

export { FORMAS_PAGO, IDIOMAS, OPERACIONES_BUSCADAS, PLAZOS, TIPOS_CLIENTE };

export type TipoCliente = (typeof TIPOS_CLIENTE)[number];
export type Idioma = (typeof IDIOMAS)[number];
export type OperacionBuscada = (typeof OPERACIONES_BUSCADAS)[number];
export type Plazo = (typeof PLAZOS)[number];
export type FormaPago = (typeof FORMAS_PAGO)[number];
type TipoPropiedad = (typeof PROPERTY_TYPES)[number];
type Moneda = (typeof PROPERTY_CURRENCIES)[number];

export const TIPO_CLIENTE_LABELS: Record<TipoCliente, string> = {
  comprador: "Comprador",
  vendedor: "Vendedor",
  inquilino: "Inquilino",
  arrendador: "Propietario que alquila",
  inversionista: "Inversionista",
};
export const IDIOMA_LABELS: Record<Idioma, string> = { es: "Español", en: "Inglés", otro: "Otro" };
export const OPERACION_BUSCADA_LABELS: Record<OperacionBuscada, string> = {
  venta: "Comprar",
  alquiler: "Alquilar",
  ambas: "Comprar o alquilar",
};
export const PLAZO_LABELS: Record<Plazo, string> = {
  inmediato: "Lo antes posible",
  "1_3_meses": "En 1 a 3 meses",
  "3_6_meses": "En 3 a 6 meses",
  mas_6_meses: "En más de 6 meses",
  explorando: "Solo explorando",
};
export const PAGO_LABELS: Record<FormaPago, string> = {
  contado: "De contado",
  credito: "Con crédito",
  preaprobado: "Crédito preaprobado",
};

/** Los campos de la ficha (también las claves de `fuentes`). */
export const CAMPOS_PERFIL = [
  "email",
  "telefono2",
  "vive",
  "idioma",
  "tiposCliente",
  "operacion",
  "tiposPropiedad",
  "zonas",
  "presupuesto",
  "habitaciones",
  "plazo",
  "pago",
] as const;
export type CampoPerfil = (typeof CAMPOS_PERFIL)[number];
/** Quién llenó un campo: el agente al conversar, el formulario del sitio (058) o una persona. */
export type Fuente = "agente" | "web" | "manual";

export type PerfilDto = {
  email: string | null;
  telefono2: string | null;
  viveProvincia: string | null;
  viveCanton: string | null;
  viveDetalle: string | null;
  idioma: Idioma | null;
  tiposCliente: TipoCliente[];
  operacion: OperacionBuscada | null;
  tiposPropiedad: TipoPropiedad[];
  zonas: string[];
  presupuestoMinCents: number | null;
  presupuestoMaxCents: number | null;
  moneda: Moneda;
  habitaciones: number | null;
  plazo: Plazo | null;
  pago: FormaPago | null;
  fuentes: Partial<Record<CampoPerfil, Fuente>>;
};

export const PERFIL_VACIO: PerfilDto = {
  email: null,
  telefono2: null,
  viveProvincia: null,
  viveCanton: null,
  viveDetalle: null,
  idioma: null,
  tiposCliente: [],
  operacion: null,
  tiposPropiedad: [],
  zonas: [],
  presupuestoMinCents: null,
  presupuestoMaxCents: null,
  moneda: "USD",
  habitaciones: null,
  plazo: null,
  pago: null,
  fuentes: {},
};

/** Parche de columnas (lo que escribe el servicio). */
export type PerfilPatch = Partial<Omit<PerfilDto, "fuentes">>;

/** Qué campo de la ficha toca cada columna (para `fuentes`). */
export function campoDe(columna: keyof PerfilPatch): CampoPerfil {
  if (columna.startsWith("vive")) return "vive";
  if (columna.startsWith("presupuesto") || columna === "moneda") return "presupuesto";
  return columna as CampoPerfil;
}

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

/** Edición manual desde el CRM: todo opcional, `null` borra. */
export const editarPerfilSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .transform((v) => (v === "" ? null : v))
      .pipe(z.string().email("Ese correo no parece válido").nullable())
      .nullable(),
    telefono2: texto(40),
    viveProvincia: z.enum(CR_PROVINCIAS as [string, ...string[]]).nullable(),
    viveCanton: texto(80),
    viveDetalle: texto(160),
    idioma: z.enum(IDIOMAS).nullable(),
    tiposCliente: z.array(z.enum(TIPOS_CLIENTE)).max(TIPOS_CLIENTE.length),
    operacion: z.enum(OPERACIONES_BUSCADAS).nullable(),
    tiposPropiedad: z.array(z.enum(PROPERTY_TYPES)).max(PROPERTY_TYPES.length),
    zonas: z.array(z.string().trim().min(1).max(80)).max(20),
    presupuestoMinCents: z.number().int().nonnegative().max(1e15).nullable(),
    presupuestoMaxCents: z.number().int().nonnegative().max(1e15).nullable(),
    moneda: z.enum(PROPERTY_CURRENCIES),
    habitaciones: z.number().int().min(0).max(50).nullable(),
    plazo: z.enum(PLAZOS).nullable(),
    pago: z.enum(FORMAS_PAGO).nullable(),
  })
  .partial()
  .refine(
    (v) =>
      v.presupuestoMinCents == null || v.presupuestoMaxCents == null || v.presupuestoMinCents <= v.presupuestoMaxCents,
    { message: "El presupuesto mínimo no puede ser mayor que el máximo", path: ["presupuestoMinCents"] }
  );

/* ── Lo que anota el agente ────────────────────────────────────────────── */

/**
 * Claves que el agente usa en la ficha libre (`PUT /api/bot/ficha`) para
 * llenar la ficha inmobiliaria. Se le enseñan en su perfil (ver
 * `INSTRUCCION_FICHA`); el resto de claves sigue siendo libre.
 */
export const CLAVES_AGENTE = {
  correo: "correo electrónico",
  telefono_adicional: "otro teléfono",
  vive_en: "dónde vive (cantón o barrio)",
  idioma: "español o inglés",
  tipo_cliente: "comprador, vendedor, inquilino, propietario que alquila o inversionista",
  operacion: "comprar o alquilar",
  tipo_propiedad: "casa, apartamento, lote, local, oficina, bodega o finca",
  zonas: "zonas donde busca",
  presupuesto_min: "presupuesto mínimo con moneda",
  presupuesto_max: "presupuesto máximo con moneda",
  habitaciones: "habitaciones mínimas",
  para_cuando: "para cuándo lo necesita",
  forma_pago: "contado, crédito o crédito preaprobado",
} as const;

export const INSTRUCCION_FICHA = [
  "Ficha del cliente (bienes raíces): cuando el cliente te diga alguno de estos datos, anótalo en la ficha con EXACTAMENTE estas claves:",
  ...Object.entries(CLAVES_AGENTE).map(([k, v]) => `- ${k}: ${v}`),
  "Anota solo lo que el cliente dijo; no adivines. Los montos con su moneda (ej. «400000 USD» o «185 millones de colones»).",
].join("\n");

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const comoTexto = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (Array.isArray(v)) return v.map(comoTexto).filter(Boolean).join(", ") || null;
  return null;
};
const lista = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.flatMap(lista);
  const t = comoTexto(v);
  if (!t) return [];
  return t
    .split(/\s*(?:,|;|\/|\by\b|\be\b|\bo\b|\bu\b)\s*/i)
    .map((x) => x.trim())
    .filter(Boolean);
};

const TODOS_CANTONES: { provincia: string; canton: string; clave: string }[] = CR_PROVINCIAS.flatMap((p) =>
  (CR_CANTONES[p] as readonly string[]).map((c) => ({ provincia: p, canton: c, clave: sinTildes(c) }))
);

/** «escazu», «Escazú centro» → { San José, Escazú }. */
export function buscarCanton(texto: string): { provincia: string; canton: string } | null {
  const t = sinTildes(texto);
  const exacto = TODOS_CANTONES.find((c) => c.clave === t);
  if (exacto) return exacto;
  // El que aparece primero en la frase («Escazú, San Rafael» → Escazú: San
  // Rafael también es distrito de Escazú); empate → el nombre más largo.
  let mejor: { c: (typeof TODOS_CANTONES)[number]; pos: number } | null = null;
  for (const c of TODOS_CANTONES) {
    const pos = t.search(new RegExp(`\\b${c.clave}\\b`));
    if (pos === -1) continue;
    if (!mejor || pos < mejor.pos || (pos === mejor.pos && c.clave.length > mejor.c.clave.length)) mejor = { c, pos };
  }
  return mejor?.c ?? null;
}

const capitalizar = (s: string) => s.replace(/\s+/g, " ").replace(/(^|\s)\S/g, (m) => m.toUpperCase());

export function monedaDe(texto: string): Moneda | null {
  const t = sinTildes(texto);
  if (/₡|\bcrc\b|colon/.test(t)) return "CRC";
  if (/\$|\busd\b|dolar|dollar|us\$/.test(t)) return "USD";
  return null;
}

/** «400 mil», «400k», «$400,000», «1.2 millones», «₡185 millones» → centavos. */
export function montoACentavos(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.round(v * 100);
  const t0 = comoTexto(v);
  if (!t0) return null;
  const t = sinTildes(t0);
  const m = t.match(/(\d[\d.,\s]*)\s*(k|mil(?:lones|lon)?|m(?:m|illones|illon)?|millions?)?\b/);
  if (!m?.[1]) return null;
  let num = m[1].replace(/\s/g, "");
  const sufijo = m[2] ?? "";
  // Separadores: con sufijo, «1.2» o «1,5» son decimales; sin él, «400,000» o «400.000» son miles.
  if (sufijo) num = num.replace(",", ".");
  else {
    const partes = num.split(/[.,]/);
    const ultima = partes[partes.length - 1] ?? "";
    num = partes.length > 1 && ultima.length === 3 ? partes.join("") : num.replace(",", ".");
  }
  let n = Number(num);
  if (!Number.isFinite(n)) return null;
  if (sufijo === "k" || sufijo === "mil") n *= 1_000;
  else if (sufijo) n *= 1_000_000;
  return n >= 0 ? Math.round(n * 100) : null;
}

const MAPA_TIPO_CLIENTE: [RegExp, TipoCliente][] = [
  [/invers/, "inversionista"],
  [/arrendador|propietario|alquila su|alquilar su|renta su|rentar su/, "arrendador"],
  [/inquilin|arrendatari|alquilar|rentar|alquiler/, "inquilino"],
  [/vend/, "vendedor"],
  [/compr/, "comprador"],
];
const MAPA_TIPO_PROPIEDAD: [RegExp, TipoPropiedad][] = [
  [/apart|apto|depa|condo/, "apartamento"],
  [/casa/, "casa"],
  [/lote|terreno/, "lote"],
  [/local/, "local"],
  [/oficina/, "oficina"],
  [/bodega/, "bodega"],
  [/finca/, "finca"],
];

function mapear<T>(v: unknown, mapa: [RegExp, T][]): T[] {
  const fuera: T[] = [];
  for (const parte of lista(v)) {
    const t = sinTildes(parte);
    const hit = mapa.find(([re]) => re.test(t));
    if (hit && !fuera.includes(hit[1])) fuera.push(hit[1]);
  }
  return fuera;
}

/**
 * Lo que anotó el agente en la ficha libre → parche de la ficha inmobiliaria.
 * Tolerante a propósito (lo escribe un LLM): lo que no entiende lo ignora,
 * nunca lanza. `null` explícito en una clave no borra nada aquí: borrar es de
 * las personas.
 */
export function perfilDesdeFicha(ficha: Record<string, unknown>): PerfilPatch {
  const f: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ficha)) f[sinTildes(k).replace(/[\s-]+/g, "_")] = v;
  const out: PerfilPatch = {};

  const correo = comoTexto(f.correo ?? f.email)?.match(/[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/i)?.[0];
  if (correo) out.email = correo.toLowerCase();

  const tel = comoTexto(f.telefono_adicional ?? f.otro_telefono);
  if (tel && tel.replace(/\D/g, "").length >= 8) out.telefono2 = tel;

  const vive = comoTexto(f.vive_en ?? f.vive ?? f.residencia);
  if (vive) {
    const c = buscarCanton(vive);
    out.viveDetalle = vive.slice(0, 160);
    if (c) {
      out.viveProvincia = c.provincia;
      out.viveCanton = c.canton;
    }
  }

  const idioma = comoTexto(f.idioma);
  if (idioma) {
    const t = sinTildes(idioma);
    out.idioma = /ingl|english|\ben\b/.test(t) ? "en" : /espa|spanish|\bes\b/.test(t) ? "es" : "otro";
  }

  const tipos = mapear(f.tipo_cliente, MAPA_TIPO_CLIENTE);
  if (tipos.length) out.tiposCliente = tipos;

  const op = comoTexto(f.operacion);
  if (op) {
    const t = sinTildes(op);
    const compra = /compr|venta/.test(t);
    const alquiler = /alquil|rent/.test(t);
    if (compra || alquiler) out.operacion = compra && alquiler ? "ambas" : compra ? "venta" : "alquiler";
  }

  const tp = mapear(f.tipo_propiedad, MAPA_TIPO_PROPIEDAD);
  if (tp.length) out.tiposPropiedad = tp;

  const zonas = lista(f.zonas ?? f.zona)
    .map((z) => buscarCanton(z)?.canton ?? capitalizar(z.slice(0, 80)))
    .filter((z, i, a) => a.indexOf(z) === i)
    .slice(0, 20);
  if (zonas.length) out.zonas = zonas;

  const minTxt = f.presupuesto_min ?? f.presupuesto_minimo;
  const maxTxt = f.presupuesto_max ?? f.presupuesto_maximo ?? f.presupuesto;
  const min = montoACentavos(minTxt);
  const max = montoACentavos(maxTxt);
  const moneda = monedaDe([comoTexto(minTxt), comoTexto(maxTxt), comoTexto(f.moneda)].filter(Boolean).join(" "));
  if (min !== null) out.presupuestoMinCents = min;
  if (max !== null) out.presupuestoMaxCents = max;
  if (min !== null && max !== null && min > max) {
    out.presupuestoMinCents = max;
    out.presupuestoMaxCents = min;
  }
  if (moneda && (min !== null || max !== null)) out.moneda = moneda;

  const hab = comoTexto(f.habitaciones)?.match(/\d+/)?.[0];
  if (hab && Number(hab) <= 50) out.habitaciones = Number(hab);

  const cuando = comoTexto(f.para_cuando ?? f.plazo);
  if (cuando) {
    const t = sinTildes(cuando);
    const meses = Number(t.match(/(\d+)\s*mes/)?.[1] ?? NaN);
    out.plazo = /explor|solo (viendo|mirando)|sin prisa|no se/.test(t)
      ? "explorando"
      : /ya\b|inmediat|urgent|pronto|cuanto antes|este mes|semana/.test(t)
        ? "inmediato"
        : Number.isFinite(meses)
          ? meses <= 3
            ? "1_3_meses"
            : meses <= 6
              ? "3_6_meses"
              : "mas_6_meses"
          : /ano|anio|year/.test(t)
            ? "mas_6_meses"
            : undefined;
    if (out.plazo === undefined) delete out.plazo;
  }

  const pago = comoTexto(f.forma_pago ?? f.pago);
  if (pago) {
    const t = sinTildes(pago);
    const p: FormaPago | null = /pre.?aprob/.test(t)
      ? "preaprobado"
      : /credit|hipotec|financ|banco|prestamo/.test(t)
        ? "credito"
        : /contado|efectivo|cash|propio/.test(t)
          ? "contado"
          : null;
    if (p) out.pago = p;
  }
  return out;
}

/** Rango legible: «US$300,000 – US$450,000», «hasta ₡185,000,000». */
export function rangoPresupuesto(p: Pick<PerfilDto, "presupuestoMinCents" | "presupuestoMaxCents" | "moneda">): string | null {
  const f = (c: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: p.moneda, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 })
      .format(c / 100)
      .replace(/^\$/, "US$");
  const { presupuestoMinCents: a, presupuestoMaxCents: b } = p;
  if (a !== null && b !== null) return a === b ? f(a) : `${f(a)} – ${f(b)}`;
  if (b !== null) return `hasta ${f(b)}`;
  if (a !== null) return `desde ${f(a)}`;
  return null;
}
