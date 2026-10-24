"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseMoneyToCents } from "@/lib/money";
import {
  formatPrecio,
  OPERATION_LABELS,
  PROPERTY_OPERATIONS,
  PROPERTY_TYPES,
  TYPE_LABELS,
  type PropertyCurrency,
  type PropertyOperation,
  type PropertyType,
} from "@/lib/propiedades";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UbicacionFields } from "./shared";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors",
        active ? "border-brand bg-brand-tint text-brand-text" : "border-border-strong text-text-2 hover:border-foreground"
      )}
    >
      {children}
    </button>
  );
}

/**
 * 046 — Alta rápida (D8): solo lo que hace falta para que la propiedad exista
 * y se pueda encontrar. Lo demás se completa en la ficha, que se abre al guardar.
 */
export function NuevaPropiedadDialog({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [operation, setOperation] = useState<PropertyOperation>("venta");
  const [type, setType] = useState<PropertyType>("casa");
  const [precio, setPrecio] = useState("");
  const [currency, setCurrency] = useState<PropertyCurrency>("USD");
  const [ubic, setUbic] = useState<{ provincia: string; canton: string | null }>({
    provincia: "San José",
    canton: "Escazú",
  });
  const [zona, setZona] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cents = precio.trim() ? parseMoneyToCents(precio) : null;
  const precioInvalido = precio.trim().length > 0 && cents === null;

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/propiedades", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operation,
        type,
        priceCents: cents,
        currency,
        provincia: ubic.provincia,
        canton: ubic.canton,
        zona: zona.trim() || null,
      }),
    }).catch(() => null);
    if (!res?.ok) {
      setSaving(false);
      const body = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "No se pudo guardar. Intente de nuevo.");
      return;
    }
    const { id } = (await res.json()) as { id: string };
    router.push(`/propiedades/${id}`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Nueva propiedad"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <form
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-pop sm:max-w-md sm:rounded-lg"
        onSubmit={(e) => {
          e.preventDefault();
          if (!precioInvalido) void save();
        }}
      >
        <h3 className="font-semibold">Nueva propiedad</h3>
        <p className="mt-0.5 text-[13px] text-text-3">Lo mínimo para darla de alta; el resto lo completa en su ficha.</p>

        <div className="mt-3 flex gap-1.5" role="radiogroup" aria-label="Operación">
          {PROPERTY_OPERATIONS.map((o) => (
            <Chip key={o} active={operation === o} onClick={() => setOperation(o)}>
              {OPERATION_LABELS[o]}
            </Chip>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo">
          {PROPERTY_TYPES.map((t) => (
            <Chip key={t} active={type === t} onClick={() => setType(t)}>
              {TYPE_LABELS[t]}
            </Chip>
          ))}
        </div>

        <label className="mt-3 block text-[13px] font-medium" htmlFor="prop-precio">
          Precio {operation === "alquiler" ? "mensual" : ""}
        </label>
        <div className="mt-1 flex gap-2">
          <Input
            id="prop-precio"
            inputMode="decimal"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder={currency === "USD" ? "450,000" : "185,000,000"}
          />
          <div className="flex shrink-0 rounded-md border p-0.5" role="radiogroup" aria-label="Moneda">
            {(["USD", "CRC"] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                onClick={() => setCurrency(c)}
                className={cn(
                  "rounded px-2.5 text-[13px] font-semibold",
                  currency === c ? "bg-brand-tint text-brand-text" : "text-text-2"
                )}
              >
                {c === "USD" ? "US$" : "₡"}
              </button>
            ))}
          </div>
        </div>
        <p className={cn("mt-1 text-[13px]", precioInvalido ? "text-danger-text" : "text-text-3")}>
          {precioInvalido
            ? "No reconozco ese número. Escríbalo como 450000 o 450,000"
            : cents !== null
              ? formatPrecio(cents, currency)
              : "Puede dejarlo vacío si aún no hay precio."}
        </p>

        <div className="mt-3">
          <UbicacionFields provincia={ubic.provincia} canton={ubic.canton} onChange={setUbic} idPrefix="nueva" />
        </div>

        <label className="mt-3 block text-[13px] font-medium" htmlFor="prop-zona">
          Zona o condominio <span className="font-normal text-text-3">(opcional)</span>
        </label>
        <Input
          id="prop-zona"
          value={zona}
          maxLength={120}
          onChange={(e) => setZona(e.target.value)}
          placeholder="Valle del Sol"
          className="mt-1"
        />

        {error && <p className="mt-2 text-[13px] text-danger-text">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || precioInvalido}>
            {saving ? "Guardando…" : "Guardar y completar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
