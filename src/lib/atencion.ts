import { z } from "zod";

/**
 * 062 (fork) — Semáforo de atención: cada trato (Pipeline) y cada captación
 * tiene un tiempo máximo sin contacto según su etapa; pasado el primero se
 * pone ámbar y pasado el segundo, rojo. El reloj corre solo en horario de
 * oficina. Puro: lo usan el servidor, la UI y las pruebas.
 *
 * Reglas (en orden):
 *  1. El cliente escribió y nadie le respondió → tiempos de «mensaje sin
 *     responder» desde su mensaje, en cualquier etapa.
 *  2. Hay una tarea abierta a futuro → al día (el siguiente paso está puesto).
 *  3. Hay una tarea vencida → el reloj de la etapa corre desde su vencimiento.
 *  4. Si no → el reloj de la etapa corre desde el último contacto real
 *     (mensaje enviado, cambio de etapa, tarea hecha o alta).
 * Ganados y perdidos no tienen reloj.
 */

export type Nivel = "ok" | "ambar" | "rojo";

export type Tiempo = { ambarMin: number; rojoMin: number; accion: string };

export type Horario = {
  /** 0 = domingo … 6 = sábado. */
  dias: number[];
  desde: string; // "08:00"
  hasta: string; // "18:00"
};

export type ConfigAtencion = {
  horario: Horario;
  mensaje: { ambarMin: number; rojoMin: number };
  /** Por id de etapa del Pipeline. Las que falten usan `porNombre` o el general. */
  etapas: Record<string, Tiempo>;
  /** Por etapa de Captaciones. */
  captaciones: Record<string, Tiempo>;
};

const H = 60;
const DIA = 10 * H; // un día de oficina de 10 h (8:00–18:00)

export const HORARIO_DEFECTO: Horario = { dias: [1, 2, 3, 4, 5, 6], desde: "08:00", hasta: "18:00" };
export const MENSAJE_DEFECTO = { ambarMin: 15, rojoMin: 60 };
export const TIEMPO_GENERAL: Tiempo = { ambarMin: 1 * DIA, rojoMin: 2 * DIA, accion: "Dar seguimiento" };

/**
 * Buenas prácticas por etapa (investigación 2026-11-06: MIT/HubSpot sobre
 * velocidad de respuesta, NAR —el 78 % se queda con el primero que responde—,
 * calendarios de seguimiento inmobiliario y el «estancamiento» de Pipedrive).
 * Se reconocen por el nombre de la etapa. Los minutos son de oficina: «1 día»
 * es un día de oficina (10 h con el horario por defecto), no 24 h de reloj.
 */
export const TIEMPOS_POR_NOMBRE: { claves: string[]; tiempo: Tiempo }[] = [
  { claves: ["nuevo"], tiempo: { ambarMin: 5, rojoMin: 15, accion: "Llamar; si no contesta, WhatsApp con 3 o 4 propiedades" } },
  { claves: ["contactado", "conversacion"], tiempo: { ambarMin: 1 * DIA, rojoMin: 2 * DIA, accion: "Calificar: presupuesto, zona, plazo y forma de pago" } },
  { claves: ["calificado", "interesado"], tiempo: { ambarMin: 1 * DIA, rojoMin: 2 * DIA, accion: "Enviar propiedades que calcen y proponer visita" } },
  { claves: ["visita agendada", "agendada"], tiempo: { ambarMin: 2 * DIA, rojoMin: 3 * DIA, accion: "Confirmar la visita el día antes" } },
  { claves: ["visita realizada", "realizada", "visitad"], tiempo: { ambarMin: 5 * H, rojoMin: 1 * DIA, accion: "Llamar después de la visita: ¿qué le pareció?" } },
  { claves: ["oferta", "negociacion"], tiempo: { ambarMin: 1 * DIA, rojoMin: 2 * DIA, accion: "Seguir la oferta hasta cerrar" } },
  { claves: ["reservado", "reserva"], tiempo: { ambarMin: 2 * DIA, rojoMin: 4 * DIA, accion: "Acompañar el trámite: financiamiento, estudio y firma" } },
];

