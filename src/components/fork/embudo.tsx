"use client";

import { createContext, useContext } from "react";
import { Search, Trophy, XCircle } from "lucide-react";
import type { AtencionDto } from "@/lib/atencion";
import { ponderado, probabilidadEtapa, visualEtapa } from "@/lib/embudo";
import { formatMoneyCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { usePropiedadLead } from "./atencion";

/**
 * 063 (fork) — Piezas del tablero de Compradores: el encabezado de etapa en
 * flecha de color (Bitrix), el valor ponderado al pie (HubSpot), la barra con
 * buscador y «Solo en rojo», y la propiedad en la tarjeta. Upstream las monta
 * solo si hay un `EmbudoProvider` (fork encendido); si no, todo queda igual.
 */

type Etapa = { id: string; name: string; kind: "open" | "won" | "lost" };

const EmbudoCtx = createContext<Etapa[] | null>(null);

export function EmbudoProvider({ etapas, children }: { etapas: Etapa[]; children: React.ReactNode }) {
  return <EmbudoCtx.Provider value={etapas}>{children}</EmbudoCtx.Provider>;
}
export function useEmbudo(): Etapa[] | null {
  return useContext(EmbudoCtx);
}

function lugar(etapas: Etapa[], id: string) {
  const abiertas = etapas.filter((e) => e.kind === "open");
  return { indice: Math.max(0, abiertas.findIndex((e) => e.id === id)), total: abiertas.length };
}

export function EncabezadoEtapa({ etapa, cantidad }: { etapa: Etapa; cantidad: number }) {
  const etapas = useEmbudo() ?? [etapa];
  const { indice } = lugar(etapas, etapa.id);
  const v = visualEtapa(etapa.kind, indice);
  return (
    <div
      className="flex items-center justify-between gap-2 py-2.5 pl-3 pr-6 text-[13.5px] font-bold tracking-tight"
      style={{ background: v.fondo, color: v.texto, clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)" }}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {etapa.kind === "won" && <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        {etapa.kind === "lost" && <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        <span className="truncate">{etapa.name}</span>
      </span>
      <span className="font-semibold tabular-nums">{cantidad}</span>
    </div>
  );
}

/** Al pie de la columna: el total por la probabilidad de la etapa. */
export function PonderadoEtapa({ etapaId, totalCents, currency }: { etapaId: string; totalCents: number; currency: string }) {
  const etapas = useEmbudo();
  const etapa = etapas?.find((e) => e.id === etapaId);
  if (!etapas || !etapa || etapa.kind !== "open" || totalCents === 0) return null;
  const { indice, total } = lugar(etapas, etapa.id);
  const pct = probabilidadEtapa(etapa, indice, total);
  return (
    <div className="mt-0.5 flex items-baseline justify-between gap-2" title="El total por la probabilidad típica de cerrar desde esta etapa">
      <span className="text-muted-foreground">Ponderado ({pct} %)</span>
      <span className="font-semibold tabular-nums">{formatMoneyCents(ponderado(totalCents, pct), currency)}</span>
    </div>
  );
}

/** La propiedad que le interesa, con su miniatura, en la tarjeta. */
export function PropiedadTarjeta({ leadId }: { leadId: string }) {
  const p = usePropiedadLead(leadId);
  if (!p) return null;
  return (
    <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-text-2">
      {p.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto privada servida con sesión
        <img src={p.coverUrl} alt="" className="h-4 w-6 shrink-0 rounded object-cover" />
      ) : (
        <span className="h-4 w-6 shrink-0 rounded bg-subtle" aria-hidden />
      )}
      <span className="truncate">
        <span className="font-mono">{p.code}</span> · {p.title}
      </span>
    </p>
  );
}

type LeadMin = { id: string; stageId: string; amountCents: number | null; currency?: string | null; contact: { name: string; phone?: string | null } };

/** Lo que el buscador y «Solo en rojo» dejan ver. */
export function filtrarCompradores<T extends LeadMin>(leads: T[], datos: AtencionDto | null, f: { q: string; soloRojo: boolean }): T[] {
  const q = f.q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  // Por teléfono solo si lo escrito es un número (un nombre con dígitos no busca teléfonos).
  const dig = /^[\d\s+()-]+$/.test(f.q.trim()) ? f.q.replace(/\D/g, "") : "";
  return leads.filter((l) => {
    if (f.soloRojo && datos?.leads[l.id]?.nivel !== "rojo") return false;
    if (!q) return true;
    const nombre = l.contact.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const prop = datos?.propiedades?.[l.id];
    const enProp = prop ? `${prop.code} ${prop.title}`.toLowerCase().includes(q) : false;
    const enTel = dig.length >= 3 && (l.contact.phone ?? "").replace(/\D/g, "").includes(dig);
    return nombre.includes(q) || enProp || enTel;
  });
}

/** Debajo del título: el resumen del embudo, el buscador y «Solo en rojo». */
export function BarraCompradores({
  leads,
  datos,
  q,
  onQ,
  soloRojo,
  onSoloRojo,
}: {
  leads: LeadMin[];
  datos: AtencionDto | null;
  q: string;
  onQ: (q: string) => void;
  soloRojo: boolean;
  onSoloRojo: (v: boolean) => void;
}) {
  const abiertos = leads.filter((l) => datos?.leads[l.id]);
  const rojos = abiertos.filter((l) => datos?.leads[l.id]?.nivel === "rojo").length;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5 sm:px-6">
      <p className="text-[13px] text-text-2">
        {abiertos.length} {abiertos.length === 1 ? "trato abierto" : "tratos abiertos"}
        {rojos > 0 && <span className="font-semibold text-danger-text"> · {rojos} esperan atención</span>}
      </p>
      <label className="flex h-9 w-full items-center gap-2 rounded-md bg-subtle px-3 text-[13px] text-text-3 sm:w-64">
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <input
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder="Buscar persona, teléfono o KK-…"
          aria-label="Buscar en Compradores"
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-text-3"
        />
      </label>
      <button
        type="button"
        aria-pressed={soloRojo}
        onClick={() => onSoloRojo(!soloRojo)}
        disabled={rojos === 0 && !soloRojo}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold disabled:opacity-50 [@media(pointer:coarse)]:h-11",
          soloRojo ? "border-danger bg-danger text-white" : "border-danger/40 bg-danger-tint text-danger-text"
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", soloRojo ? "bg-white" : "bg-danger")} aria-hidden />
        Solo en rojo ({rojos})
      </button>
    </div>
  );
}
