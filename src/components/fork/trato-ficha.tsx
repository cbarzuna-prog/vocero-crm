"use client";

import { useEffect, useState } from "react";
import type { AnuncioDto, PriorityValue } from "@/lib/types";
import { AnuncioOrigen } from "@/components/anuncio-origen";
import { formatMoneyCents, parseMoneyToCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriorityPicker } from "@/components/pipeline/priority-picker";

/**
 * 065 (fork) — Lo que antes solo estaba en el panel del trato de Compradores:
 * el monto y la prioridad. Ahora la tarjeta de Compradores abre la ficha del
 * contacto, así que la ficha los edita (mismo PATCH que el tablero).
 */
export function TratoFicha({
  leadId,
  amountCents,
  moneda,
  priority,
  onCambio,
}: {
  leadId: string;
  amountCents: number | null;
  moneda: string;
  priority: PriorityValue | null;
  onCambio: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const parseado = monto.trim() ? parseMoneyToCents(monto) : null;
  const invalido = monto.trim().length > 0 && parseado === null;

  async function guardar(datos: { amountCents?: number | null; priority?: PriorityValue | null }) {
    setError(null);
    const res = await fetch(`/api/pipeline/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(datos),
    }).catch(() => null);
    if (!res?.ok) setError("No se pudo guardar. Intente de nuevo.");
    onCambio();
  }

  return (
    <section aria-label="Trato" className="space-y-4 p-4">
      <div>
        <p className="kicker mb-1.5">Monto del trato ({moneda})</p>
        {editando ? (
          <>
            <Input
              autoFocus
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !invalido) {
                  setEditando(false);
                  void guardar({ amountCents: parseado });
                }
                if (e.key === "Escape") setEditando(false);
              }}
              placeholder="250,000"
              aria-label="Monto del trato"
              className="h-9 text-sm"
            />
            <p className="mt-1 text-xs text-text-3">
              {invalido ? "No se entiende ese monto." : parseado === null ? "Déjelo vacío para quitar el monto." : `Se guardará como ${formatMoneyCents(parseado, moneda)}`}
            </p>
            <div className="mt-2 flex gap-1.5">
              <Button
                size="sm"
                disabled={invalido}
                onClick={() => {
                  setEditando(false);
                  void guardar({ amountCents: parseado });
                }}
              >
                Guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMonto(amountCents === null ? "" : String(amountCents / 100));
              setEditando(true);
            }}
            aria-label="Editar el monto del trato"
            className={cn(
              "w-full rounded-md px-1.5 py-1 text-left tabular-nums hover:bg-accent [@media(pointer:coarse)]:min-h-11",
              amountCents === null ? "text-sm text-text-3" : "text-[20px] font-bold tracking-tight"
            )}
          >
            {amountCents === null ? "Sin monto — agréguelo" : formatMoneyCents(amountCents, moneda)}
          </button>
        )}
      </div>
      <div>
        <p className="kicker mb-1.5">Prioridad</p>
        <PriorityPicker value={priority} onChange={(v) => void guardar({ priority: v })} />
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-danger-text">
          {error}
        </p>
      )}
    </section>
  );
}

/** 065 — De qué anuncio llegó (lo mostraba el panel del trato; upstream: «siempre visible»). */
export function AnuncioDeContacto({ contactId }: { contactId: string }) {
  const [anuncio, setAnuncio] = useState<AnuncioDto | null>(null);
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/contacts/${contactId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { anuncio?: AnuncioDto | null } | null) => vivo && setAnuncio(d?.anuncio ?? null))
      .catch(() => null);
    return () => {
      vivo = false;
    };
  }, [contactId]);
  if (!anuncio) return null;
  return (
    <div className="p-4">
      <AnuncioOrigen anuncio={anuncio} />
    </div>
  );
}
