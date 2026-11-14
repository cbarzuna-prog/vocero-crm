"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, Circle } from "lucide-react";
import type { CriterioDto } from "@/server/plantillas/criterio";
import { cn } from "@/lib/utils";

/**
 * 068 (fork · Hiyou) — Lo que falta para pasar a la siguiente etapa, como
 * lista de verificación. Cuando se cumple todo, ofrece «Pasar a …»: nunca
 * mueve solo. Va en la ficha y en el panel de la Bandeja.
 */
export function CriterioEtapa({ contactId, version = 0, onMovido, compacto }: { contactId: string; version?: number | string; onMovido?: () => void; compacto?: boolean }) {
  const [c, setC] = useState<CriterioDto>(null);
  const [moviendo, setMoviendo] = useState(false);
  const cargar = useCallback(async () => {
    const r = await fetch(`/api/contactos/${contactId}/criterio`, { cache: "no-store" }).catch(() => null);
    setC(r?.ok ? ((await r.json()) as { criterio: CriterioDto }).criterio : null);
  }, [contactId]);
  useEffect(() => {
    void cargar();
  }, [cargar, version]);
  const sig = c?.siguiente;
  if (!c || !sig || sig.requisitos.length === 0) return null;

  async function mover() {
    if (!c || !sig) return;
    setMoviendo(true);
    await fetch(`/api/pipeline/leads/${c.leadId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ stageId: sig.id }) }).catch(() => null);
    setMoviendo(false);
    await cargar();
    onMovido?.();
  }

  return (
    <section aria-label={`Para pasar a ${sig.nombre}`} className={cn("rounded-lg border p-3", sig.cumple ? "border-success/40 bg-success-tint" : "border-border bg-muted/40")}>
      <p className="text-[12.5px] font-semibold text-text-2">
        Para pasar a <b className="text-foreground">«{sig.nombre}»</b>
        {!compacto && sig.criterio ? <span className="font-normal text-text-3"> — {sig.criterio}</span> : null}
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {sig.requisitos.map((r) => (
          <li key={r.clave} className={cn("flex items-center gap-1 text-[12.5px]", r.cumplido ? "text-success-text" : "text-text-3")}>
            {r.cumplido ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}
            {r.etiqueta}
            <span className="sr-only">{r.cumplido ? "(listo)" : "(falta)"}</span>
          </li>
        ))}
      </ul>
      {sig.cumple && (
        <button
          type="button"
          onClick={() => void mover()}
          disabled={moviendo}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-[13px] font-semibold text-background disabled:opacity-60 [@media(pointer:coarse)]:min-h-11"
        >
          {moviendo ? "Moviendo…" : `Pasar a ${sig.nombre}`} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </section>
  );
}
