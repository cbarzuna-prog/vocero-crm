"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bath, BedDouble, Building2, Plus, Ruler, Search, SlidersHorizontal, Users } from "lucide-react";
import { CR_CANTONES, CR_PROVINCIAS } from "@/lib/cr-zonas";
import {
  formatPrecio,
  OPERATION_LABELS,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  STATUS_LABELS,
  TYPE_LABELS,
  type PropertyListItem,
} from "@/lib/propiedades";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { NuevaPropiedadDialog } from "./nueva-propiedad-dialog";
import { Cover, selectClass, StatusBadge } from "./shared";

type Filtros = {
  operation: string;
  type: string;
  status: string;
  canton: string;
  currency: string;
  min: string;
  max: string;
  q: string;
};

const VACIO: Filtros = { operation: "", type: "", status: "activas", canton: "", currency: "", min: "", max: "", q: "" };

function cuenta(f: Filtros): number {
  return (["operation", "type", "canton", "currency", "min", "max"] as const).filter((k) => f[k]).length +
    (f.status !== "activas" ? 1 : 0);
}

function Card({ p }: { p: PropertyListItem }) {
  const precio = formatPrecio(p.priceCents, p.currency);
  return (
    <li>
      <Link
        href={`/propiedades/${p.id}`}
        className="group block overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-[16/10] overflow-hidden sm:aspect-[4/3]">
          <Cover url={p.coverUrl} alt={p.title} className="transition-transform duration-300 group-hover:scale-[1.02]" />
          <div className="absolute left-2 top-2 flex gap-1">
            <StatusBadge status={p.status} />
          </div>
          <span className="absolute right-2 top-2 rounded-full border bg-background px-2 py-0.5 text-[11px] font-semibold">
            {OPERATION_LABELS[p.operation]}
          </span>
        </div>
        <div className="p-3">
          <p className="text-[17px] font-bold tracking-tight">
            {precio ?? <span className="text-text-3">Sin precio</span>}
            {precio && p.operation === "alquiler" && <span className="text-xs font-semibold text-text-3"> /mes</span>}
          </p>
          <p className="mt-0.5 truncate text-[14px] font-[620]">{p.title}</p>
          <p className="truncate text-xs text-text-3">
            {p.code} · {[p.zona, p.canton ?? p.provincia].filter(Boolean).join(", ")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-2">
            {p.habitaciones !== null && (
              <span className="inline-flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden /> {p.habitaciones}
                <span className="sr-only">habitaciones</span>
              </span>
            )}
            {p.banos !== null && (
              <span className="inline-flex items-center gap-1">
                <Bath className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden /> {p.banos}
                <span className="sr-only">baños</span>
              </span>
            )}
            {(p.m2Construccion ?? p.m2Terreno) !== null && (
              <span className="inline-flex items-center gap-1">
                <Ruler className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden /> {p.m2Construccion ?? p.m2Terreno} m²
              </span>
            )}
            {p.interesados > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 font-semibold text-brand-text">
                <Users className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden /> {p.interesados}
                <span className="sr-only">interesados</span>
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

/** 046 — Inventario (H1): tarjetas con foto y precio, filtros y alta rápida. */
export function PropiedadesClient() {
  const [items, setItems] = useState<PropertyListItem[] | null>(null);
  const [f, setF] = useState<Filtros>(VACIO);
  const [abiertos, setAbiertos] = useState(false);
  const [creando, setCreando] = useState(false);
  const qRef = useRef<HTMLInputElement>(null);

  const refetch = useCallback(async (filtros: Filtros, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) if (v) params.set(k, v);
    // El rango de precio exige moneda: sin ella no se manda.
    if (!filtros.currency) {
      params.delete("min");
      params.delete("max");
    }
    const res = await fetch(`/api/propiedades?${params}`, { signal }).catch(() => null);
    if (res?.ok) setItems(((await res.json()) as { properties: PropertyListItem[] }).properties);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => void refetch(f, ctrl.signal), f.q ? 250 : 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [f, refetch]);

  const set = (patch: Partial<Filtros>) => setF((prev) => ({ ...prev, ...patch }));
  const n = cuenta(f);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[17px] font-bold tracking-tight">Propiedades</h2>
          <Button size="sm" onClick={() => setCreando(true)}>
            <Plus className="mr-1 h-4 w-4" strokeWidth={2} />
            Nueva
          </Button>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-72 sm:flex-none">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={qRef}
              placeholder="Código, título o zona…"
              aria-label="Buscar propiedad"
              value={f.q}
              onChange={(e) => set({ q: e.target.value })}
              className="pl-8"
            />
          </div>
          <Button
            size="sm"
            variant={abiertos || n > 0 ? "secondary" : "outline"}
            onClick={() => setAbiertos((v) => !v)}
            aria-expanded={abiertos}
          >
            <SlidersHorizontal className="mr-1 h-4 w-4" strokeWidth={1.8} />
            Filtros{n > 0 ? ` · ${n}` : ""}
          </Button>
        </div>

        {abiertos && (
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <select aria-label="Operación" className={selectClass} value={f.operation} onChange={(e) => set({ operation: e.target.value })}>
              <option value="">Venta y alquiler</option>
              <option value="venta">Venta</option>
              <option value="alquiler">Alquiler</option>
            </select>
            <select aria-label="Estado" className={selectClass} value={f.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="activas">Activas</option>
              <option value="todas">Todos los estados</option>
              {PROPERTY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <select aria-label="Tipo" className={selectClass} value={f.type} onChange={(e) => set({ type: e.target.value })}>
              <option value="">Todo tipo</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <select aria-label="Cantón" className={selectClass} value={f.canton} onChange={(e) => set({ canton: e.target.value })}>
              <option value="">Todo el país</option>
              {CR_PROVINCIAS.map((p) => (
                <optgroup key={p} label={p}>
                  {(CR_CANTONES[p] as readonly string[]).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select aria-label="Moneda" className={selectClass} value={f.currency} onChange={(e) => set({ currency: e.target.value })}>
              <option value="">US$ y ₡</option>
              <option value="USD">Solo US$</option>
              <option value="CRC">Solo ₡</option>
            </select>
            <Input
              aria-label="Precio mínimo"
              inputMode="numeric"
              placeholder={f.currency ? "Mínimo" : "Mínimo (elige moneda)"}
              disabled={!f.currency}
              value={f.min}
              onChange={(e) => set({ min: e.target.value.replace(/[^\d]/g, "") })}
            />
            <Input
              aria-label="Precio máximo"
              inputMode="numeric"
              placeholder={f.currency ? "Máximo" : "Máximo (elige moneda)"}
              disabled={!f.currency}
              value={f.max}
              onChange={(e) => set({ max: e.target.value.replace(/[^\d]/g, "") })}
            />
            <Button size="sm" variant="ghost" className="h-9" onClick={() => setF({ ...VACIO, q: f.q })} disabled={n === 0}>
              Limpiar
            </Button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {items === null ? null : items.length === 0 ? (
          f.q || n > 0 ? (
            <EmptyState icon={Search} className="h-full" title="Sin resultados" description="Ninguna propiedad coincide con esos filtros." />
          ) : (
            <EmptyState
              icon={Building2}
              className="h-full"
              title="Sin propiedades todavía"
              description="Da de alta tu primera propiedad: con operación, tipo, precio y zona basta para empezar."
            />
          )
        ) : (
          <ul className={cn("grid gap-3 sm:gap-4", "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4")}>
            {items.map((p) => (
              <Card key={p.id} p={p} />
            ))}
          </ul>
        )}
      </div>

      {creando && <NuevaPropiedadDialog onCancel={() => setCreando(false)} />}
    </div>
  );
}
