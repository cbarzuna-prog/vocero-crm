"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import type { Campo, Momento } from "@/lib/plantillas/tipos";
import type { FichaDto, ValorFicha } from "@/server/plantillas/ficha";
import { cn } from "@/lib/utils";

/**
 * 068 (fork · Hiyou) — Los datos de la ficha que pide la plantilla del
 * negocio, agrupados por momento: al primer contacto, durante la venta y
 * «Más datos» (plegado). Cada dato se edita en su lugar y se guarda al salir.
 * Sin PLANTILLAS (o sin plantilla elegida) no pinta nada.
 */

const GRUPOS: { momento: Momento; titulo: string }[] = [
  { momento: "inicio", titulo: "Al primer contacto" },
  { momento: "venta", titulo: "Durante la venta" },
  { momento: "opcional", titulo: "Más datos" },
];

function mostrar(c: Campo, valores: Record<string, ValorFicha>): boolean {
  if (!c.mostrarSi) return true;
  return valores[c.mostrarSi.campo]?.valor === c.mostrarSi.igual;
}

function textoValor(c: Campo, v: unknown): string {
  if (v == null) return "";
  if (c.tipo === "si_no") return v ? "Sí" : "No";
  if (c.tipo === "lista_multiple" && Array.isArray(v)) return v.join(", ");
  if (c.tipo === "importe" && typeof v === "object") {
    const i = v as { cents: number; moneda: string };
    return `${i.moneda === "CRC" ? "₡" : "$"}${Math.round(i.cents / 100).toLocaleString("es-CR")}`;
  }
  if (c.tipo === "fecha" && typeof v === "string") return new Date(`${v}T12:00:00`).toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" });
  return String(v);
}

function Editor({ campo, valor, onGuardar }: { campo: Campo; valor: unknown; onGuardar: (v: unknown) => void }) {
  const id = `fv-${campo.clave}`;
  const base = "w-full rounded-md border border-border bg-background px-2.5 text-[14px] outline-none focus:border-foreground";
  if (campo.tipo === "lista")
    return (
      <select id={id} aria-label={campo.etiqueta} value={typeof valor === "string" ? valor : ""} onChange={(e) => onGuardar(e.target.value || null)} className={cn(base, "h-9")}>
        <option value="">—</option>
        {campo.opciones?.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  if (campo.tipo === "lista_multiple") {
    const sel = Array.isArray(valor) ? (valor as string[]) : [];
    return (
      <div role="group" aria-label={campo.etiqueta} className="flex flex-wrap gap-1.5">
        {campo.opciones?.map((o) => {
          const on = sel.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const nuevo = on ? sel.filter((x) => x !== o) : [...sel, o];
                onGuardar(nuevo.length ? nuevo : null);
              }}
              className={cn("rounded-full border px-2.5 py-1 text-[12.5px] [@media(pointer:coarse)]:min-h-11", on ? "border-foreground bg-foreground text-background" : "border-border")}
            >
              {o}
            </button>
          );
        })}
      </div>
    );
  }
  if (campo.tipo === "si_no")
    return (
      <div role="group" aria-label={campo.etiqueta} className="flex gap-1.5">
        {[true, false].map((b) => (
          <button key={String(b)} type="button" aria-pressed={valor === b} onClick={() => onGuardar(valor === b ? null : b)} className={cn("rounded-full border px-3 py-1 text-[12.5px]", valor === b ? "border-foreground bg-foreground text-background" : "border-border")}>
            {b ? "Sí" : "No"}
          </button>
        ))}
      </div>
    );
  if (campo.tipo === "texto_largo")
    return <TextoLibre id={id} etiqueta={campo.etiqueta} inicial={typeof valor === "string" ? valor : ""} largo onGuardar={onGuardar} />;
  if (campo.tipo === "fecha")
    return <input id={id} type="date" aria-label={campo.etiqueta} value={typeof valor === "string" ? valor : ""} onChange={(e) => onGuardar(e.target.value || null)} className={cn(base, "h-9")} />;
  if (campo.tipo === "numero")
    return <TextoLibre id={id} etiqueta={campo.etiqueta} inicial={typeof valor === "number" ? String(valor) : ""} numero onGuardar={onGuardar} />;
  if (campo.tipo === "importe") {
    const v = (valor as { cents: number; moneda: string } | null) ?? null;
    return (
      <TextoLibre
        id={id}
        etiqueta={campo.etiqueta}
        inicial={v ? String(Math.round(v.cents / 100)) : ""}
        numero
        onGuardar={(n) => onGuardar(n == null ? null : { cents: Math.round((n as number) * 100), moneda: v?.moneda ?? "CRC" })}
      />
    );
  }
  return <TextoLibre id={id} etiqueta={campo.etiqueta} inicial={typeof valor === "string" ? valor : ""} onGuardar={onGuardar} />;
}