export const CAPTACION_TIEMPOS: Record<string, Tiempo> = {
  contacto: { ambarMin: 1 * H, rojoMin: 4 * H, accion: "Llamar al dueño y agendar la valoración" },
  valoracion: { ambarMin: 3 * DIA, rojoMin: 5 * DIA, accion: "Entregar el estudio de precio" },
  propuesta: { ambarMin: 2 * DIA, rojoMin: 5 * DIA, accion: "Seguir la propuesta hasta que firme" },
  firmada: { ambarMin: 5 * DIA, rojoMin: 10 * DIA, accion: "Fotos, ficha y publicar" },
  publicada: { ambarMin: 14 * DIA, rojoMin: 21 * DIA, accion: "Informe de visitas y ofertas al dueño" },
};

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** El tiempo de una etapa del Pipeline: el guardado, o el que su nombre sugiere, o el general. */
export function tiempoDeEtapa(cfg: Pick<ConfigAtencion, "etapas">, etapa: { id: string; name: string }): Tiempo {
  return cfg.etapas[etapa.id] ?? tiempoPorNombre(etapa.name);
}

export function tiempoPorNombre(nombre: string): Tiempo {
  const n = sinTildes(nombre);
  // Primero las claves más largas: «visita realizada» antes que «visita».
  const candidatos = TIEMPOS_POR_NOMBRE.flatMap((t) => t.claves.map((c) => ({ c, t: t.tiempo }))).sort((a, b) => b.c.length - a.c.length);
  return candidatos.find((x) => n.includes(x.c))?.t ?? TIEMPO_GENERAL;
}

/* ---------------- Minutos de oficina ---------------- */

const aMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

/** Fecha y minuto del día en la zona del negocio. */
function partesEnZona(d: Date, tz: string): { ymd: string; dow: number; min: number } {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday!);
  return { ymd: `${p.year}-${p.month}-${p.day}`, dow, min: Number(p.hour) * 60 + Number(p.minute) };
}

const sumarDia = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const dowDe = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

/**
 * Minutos de oficina entre dos instantes. Recorre día por día (como mucho un
 * año: más allá ya es rojo de sobra).
 */
export function minutosHabiles(desde: Date, hasta: Date, horario: Horario, tz: string): number {
  if (hasta <= desde) return 0;
  const a = partesEnZona(desde, tz);
  const b = partesEnZona(hasta, tz);
  const abre = aMin(horario.desde);
  const cierra = aMin(horario.hasta);
  if (cierra <= abre) return 0;
  let total = 0;
  let dia = a.ymd;
  for (let i = 0; i < 400; i++) {
    if (horario.dias.includes(dowDe(dia))) {
      const ini = dia === a.ymd ? Math.max(abre, a.min) : abre;
      const fin = dia === b.ymd ? Math.min(cierra, b.min) : cierra;
      if (fin > ini) total += fin - ini;
    }
    if (dia === b.ymd) break;
    dia = sumarDia(dia, 1);
  }
  return total;
}

/* ---------------- El estado de un trato ---------------- */

export type EntradaAtencion = {
  /** Etapa abierta (no ganada ni perdida). */
  abierta: boolean;
  tiempo: Tiempo;
  /** Último mensaje del cliente y último enviado por el negocio (o el agente). */
  ultimoEntrante: Date | null;
  ultimoSaliente: Date | null;
  /** Último contacto real además de los mensajes: cambio de etapa, tarea hecha, alta. */
  ultimoContacto: Date;
  /** La próxima tarea abierta (la de vencimiento más cercano). */
  proximaTarea: { titulo: string; vence: Date } | null;
};

export type EstadoAtencion = {
  nivel: Nivel;
  /** Qué hay que hacer ahora. */
  accion: string;
  /** Desde cuándo corre el reloj (null = al día con tarea futura). */
  desde: string | null;
  /** Minutos de oficina transcurridos. */
  minutos: number;
  motivo: "mensaje" | "tarea_vencida" | "etapa" | "agendado";
};

export function estadoAtencion(e: EntradaAtencion, cfg: Pick<ConfigAtencion, "horario" | "mensaje">, ahora: Date, tz: string): EstadoAtencion | null {
  if (!e.abierta) return null;
  const nivelDe = (min: number, t: { ambarMin: number; rojoMin: number }): Nivel => (min >= t.rojoMin ? "rojo" : min >= t.ambarMin ? "ambar" : "ok");

  // 1. Mensaje sin responder.
  if (e.ultimoEntrante && (!e.ultimoSaliente || e.ultimoSaliente < e.ultimoEntrante)) {
    const min = minutosHabiles(e.ultimoEntrante, ahora, cfg.horario, tz);
    return { nivel: nivelDe(min, cfg.mensaje), accion: "Responder su mensaje", desde: e.ultimoEntrante.toISOString(), minutos: min, motivo: "mensaje" };
  }
  // 2. Siguiente paso agendado.
  if (e.proximaTarea && e.proximaTarea.vence > ahora) {
    return { nivel: "ok", accion: e.proximaTarea.titulo, desde: null, minutos: 0, motivo: "agendado" };
  }
  // 3. Tarea vencida.
  if (e.proximaTarea) {
    const min = minutosHabiles(e.proximaTarea.vence, ahora, cfg.horario, tz);
    return { nivel: nivelDe(min, e.tiempo), accion: e.proximaTarea.titulo, desde: e.proximaTarea.vence.toISOString(), minutos: min, motivo: "tarea_vencida" };
  }
  // 4. El reloj de la etapa.
  const ultimo = [e.ultimoContacto, e.ultimoSaliente].filter((d): d is Date => !!d).reduce((a, b) => (a > b ? a : b));
  const min = minutosHabiles(ultimo, ahora, cfg.horario, tz);
  return { nivel: nivelDe(min, e.tiempo), accion: e.tiempo.accion, desde: ultimo.toISOString(), minutos: min, motivo: "etapa" };
}

