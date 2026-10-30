"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Buscador, buscarContactos, UbicacionFields } from "@/components/propiedades/shared";
import { Dialogo } from "./dialogo";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-full border px-3 text-[13px] font-semibold transition-colors [@media(pointer:coarse)]:min-h-11",
        active ? "border-brand bg-brand-tint text-brand-text" : "border-border-strong text-text-2 hover:border-foreground"
      )}
    >
      {children}
    </button>
  );
}

/**
 * 048 (fork) — Nueva captación: quién es el dueño y qué propiedad quiere
 * vender o alquilar. Lo demás (fotos, metros, descripción) se completa en la
 * ficha cuando la exclusiva esté firmada.
 */
export function NuevaCaptacionDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (r: { id: string }) => void }) {
  const [dueno, setDueno] = useState<{ id: string; name: string } | null>(null);
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [operation, setOperation] = useState<PropertyOperation>("venta");
  const [type, setType] = useState<PropertyType>("casa");
  const [precio, setPrecio] = useState("");
  const [currency, setCurrency] = useState<PropertyCurrency>("USD");
  const [ubic, setUbic] = useState<{ provincia: string; canton: string | null }>({ provincia: "San José", canton: "Escazú" });
  const [zona, setZona] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentado, setIntentado] = useState(false);

  const cents = precio.trim() ? parseMoneyToCents(precio) : null;
  const precioInvalido = precio.trim().length > 0 && cents === null;
  const digitos = telefono.replace(/\D/g, "");
  const errorDueno = !modoNuevo && !dueno ? "Busque al dueño o regístrelo como contacto nuevo" : null;
  const errorNombre = modoNuevo && !nombre.trim() ? "Escriba el nombre del dueño" : null;
  const errorTel = modoNuevo && (digitos.length === 8 ? !/^[2-8]/.test(digitos) : digitos.length < 10 || digitos.length > 15) ? "8 dígitos de Costa Rica, o el número con código de país" : null;

  async function save() {
    setIntentado(true);
    if (errorDueno || errorNombre || errorTel || precioInvalido) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/captaciones", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(modoNuevo ? { nombre: nombre.trim(), telefono } : { contactId: dueno!.id }),
        operation,
        type,
        priceCents: cents,
        currency,
        provincia: ubic.provincia,
        canton: ubic.canton,
        zona: zona.trim() || null,
        nota: nota.trim() || null,
      }),
    }).catch(() => null);
    if (!res?.ok) {
      setSaving(false);
      const b = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(b?.error?.message ?? "No se pudo guardar. Intente de nuevo.");
      return;
    }
    onCreated((await res.json()) as { id: string });
  }

  const err = (m: string | null) => (intentado && m ? <p className="mt-1 text-[13px] text-danger-text">{m}</p> : null);

  return (
    <Dialogo titulo="Nueva captación" descripcion="El dueño y la propiedad que quiere vender o alquilar. Entra en la etapa Contacto." onClose={onClose} className="p-4" ancho="sm:max-w-lg">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset>
          <legend className="text-[13px] font-medium">Dueño</legend>
          {modoNuevo ? (
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <Input aria-label="Nombre del dueño" placeholder="Nombre" value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} aria-invalid={intentado && !!errorNombre} />
              <Input aria-label="Teléfono del dueño" placeholder="8888 8888" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} aria-invalid={intentado && !!errorTel} />
            </div>
          ) : dueno ? (
            <p className="mt-1 flex h-9 items-center gap-2 text-sm">
              <span className="font-semibold">{dueno.name}</span>
              <button type="button" className="text-[13px] text-text-3 hover:text-foreground" onClick={() => setDueno(null)}>
                Cambiar
              </button>
            </p>
          ) : (
            <div className="mt-1">
              <Buscador placeholder="Buscar un contacto…" fetchOptions={buscarContactos} onPick={(o) => setDueno({ id: o.id, name: o.label })} />
            </div>
          )}
          {err(errorDueno ?? errorNombre ?? errorTel)}
          <button
            type="button"
            className="mt-1 text-[13px] font-semibold text-brand-text hover:underline"
            onClick={() => {
              setModoNuevo(!modoNuevo);
              setIntentado(false);
            }}
          >
            {modoNuevo ? "Elegir un contacto existente" : "Es alguien nuevo"}
          </button>
        </fieldset>

        <div className="mt-3 flex gap-1.5" role="radiogroup" aria-label="Operación">
          {PROPERTY_OPERATIONS.map((o) => (
            <Chip key={o} active={operation === o} onClick={() => setOperation(o)}>
              {OPERATION_LABELS[o]}
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo">
          {PROPERTY_TYPES.map((t) => (
            <Chip key={t} active={type === t} onClick={() => setType(t)}>
              {TYPE_LABELS[t]}
            </Chip>
          ))}
        </div>

        <label className="mt-3 block text-[13px] font-medium" htmlFor="capt-precio">
          Lo que pide {operation === "alquiler" ? "al mes" : ""} <span className="font-normal text-text-3">(opcional)</span>
        </label>
        <div className="mt-1 flex gap-2">
          <Input id="capt-precio" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder={currency === "USD" ? "450,000" : "185,000,000"} />
          <div className="flex shrink-0 rounded-md border p-0.5" role="radiogroup" aria-label="Moneda">
            {(["USD", "CRC"] as const).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={currency === c} onClick={() => setCurrency(c)} className={cn("rounded px-2.5 text-[13px] font-semibold", currency === c ? "bg-brand-tint text-brand-text" : "text-text-2")}>
                {c === "USD" ? "US$" : "₡"}
              </button>
            ))}
          </div>
        </div>
        <p className={cn("mt-1 text-[13px]", precioInvalido ? "text-danger-text" : "text-text-3")}>
          {precioInvalido
            ? "No reconozco ese número. Escríbalo como 450000 o 450,000"
            : cents !== null
              ? `${formatPrecio(cents, currency)} · comisión ${operation === "alquiler" ? "1 mes de renta" : "5 % (la puede cambiar al firmar)"}`
              : operation === "alquiler"
                ? "Comisión: 1 mes de renta."
                : "Comisión: 5 %, la puede cambiar al firmar."}
        </p>

        <div className="mt-3">
          <UbicacionFields provincia={ubic.provincia} canton={ubic.canton} onChange={setUbic} idPrefix="capt" />
        </div>
        <label className="mt-3 block text-[13px] font-medium" htmlFor="capt-zona">
          Zona o condominio <span className="font-normal text-text-3">(opcional)</span>
        </label>
        <Input id="capt-zona" className="mt-1" value={zona} maxLength={120} onChange={(e) => setZona(e.target.value)} placeholder="Valle del Sol" />
        <label className="mt-3 block text-[13px] font-medium" htmlFor="capt-nota">
          Nota interna <span className="font-normal text-text-3">(opcional)</span>
        </label>
        <Textarea id="capt-nota" className="mt-1" rows={2} maxLength={2000} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Quiere vender para comprar algo más pequeño en Santa Ana" />

        {error && (
          <p role="alert" className="mt-2 text-[13px] text-danger-text">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Crear captación"}
          </Button>
        </div>
      </form>
    </Dialogo>
  );
}
