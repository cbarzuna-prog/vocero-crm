"use client";

import { useEffect, useState } from "react";
import { Building2, Search } from "lucide-react";
import { CR_CANTONES, CR_PROVINCIAS } from "@/lib/cr-zonas";
import {
  DISCARD_LABELS,
  DISCARD_REASONS,
  INTEREST_LABELS,
  INTEREST_STATUSES,
  STATUS_LABELS,
  type DiscardReason,
  type InterestStatus,
  type PropertyListItem,
  type PropertyStatus,
} from "@/lib/propiedades";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Estilo de los <select> nativos: en el teléfono abren el selector del sistema. */
export const selectClass =
  "h-9 rounded-md border border-input bg-card px-2 text-sm [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:text-base focus-visible:border-brand focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft";

export function StatusBadge({ status }: { status: PropertyStatus }) {
  const variant =
    status === "disponible"
      ? "success"
      : status === "reservada" || status === "captacion"
        ? "warning"
        : "secondary";
  return <Badge variant={variant}>{STATUS_LABELS[status]}</Badge>;
}

export function Cover({ url, alt, className }: { url: string | null; alt: string; className?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- servida por /api/media con sesión
    <img src={url} alt={alt} loading="lazy" className={cn("h-full w-full object-cover", className)} />
  ) : (
    <div className={cn("flex h-full w-full items-center justify-center bg-subtle text-text-3", className)}>
      <Building2 className="h-8 w-8" strokeWidth={1.4} aria-hidden />
    </div>
  );
}

/** Provincia + cantón dependientes. */
export function UbicacionFields({
  provincia,
  canton,
  onChange,
  idPrefix = "ubic",
}: {
  provincia: string;
  canton: string | null;
  onChange: (v: { provincia: string; canton: string | null }) => void;
  idPrefix?: string;
}) {
  const cantones = (CR_CANTONES as Record<string, readonly string[]>)[provincia] ?? [];
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="block text-[13px] font-medium" htmlFor={`${idPrefix}-prov`}>
          Provincia
        </label>
        <select
          id={`${idPrefix}-prov`}
          className={cn(selectClass, "mt-1 w-full")}
          value={provincia}
          onChange={(e) => onChange({ provincia: e.target.value, canton: null })}
        >
          {CR_PROVINCIAS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[13px] font-medium" htmlFor={`${idPrefix}-canton`}>
          Cantón
        </label>
        <select
          id={`${idPrefix}-canton`}
          className={cn(selectClass, "mt-1 w-full")}
          value={canton ?? ""}
          onChange={(e) => onChange({ provincia, canton: e.target.value || null })}
        >
          <option value="">—</option>
          {cantones.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/**
 * Estado de un comprador con una propiedad. Descartar pide motivo (opcional)
 * antes de confirmar: es una salida, no un paso más.
 */
export function InteresEstado({
  status,
  onChange,
  label,
}: {
  status: InterestStatus;
  onChange: (status: InterestStatus, reason?: DiscardReason | null) => void;
  label: string;
}) {
  const [descartando, setDescartando] = useState(false);
  const [reason, setReason] = useState<DiscardReason | "">("");

  return (
    <div>
      <select
        aria-label={label}
        className={cn(
          selectClass,
          "h-8 text-[13px] font-semibold",
          status === "descartada" && "text-text-3",
          (status === "oferto" || status === "ganada") && "text-success-text"
        )}
        value={descartando ? "descartada" : status}
        onChange={(e) => {
          const next = e.target.value as InterestStatus;
          if (next === "descartada") setDescartando(true);
          else {
            setDescartando(false);
            onChange(next);
          }
        }}
      >
        {INTEREST_STATUSES.map((s) => (
          <option key={s} value={s}>
            {INTEREST_LABELS[s]}
          </option>
        ))}
      </select>
      {descartando && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            aria-label="Motivo del descarte"
            className={cn(selectClass, "h-8 text-[13px]")}
            value={reason}
            onChange={(e) => setReason(e.target.value as DiscardReason | "")}
          >
            <option value="">Motivo (opcional)</option>
            {DISCARD_REASONS.map((r) => (
              <option key={r} value={r}>
                {DISCARD_LABELS[r]}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              onChange("descartada", reason || null);
              setDescartando(false);
            }}
          >
            Descartar
          </Button>
          <button type="button" className="text-[13px] text-text-3 hover:text-foreground" onClick={() => setDescartando(false)}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

type Option = { id: string; label: string; sub?: string };

/** Buscador con lista desplegable: contactos o propiedades. */
export function Buscador({
  placeholder,
  fetchOptions,
  onPick,
  autoFocus,
}: {
  placeholder: string;
  fetchOptions: (q: string, signal: AbortSignal) => Promise<Option[]>;
  onPick: (o: Option) => void;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setOptions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetchOptions(q.trim(), ctrl.signal)
        .then(setOptions)
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, fetchOptions]);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="pl-8"
      />
      {options.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-pop">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-accent"
                onClick={() => {
                  onPick(o);
                  setQ("");
                  setOptions([]);
                }}
              >
                <span className="block text-sm">{o.label}</span>
                {o.sub && <span className="block text-[13px] text-text-3">{o.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function buscarContactos(q: string, signal: AbortSignal): Promise<Option[]> {
  const res = await fetch(`/api/contacts?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) return [];
  const d = (await res.json()) as { contacts: { id: string; name: string; phone: string | null }[] };
  return d.contacts.slice(0, 8).map((c) => ({ id: c.id, label: c.name, sub: c.phone ?? undefined }));
}

export async function buscarPropiedades(q: string, signal: AbortSignal): Promise<Option[]> {
  const res = await fetch(`/api/propiedades?status=todas&q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) return [];
  const d = (await res.json()) as { properties: PropertyListItem[] };
  return d.properties.slice(0, 8).map((p) => ({
    id: p.id,
    label: `${p.code} · ${p.title}`,
    sub: [p.canton ?? p.provincia, STATUS_LABELS[p.status]].join(" · "),
  }));
}