/** «12 min», «3 h 20 min», «2 d 4 h» (días de oficina). */
export function textoEspera(min: number, horario: Horario = HORARIO_DEFECTO): string {
  const porDia = Math.max(1, aMin(horario.hasta) - aMin(horario.desde));
  if (min < 60) return `${min} min`;
  if (min < porDia) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const d = Math.floor(min / porDia);
  const h = Math.floor((min % porDia) / 60);
  return h ? `${d} d ${h} h` : `${d} d`;
}

/** «15 min», «4 h», «3 días» para mostrar un umbral en Ajustes. */
export function textoUmbral(min: number): string {
  if (min < 60) return `${min} min`;
  if (min % DIA === 0 && min >= DIA) return `${min / DIA} ${min / DIA === 1 ? "día" : "días"}`;
  if (min % 60 === 0) return `${min / 60} h`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

/* ---------------- Contratos ---------------- */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const tiempoSchema = z
  .object({
    ambarMin: z.number().int().min(1).max(60 * DIA),
    rojoMin: z.number().int().min(1).max(90 * DIA),
    accion: z.string().trim().min(1).max(160),
  })
  .refine((t) => t.rojoMin > t.ambarMin, { message: "El rojo va después del ámbar" });

export const configAtencionSchema = z.object({
  horario: z
    .object({ dias: z.array(z.number().int().min(0).max(6)).min(1).max(7), desde: hhmm, hasta: hhmm })
    .refine((h) => aMin(h.hasta) > aMin(h.desde), { message: "La hora de cierre va después de la de apertura" }),
  mensaje: z
    .object({ ambarMin: z.number().int().min(1).max(DIA), rojoMin: z.number().int().min(1).max(5 * DIA) })
    .refine((t) => t.rojoMin > t.ambarMin, { message: "El rojo va después del ámbar" }),
  etapas: z.record(z.string().min(1).max(80), tiempoSchema),
  captaciones: z.record(z.enum(["contacto", "valoracion", "propuesta", "firmada", "publicada"]), tiempoSchema),
});

export function configPorDefecto(): ConfigAtencion {
  return { horario: HORARIO_DEFECTO, mensaje: MENSAJE_DEFECTO, etapas: {}, captaciones: { ...CAPTACION_TIEMPOS } };
}

/** Lo guardado sobre los valores por defecto (lo que falte o no valga, por defecto). */
export function completarConfig(guardada: unknown): ConfigAtencion {
  const base = configPorDefecto();
  const r = configAtencionSchema.partial().safeParse(guardada);
  if (!r.success) return base;
  return {
    horario: r.data.horario ?? base.horario,
    mensaje: r.data.mensaje ?? base.mensaje,
    etapas: r.data.etapas ?? {},
    captaciones: { ...base.captaciones, ...(r.data.captaciones ?? {}) },
  };
}

/** Lo que el servidor manda a las pantallas. */
export type AtencionDto = {
  horario: Horario;
  leads: Record<string, EstadoAtencion>;
  captaciones: Record<string, EstadoAtencion>;
  /** Lo que está en ámbar o rojo, lo más urgente primero (para «Hoy»). */
  pendientes: PendienteAtencion[];
};

export type PendienteAtencion = EstadoAtencion & {
  tipo: "trato" | "captacion";
  id: string;
  nombre: string;
  etapa: string;
  /** Adónde ir: la página del contacto o la ficha de la propiedad. */
  href: string;
};

/** Rojo antes que ámbar; dentro de cada uno, el que más lleva esperando. */
export function ordenarPendientes<T extends Pick<EstadoAtencion, "nivel" | "minutos">>(xs: readonly T[]): T[] {
  const peso = { rojo: 0, ambar: 1, ok: 2 } as const;
  return [...xs].filter((x) => x.nivel !== "ok").sort((a, b) => peso[a.nivel] - peso[b.nivel] || b.minutos - a.minutos);
}