function TextoLibre({ id, etiqueta, inicial, largo, numero, onGuardar }: { id: string; etiqueta: string; inicial: string; largo?: boolean; numero?: boolean; onGuardar: (v: unknown) => void }) {
  const [t, setT] = useState(inicial);
  useEffect(() => setT(inicial), [inicial]);
  const guardar = () => {
    if (t.trim() === inicial.trim()) return;
    if (!t.trim()) return onGuardar(null);
    if (numero) {
      const n = Number(t.replace(/[^\d.,-]/g, "").replace(",", "."));
      return onGuardar(Number.isFinite(n) ? n : null);
    }
    onGuardar(t.trim());
  };
  const cls = "w-full rounded-md border border-border bg-background px-2.5 text-[14px] outline-none focus:border-foreground";
  return largo ? (
    <textarea id={id} aria-label={etiqueta} rows={3} value={t} onChange={(e) => setT(e.target.value)} onBlur={guardar} className={cn(cls, "py-2")} />
  ) : (
    <input id={id} aria-label={etiqueta} inputMode={numero ? "decimal" : undefined} value={t} onChange={(e) => setT(e.target.value)} onBlur={guardar} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} className={cn(cls, "h-9")} />
  );
}

export function useFichaPlantilla(contactId: string, version = 0) {
  const [ficha, setFicha] = useState<FichaDto | null>(null);
  const cargar = useCallback(async () => {
    const r = await fetch(`/api/contactos/${contactId}/ficha-valores`, { cache: "no-store" }).catch(() => null);
    setFicha(r?.ok ? ((await r.json()) as FichaDto) : null);
  }, [contactId]);
  useEffect(() => {
    void cargar();
  }, [cargar, version]);
  return { ficha, recargar: cargar };
}

export function CamposFicha({ contactId, version = 0, onCambio }: { contactId: string; version?: number; onCambio?: () => void }) {
  const { ficha, recargar } = useFichaPlantilla(contactId, version);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!ficha || ficha.campos.length === 0) return null;

  async function guardar(clave: string, valor: unknown) {
    setError(null);
    const r = await fetch(`/api/contactos/${contactId}/ficha-valores`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campo: clave, valor }),
    }).catch(() => null);
    if (!r?.ok) {
      const j = (await r?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(j?.error?.message ?? "No se pudo guardar. Intente de nuevo.");
    }
    await recargar();
    onCambio?.();
  }

  return (
    <section aria-label="Ficha del negocio" className="space-y-4 p-4">
      {GRUPOS.map((g) => {
        const campos = ficha.campos.filter((c) => c.momento === g.momento && mostrar(c, ficha.valores));
        if (!campos.length) return null;
        const plegable = g.momento === "opcional";
        const llenos = campos.filter((c) => ficha.valores[c.clave] != null).length;
        return (
          <div key={g.momento}>
            {plegable ? (
              <button type="button" aria-expanded={abierto} onClick={() => setAbierto(!abierto)} className="kicker flex w-full items-center justify-between py-1">
                <span>
                  {g.titulo} <span className="font-normal normal-case text-text-3">({llenos} de {campos.length})</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", abierto && "rotate-180")} aria-hidden />
              </button>
            ) : (
              <p className="kicker mb-1">{g.titulo}</p>
            )}
            {(!plegable || abierto) && (
              <dl className="divide-y divide-border">
                {campos.map((c) => {
                  const v = ficha.valores[c.clave];
                  return (
                    <div key={c.clave} className="py-2">
                      <dt className="mb-1 flex items-center gap-1.5 text-[12px] text-text-3">
                        <label htmlFor={`fv-${c.clave}`}>{c.etiqueta}</label>
                        {v?.fuente === "ia" && (
                          <span title={v.porNombre ? `Lo sugirió la IA y lo confirmó ${v.porNombre}` : "Lo sugirió la IA"} className="inline-flex items-center gap-0.5 rounded-full bg-brand-tint px-1.5 text-[10.5px] font-semibold text-brand-text">
                            <Sparkles className="h-2.5 w-2.5" aria-hidden /> IA
                          </span>
                        )}
                      </dt>
                      <dd>
                        <Editor campo={c} valor={v?.valor ?? null} onGuardar={(nv) => void guardar(c.clave, nv)} />
                        <span className="sr-only">{textoValor(c, v?.valor)}</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </div>
        );
      })}
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-danger-text">
          {error}
        </p>
      )}
    </section>
  );
}
