/**
 * 068 (fork · Hiyou) — Qué es una plantilla de negocio.
 *
 * Una plantilla es una declaración en código, no algo que se arma en una
 * pantalla: dice cómo se llaman las cosas en ese giro, qué etapas tiene el
 * embudo (con su criterio de paso), qué datos lleva la ficha y en qué
 * momento, qué registros puede tener un cliente varias veces (citas,
 * pedidos…), qué vende el negocio y qué recordatorios trae. Las reglas que
 * ninguna plantilla puede romper viven en `reglas.ts`.
 */

export type TipoCampo =
  | "texto"
  | "texto_largo"
  | "numero"
  | "importe"
  | "fecha"
  | "lista"
  | "lista_multiple"
  | "si_no";

/** Cuándo se pide: al primer contacto, durante la venta, u opcional (plegado). */
export type Momento = "inicio" | "venta" | "opcional";

export type Campo = {
  /** `[a-z][a-z0-9_]*`, única en la plantilla. */
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  /** Obligatorio para `lista` y `lista_multiple`. */
  opciones?: string[];
  momento: Momento;
  ayuda?: string;
  /**
   * Dato protegido (cédula, documentos, cuentas): nunca se pide por chat ni
   * lo extrae la IA (política de WhatsApp Business; Ley 8968).
   */
  sensible?: boolean;
  /** `false`: se pide por formulario; la IA no lo pide ni lo extrae. Por defecto `true`. */
  pedirPorChat?: boolean;
  /** Dato de salud: prohibido en la ficha comercial (Ley 8968, art. 9). */
  salud?: boolean;
  /** Se muestra solo si otro campo tiene ese valor. */
  mostrarSi?: { campo: string; igual: string | boolean };
  /** Uno de los pocos que se ven en el panel de la Bandeja. */
  destacado?: boolean;
};

export type TipoEtapa = "open" | "won" | "lost";

export type Etapa = {
  clave: string;
  nombre: string;
  tipo: TipoEtapa;
  /** Qué significa estar aquí, en una frase («Ya confirmó zona, presupuesto y plazo»). */
  criterio?: string;
  /**
   * Lo que el criterio mira, para la lista de verificación: claves de campos
   * de la ficha, `registro:<tipo>` (tiene un registro activo de ese tipo) o
   * `registro:<tipo>:<estado>` (tiene uno de ese tipo en ese estado, no final).
   */
  requisitos?: string[];
  /** El siguiente paso sugerido en esta etapa. */
  accion?: string;
  /** Semáforo (062), en minutos de oficina. */
  ambarMin?: number;
  rojoMin?: number;
};

export type EstadoRegistro = { clave: string; nombre: string; final?: boolean };

/** Lo que un cliente puede tener varias veces: citas, pedidos, casos… */
export type TipoRegistro = {
  clave: string;
  singular: string;
  plural: string;
  estados: EstadoRegistro[];
  usaFecha?: boolean;
  usaImporte?: boolean;
  campos: Omit<Campo, "momento" | "mostrarSi" | "destacado">[];
};

export type ItemCatalogo = { nombre: string; precioCents?: number; moneda?: "CRC" | "USD"; duracionMin?: number };

export type Recordatorio = { clave: string; descripcion: string; encendido: boolean };

export type Vocabulario = {
  /** «cliente», «paciente», «estudiante». */
  cliente: string;
  clientes: string;
  /** Cómo se llama el tablero del embudo en el menú. */
  embudo: string;
  /** Cómo se llama el catálogo («Servicios», «Productos»). */
  catalogo?: string;
};

export type Plantilla = {
  clave: string;
  nombre: string;
  descripcion: string;
  /** Negocio inventado: solo aparece con `PLANTILLAS_DEMO`. */
  demo?: boolean;
  version: number;
  vocabulario: Vocabulario;
  etapas: Etapa[];
  campos: Campo[];
  registros: TipoRegistro[];
  catalogo?: ItemCatalogo[];
  motivosPerdida: string[];
  recordatorios: Recordatorio[];
  metricas: string[];
  modulos: string[];
};
