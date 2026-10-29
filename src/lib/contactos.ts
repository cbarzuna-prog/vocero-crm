import { z } from "zod";
import type { PerfilDto, TipoCliente, OperacionBuscada } from "@/lib/perfil-cliente";
import type { PriorityValue, SourceDto } from "@/lib/types";

/** 057 (fork) — Un renglón de la lista de Contactos. */
export type ContactoFila = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  aiPaused: boolean;
  archivedAt: string | null;
  createdAt: string;
  source: SourceDto;
  priority: PriorityValue | null;
  lead: { id: string; stageId: string; stageName: string; stageKind: "open" | "won" | "lost"; desde: string } | null;
  conversationId: string | null;
  noLeidos: number;
  ultimaActividad: string;
  email: string | null;
  tiposCliente: TipoCliente[];
  operacion: OperacionBuscada | null;
  zonas: string[];
  presupuestoMinCents: number | null;
  presupuestoMaxCents: number | null;
  moneda: "USD" | "CRC";
  propiedades: string[];
  tareas: { pendientes: number; vencidas: number };
};

export type EventoHistorial = {
  tipo: "alta" | "mensaje" | "etapa" | "propiedad" | "tarea" | "tarea_hecha";
  en: string;
  texto: string;
  quien?: "agente";
};

export type MensajeReciente = {
  id: string;
  direction: "in" | "out";
  text: string | null;
  type: string;
  deAgente: boolean;
  en: string;
};

export type ContactoDetalle = {
  contacto: ContactoFila;
  perfil: PerfilDto;
  historial: EventoHistorial[];
  mensajes: MensajeReciente[];
};

export const ORDENES_CONTACTOS = ["actividad", "recientes", "nombre", "prioridad", "dias_etapa"] as const;
export type OrdenContactos = (typeof ORDENES_CONTACTOS)[number];
export const ORDEN_CONTACTOS_LABELS: Record<OrdenContactos, string> = {
  actividad: "Última actividad",
  recientes: "Más nuevos",
  nombre: "Nombre (A–Z)",
  prioridad: "Prioridad",
  dias_etapa: "Más días en su etapa",
};

export type FiltroContactos = {
  q: string;
  etapa: string; // stageId o ""
  origen: string; // SourceValue | "desconocida" | ""
  tipo: string; // TipoCliente | ""
  propiedad: string; // código | ""
  soloVencidas: boolean;
  archivados: boolean;
};

export const FILTRO_VACIO: FiltroContactos = {
  q: "",
  etapa: "",
  origen: "",
  tipo: "",
  propiedad: "",
  soloVencidas: false,
  archivados: false,
};

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Días completos desde una fecha ISO (0 = hoy). */
export function diasDesde(iso: string, ahora = Date.now()): number {
  return Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 86_400_000));
}

export function filtrarContactos(filas: readonly ContactoFila[], f: FiltroContactos): ContactoFila[] {
  const q = sinTildes(f.q.trim());
  const qDig = f.q.replace(/\D/g, "");
  return filas.filter((c) => {
    if (!f.archivados && c.archivedAt) return false;
    if (f.archivados && !c.archivedAt) return false;
    if (f.etapa && c.lead?.stageId !== f.etapa) return false;
    if (f.origen && c.source.value !== f.origen) return false;
    if (f.tipo && !c.tiposCliente.includes(f.tipo as TipoCliente)) return false;
    if (f.propiedad && !c.propiedades.includes(f.propiedad)) return false;
    if (f.soloVencidas && c.tareas.vencidas === 0) return false;
    if (q) {
      const enTexto = [c.name, c.email ?? "", c.notes ?? "", ...c.zonas, ...c.propiedades].some((t) => sinTildes(t).includes(q));
      const enTel = qDig.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(qDig);
      if (!enTexto && !enTel) return false;
    }
    return true;
  });
}

const RANGO_PRIORIDAD: Record<string, number> = { alta: 0, media: 1, baja: 2 };

export function ordenarContactos(filas: readonly ContactoFila[], orden: OrdenContactos): ContactoFila[] {
  const xs = [...filas];
  const porFecha = (a: string, b: string) => b.localeCompare(a);
  switch (orden) {
    case "actividad":
      return xs.sort((a, b) => porFecha(a.ultimaActividad, b.ultimaActividad));
    case "recientes":
      return xs.sort((a, b) => porFecha(a.createdAt, b.createdAt));
    case "nombre":
      return xs.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
    case "prioridad":
      return xs.sort(
        (a, b) =>
          (RANGO_PRIORIDAD[a.priority ?? ""] ?? 3) - (RANGO_PRIORIDAD[b.priority ?? ""] ?? 3) ||
          porFecha(a.ultimaActividad, b.ultimaActividad)
      );
    case "dias_etapa":
      // Los que llevan más tiempo quietos primero; ganados y perdidos al final.
      return xs.sort((a, b) => {
        const abierto = (c: ContactoFila) => (c.lead && c.lead.stageKind === "open" ? 0 : 1);
        return abierto(a) - abierto(b) || (a.lead?.desde ?? "9").localeCompare(b.lead?.desde ?? "9");
      });
  }
}

/** Opciones de propiedad para el filtro: las que aparecen en la lista. */
export function codigosDePropiedades(filas: readonly ContactoFila[]): string[] {
  return [...new Set(filas.flatMap((c) => c.propiedades))].sort();
}

export const loteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  accion: z.enum(["archivar", "restaurar"]),
});
