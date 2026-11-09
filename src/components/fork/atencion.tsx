"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { AlarmClock } from "lucide-react";
import { textoEspera, type AtencionDto, type EstadoAtencion, type Nivel } from "@/lib/atencion";
import { cn } from "@/lib/utils";

/**
 * 062 (fork) — Semáforo de atención en las pantallas. Un proveedor pide el
 * estado al servidor al montar y cada minuto (y al volver a la pestaña); las
 * tarjetas lo leen con `useAtencionLead` / `useAtencionCaptacion`.
 */

const Ctx = createContext<AtencionDto | null>(null);

export function useAtencionDatos(version = 0, activo = true): AtencionDto | null {
  const [datos, setDatos] = useState<AtencionDto | null>(null);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    const cargar = async () => {
      const res = await fetch("/api/atencion", { cache: "no-store" }).catch(() => null);
      if (vivo && res?.ok) setDatos((await res.json()) as AtencionDto);
    };
    void cargar();
    const t = window.setInterval(() => void cargar(), 60_000);
    const alVolver = () => document.visibilityState === "visible" && void cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [version, activo]);
  return datos;
}

/** 063 — Para quien ya cargó los datos (el tablero de Compradores, que también filtra con ellos). */
export function AtencionValor({ value, children }: { value: AtencionDto | null; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function usePropiedadLead(leadId: string) {
  return useContext(Ctx)?.propiedades?.[leadId] ?? null;
}

/** `version` cambia cuando la pantalla movió algo (etapa, tarea): se recalcula al instante. */
export function AtencionProvider({ children, version = 0 }: { children: React.ReactNode; version?: number }) {
  return <Ctx.Provider value={useAtencionDatos(version)}>{children}</Ctx.Provider>;
}

export function useAtencionLead(leadId: string): EstadoAtencion | null {
  return useContext(Ctx)?.leads[leadId] ?? null;
}
export function useAtencionCaptacion(id: string): EstadoAtencion | null {
  return useContext(Ctx)?.captaciones[id] ?? null;
}
export function useHorarioAtencion() {
  return useContext(Ctx)?.horario;
}

/** Clases para la tarjeta completa: rojo como en las pantallas de cocina. */
export function claseAtencion(nivel: Nivel | undefined): string {
  if (nivel === "rojo") return "!border-danger !bg-danger-tint";
  if (nivel === "ambar") return "!border-warning !bg-warning-tint";
  return "";
}

/** La línea de la tarjeta: qué hacer y cuánto lleva esperando. */
export function AtencionLinea({ e, className }: { e: EstadoAtencion | null; className?: string }) {
  const horario = useHorarioAtencion();
  if (!e) return null;
  if (e.nivel === "ok") {
    // 063 — Sin tarea a futuro: se dice (como el «No upcoming» de HubSpot).
    if (e.motivo === "etapa")
      return (
        <p className={cn("mt-1.5", className)}>
          <span className="inline-block rounded-full border border-warning px-2 py-0.5 text-[11.5px] font-semibold text-warning-text">Sin siguiente paso</span>
        </p>
      );
    if (e.motivo !== "agendado") return null;
    return (
      <p className={cn("mt-1.5 flex items-center gap-1 truncate text-[12px] text-text-3", className)} title={`Siguiente paso: ${e.accion}`}>
        <AlarmClock className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">{e.accion}</span>
      </p>
    );
  }
  const rojo = e.nivel === "rojo";
  return (
    <p
      className={cn("mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold", rojo ? "text-danger-text" : "text-warning-text", className)}
      title={`${e.accion} — esperando ${textoEspera(e.minutos, horario)} (en horario de oficina)`}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", rojo ? "animate-pulse bg-danger" : "bg-warning")} aria-hidden />
      <span className="min-w-0 truncate">{e.accion}</span>
      <span className="shrink-0 tabular-nums">· {textoEspera(e.minutos, horario)}</span>
      <span className="sr-only">{rojo ? "(urgente)" : "(pronto)"}</span>
    </p>
  );
}

/** «Esperan atención», arriba en «Hoy»: lo rojo primero. */
export function EsperandoAtencion({ datos: dados }: { datos?: AtencionDto | null } = {}) {
  const propios = useAtencionDatos(0, dados === undefined);
  const datos = dados === undefined ? propios : dados;
  // Las tareas vencidas ya salen en «Vencidas» de Hoy: aquí no se repiten.
  const lista = (datos?.pendientes ?? []).filter((p) => p.motivo !== "tarea_vencida");
  if (lista.length === 0) return null;
  const rojos = lista.filter((p) => p.nivel === "rojo").length;
  const VISIBLES = 6;
  return (
    <section aria-labelledby="esperan-atencion" className="mb-6">
      <h2 id="esperan-atencion" className="mb-2 flex items-baseline gap-2 text-[15px] font-bold">
        Esperan atención
        <span className="text-[13px] font-normal text-text-3">
          {rojos > 0 ? `${rojos} en rojo · ` : ""}
          {lista.length} en total
        </span>
      </h2>
      <ul className="space-y-1.5">
        {lista.slice(0, VISIBLES).map((p) => (
          <li key={`${p.tipo}-${p.id}`}>
            <Link href={p.href} className={cn("block rounded-md border px-3 py-2 hover:shadow-sm", claseAtencion(p.nivel))}>
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-semibold">{p.nombre}</span>
                <span className="shrink-0 text-[12px] text-text-3">{p.tipo === "captacion" ? `Dueño · ${p.etapa}` : p.etapa}</span>
              </span>
              <AtencionLinea e={p} className="mt-0.5" />
            </Link>
          </li>
        ))}
      </ul>
      {lista.length > VISIBLES && (
        <p className="mt-1.5 text-[13px] text-text-3">
          Y {lista.length - VISIBLES} más en el{" "}
          <Link href="/pipeline" className="font-semibold text-brand-text hover:underline">
            Compradores
          </Link>{" "}
          y en{" "}
          <Link href="/captaciones" className="font-semibold text-brand-text hover:underline">
            Dueños
          </Link>
          .
        </p>
      )}
    </section>
  );
}
