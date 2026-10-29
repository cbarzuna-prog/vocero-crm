"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bath, BedDouble, Building2, LayoutGrid, List, Plus, Ruler, Search, SlidersHorizontal, Users } from "lucide-react";
import { CR_CANTONES, CR_PROVINCIAS } from "@/lib/cr-zonas";
import {
  formatPrecio,
  OPERATION_LABELS,
  ORDEN_LABELS,
  ORDENES,
  ordenarPropiedades,
  resumenPropiedades,
  type OrdenPropiedades,
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
    <li className="flex">
      <Link
        href={`/propiedades/${p.id}`}
        className="group flex w-full flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-[16/10] overflow-hidden sm:aspect-[4/3]">
          <Cover url={p.coverUrl} alt={p.title} className="transition-transform duration-300 group-hover:scale-[1.02]" />
          <div className="absolute left-2 top-2 flex gap-1">
            <StatusBadge status={p.status} />
          </div>
          <span className="absolute right-2 top-2 rounded-full border bg-background px-2 py-0.5 text-[12px] font-semibold">
            {OPERATION_LABELS[p.operation]}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-3">
          <p className="text-[17px] font-bold tracking-tight tabular-nums">
            {precio ?? <span className="text-text-3">Sin precio</span>}
            {precio && p.operation === "alquiler" && <span className="text-[13px] font-semibold text-text-3"> /mes</span>}
          </p>
          <p className="mt-0.5 truncate text-[14px] font-[620]">{p.title}</p>
          <p className="truncate text-[13px] text-text-3">
            {p.code} · {[p.zona, p.canton ?? p.provincia].filter(Boolean).join(", ")}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-[13px] text-text-2">
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

/** Habitaciones · baños · m², en texto corto para la lista. */
function medidas(p: PropertyListItem): string {
  return [
    p.habitaciones !== null ? `${p.habitaciones} hab` : null,
    p.banos !== null ? `${p.banos} ${p.banos === 1 ? "baño" : "baños"}` : null,
    (p.m2Construccion ?? p.m2Terreno) !== null ? `${p.m2Construccion ?? p.m2Terreno} m²` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** 051 — Renglón de la vista de lista: todo el inventario en una pasada. */
function Fila({ p }: { p: PropertyListItem }) {
  const precio = formatPrecio(p.priceCents, p.currency);
  return (
    <li>
      <Link
        href={`/propiedades/${p.id}`}
        className="flex items-center gap-3 px-3 py-2.5 hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4"
      >
        <div className="h-12 w-16 shrink-0 overflow-hidden rounded">
          <Cover url={p.coverUrl} alt="" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-[620]">{p.title}</p>
          <p className="truncate text-[13px] text-text-3">
            {p.code} · {[p.zona, p.canton ?? p.provincia].filter(Boolean).join(", ")}
            <span className="hidden md:inline">{medidas(p) ? ` · ${medidas(p)}` : ""}</span>
          </p>
        </div>
        <div className="hidden w-28 shrink-0 text-right sm:block">
          <StatusBadge status={p.status} />
        </div>
        <div className="hidden w-14 shrink-0 text-[13px] lg:block">
          {p.interesados > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-brand-text">
              <Users className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden /> {p.interesados}
              <span className="sr-only">interesados</span>
            </span>
          )}
        </div>
        <div className="shrink-0 text-right sm:w-40">
          <p className="text-[15px] font-bold tabular-nums">
            {precio ?? <span className="font-semibold text-text-3">Sin precio</span>}
            {precio && p.operation === "alquiler" && <span className="text-[12px] font-semibold text-text-3"> /mes</span>}
          </p>
          <p className="text-[12px] text-text-3 sm:hidden">{STATUS_LABELS[p.status]}</p>
          <p className="hidden text-[12px] text-text-3 sm:block">{OPERATION_LABELS[p.operation]}</p>
        </div>
      </Link>
    </li>
  );
}

type Vista = "cuadricula" | "lista";
const VISTA_KEY = "kk.propiedades.vista";
const ORDEN_KEY = "kk.propiedades.orden";

function leer<T extends string>(key: string, validos: readonly T[], def: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v && (validos as readonly string[]).includes(v) ? (v as T) : def;
  } catch {
    return def;
  }
}
function guardar(key: string, v: string) {
  try {
    window.localStorage.setItem(key, v);
  } catch {
    /* sin almacenamiento: la preferencia dura la visita */
  }
}

/** Mientras carga: la forma de lo que viene, no una pantalla en blanco. */
function Esqueleto({ vista }: { vista: Vista }) {
  return vista === "lista" ? (
    <ul className="divide-y rounded-lg border bg-card" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-2.5">
          <div className="h-12 w-16 animate-pulse rounded bg-subtle" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-subtle" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-subtle" />
          </div>
          <div className="h-4 w-20 animate-pulse rounded bg-subtle" />
        </li>
      ))}
    </ul>
  ) : (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3 sm:gap-4" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-lg border bg-card">
          <div className="aspect-[16/10] animate-pulse bg-subtle sm:aspect-[4/3]" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-1/3 animate-pulse rounded bg-subtle" />
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-subtle" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 046 — Inventario (H1): tarjetas con foto y precio, filtros y alta rápida. */
export function PropiedadesClient() {
  const [items, setItems] = useState<PropertyListItem[] | null>(null);
  const [f, setF] = useState<Filtros>(VACIO);
  const [abiertos, setAbiertos] = useState(false);
  const [creando, setCreando] = useState(false);
  const [vista, setVista] = useState<Vista>("cuadricula");
  const [orden, setOrden] = useState<OrdenPropiedades>("recientes");
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

  // Lo que eligió la última vez (solo en este navegador).
  useEffect(() => {
    setVista(leer(VISTA_KEY, ["cuadricula", "lista"] as const, "cuadricula"));
    setOrden(leer(ORDEN_KEY, ORDENES, "recientes"));
  }, []);

  const set = (patch: Partial<Filtros>) => setF((prev) => ({ ...prev, ...patch }));
  const n = cuenta(f);
  const visibles = items ? ordenarPropiedades(items, orden) : null;
  const resumen = items ? resumenPropiedades(items) : "";

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight">Propiedades</h1>
            {resumen && <p className="truncate text-[13px] text-text-2 tabular-nums">{resumen}</p>}
          </div>
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
            <SlidersHorizontal className="h-4 w-4 sm:mr-1" strokeWidth={1.8} aria-hidden />
            <span className="sr-only sm:not-sr-only">Filtros</span>
            {n > 0 ? <span className="ml-1 tabular-nums sm:ml-0">{` · ${n}`}</span> : null}
          </Button>
          <select
            aria-label="Ordenar"
            className={cn(selectClass, "hidden max-w-[11rem] sm:block")}
            value={orden}
            onChange={(e) => {
              const v = e.target.value as OrdenPropiedades;
              setOrden(v);
              guardar(ORDEN_KEY, v);
            }}
          >
            {ORDENES.map((o) => (
              <option key={o} value={o}>
                {ORDEN_LABELS[o]}
              </option>
            ))}
          </select>
          <div className="flex shrink-0 rounded-md border p-0.5" role="radiogroup" aria-label="Vista">
            {(
              [
                { v: "cuadricula", label: "Cuadrícula", Icon: LayoutGrid },
                { v: "lista", label: "Lista", Icon: List },
              ] as const
            ).map(({ v, label, Icon }) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={vista === v}
                aria-label={label}
                title={label}
                onClick={() => {
                  setVista(v);
                  guardar(VISTA_KEY, v);
                }}
                className={cn(
                  "flex h-8 w-9 items-center justify-center rounded [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10",
                  vista === v ? "bg-accent text-foreground" : "text-text-3 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              </button>
            ))}
          </div>
        </div>

        {abiertos && (
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <select
              aria-label="Ordenar (celular)"
              className={cn(selectClass, "col-span-2 sm:hidden")}
              value={orden}
              onChange={(e) => {
                const v = e.target.value as OrdenPropiedades;
                setOrden(v);
                guardar(ORDEN_KEY, v);
              }}
            >
              {ORDENES.map((o) => (
                <option key={o} value={o}>
                  Ordenar: {ORDEN_LABELS[o]}
                </option>
              ))}
            </select>
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
              placeholder={f.currency ? "Mínimo" : "Mínimo (elija moneda)"}
              disabled={!f.currency}
              value={f.min}
              onChange={(e) => set({ min: e.target.value.replace(/[^\d]/g, "") })}
            />
            <Input
              aria-label="Precio máximo"
              inputMode="numeric"
              placeholder={f.currency ? "Máximo" : "Máximo (elija moneda)"}
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
        {visibles === null ? (
          <Esqueleto vista={vista} />
        ) : visibles.length === 0 ? (
          f.q || n > 0 ? (
            <EmptyState icon={Search} className="h-full" title="Sin resultados" description="Ninguna propiedad coincide con esos filtros." />
          ) : (
            <EmptyState
              icon={Building2}
              className="h-full"
              title="Sin propiedades todavía"
              description="Dé de alta su primera propiedad: con operación, tipo, precio y zona basta para empezar."
            />
          )
        ) : vista === "lista" ? (
          <ul className="mx-auto max-w-6xl divide-y overflow-hidden rounded-lg border bg-card">
            {visibles.map((p) => (
              <Fila key={p.id} p={p} />
            ))}
          </ul>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3 sm:gap-4">
            {visibles.map((p) => (
              <Card key={p.id} p={p} />
            ))}
          </ul>
        )}
      </div>

      {creando && <NuevaPropiedadDialog onCancel={() => setCreando(false)} />}
    </div>
  );
}
