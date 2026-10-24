import { z } from "zod";
import { TASK_TYPES } from "@/lib/tareas-enums";

/**
 * 046 — Tareas de seguimiento: tipos, etiquetas, contratos internos y la
 * agrupación de «Hoy». Puro y sin servidor: lo usan la API y la UI.
 */

export type TaskType = (typeof TASK_TYPES)[number];
export { TASK_TYPES };

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  visita: "Visita",
  otro: "Otro",
};

export type TaskDto = {
  id: string;
  title: string;
  type: TaskType;
  /** ISO UTC. */
  dueAt: string;
  allDay: boolean;
  doneAt: string | null;
  /** 050: el teléfono para «Llamar» con un toque (null en contactos sin número). */
  contact: { id: string; name: string; phone: string | null };
  /** 050: la portada, para reconocer la propiedad de un vistazo. */
  property: { id: string; code: string; title: string; coverUrl: string | null } | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
};

/** Un trato abierto sin ninguna tarea pendiente (D7). */
export type SinSiguientePasoDto = {
  leadId: string;
  contact: { id: string; name: string };
  stageName: string;
  /** ISO UTC; null = sin actividad registrada. */
  lastActivityAt: string | null;
};

export type HoyDto = {
  /** Día del negocio, `AAAA-MM-DD`. */
  today: string;
  timezone: string;
  vencidas: TaskDto[];
  hoy: TaskDto[];
  sinSiguientePaso: SinSiguientePasoDto[];
};

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha AAAA-MM-DD");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "hora HH:MM");

/**
 * La fecha llega como día + hora DEL NEGOCIO (no un instante del navegador):
 * quien crea la tarea puede estar en otra zona. Sin hora = todo el día.
 */
export const crearTareaSchema = z.object({
  contactId: z.string().min(1),
  propertyId: z.string().min(1).nullish(),
  title: z.string().trim().min(1, "el título no puede ir vacío").max(200),
  type: z.enum(TASK_TYPES).optional(),
  day: isoDay,
  time: hhmm.nullish(),
  assignedUserId: z.string().min(1).nullish(),
});
export type CrearTareaInput = z.infer<typeof crearTareaSchema>;

export const editarTareaSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    type: z.enum(TASK_TYPES),
    day: isoDay,
    time: hhmm.nullable(),
    done: z.boolean(),
    assignedUserId: z.string().min(1).nullable(),
    propertyId: z.string().min(1).nullable(),
  })
  .partial()
  .refine((v) => (v.time === undefined ? true : v.day !== undefined), {
    message: "para cambiar la hora envíe también el día",
    path: ["time"],
  });
export type EditarTareaInput = z.infer<typeof editarTareaSchema>;

/**
 * Orden dentro de una sección: las de todo el día primero (son «hoy, cuando
 * puedas») y luego por hora.
 */
export function compareTasks(a: TaskDto, b: TaskDto): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.dueAt.localeCompare(b.dueAt);
}

/** Una tarea de hoy con hora ya pasada se marca atrasada (sigue en «Hoy»). */
export function isLate(task: TaskDto, now: Date): boolean {
  return !task.doneAt && !task.allDay && new Date(task.dueAt).getTime() < now.getTime();
}

/** Siguiente fecha sugerida tras completar: +2 días hábiles (lun–vie). */
export function nextBusinessDays(dayIso: string, n = 2): string {
  const d = new Date(`${dayIso}T12:00:00Z`);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

/** 050 — Atajos para reprogramar: días desde hoy (el negocio). */
export const POSPONER = [
  { label: "Mañana", dias: 1 },
  { label: "En 3 días", dias: 3 },
  { label: "Próxima semana", dias: 7 },
] as const;

/** `AAAA-MM-DD` + n días (aritmética de calendario, sin zona). */
export function sumarDias(dayIso: string, n: number): string {
  const d = new Date(`${dayIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** `tel:` con el número tal como lo guarda el CRM (con código de país). */
export function telHref(phone: string | null): string | null {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  if (!digits) return null;
  return `tel:${digits.startsWith("+") ? digits : `+${digits}`}`;
}

/** Día y hora de pared de una tarea en la zona del negocio. */
export function diaYHora(task: TaskDto, tz: string): { day: string; time: string | null } {
  const d = new Date(task.dueAt);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = task.allDay
    ? null
    : new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return { day, time };
}

