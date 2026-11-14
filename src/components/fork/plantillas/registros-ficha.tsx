"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import type { TipoRegistro } from "@/lib/plantillas/tipos";
import type { RegistroDto } from "@/server/plantillas/ficha";
import { cn } from "@/lib/utils";
import { Dialogo } from "../dialogo";
import { useFichaPlantilla } from "./campos-ficha";

/**
 * 068 (fork · Hiyou) — Lo que el cliente tiene varias veces (citas, pedidos…),
 * como tarjetas en su ficha: cada una con su estado, fecha e importe. Un
 * registro nuevo no pisa los anteriores (patrón de Shopify, Jobber, Clio).
 */

const fechaHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-CR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Sin fecha";
const dinero = (cents: number | null, moneda: string | null) =>
  cents == null ? "" : `${moneda === "USD" ? "$" : "₡"}${Math.round(cents / 100).toLocaleString("es-CR")}`;

function NuevoRegistro({ tipo, contactId, onClose, onCreado }: { tipo: TipoRegistro; contactId: string; onClose: () => void; onCreado: () => void }) {
  const [fecha, setFecha] = useState("");
  const [datos, setDatos] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    if (tipo.usaFecha && !fecha) return setError("Elija la fecha y la hora.");
    setGuardando(true);
    setError(null);
    const r = await fetch(`/api/contactos/${contactId}/registros`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tipo: tipo.clave, fecha: fecha ? new Date(fecha).toISOString() : null, datos }),
    }).catch(() => null);
    setGuardando(false);
    if (!r?.ok) {
      const j = (await r?.json().catch(() => null)) as { error?: { message?: string } } | null;
      return setError(j?.error?.message ?? "No se pudo guardar. Intente de nuevo.");
    }
    onCreado();
  }

  return (
    <Dialogo titulo={`Nueva ${tipo.singular.toLowerCase()}`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        {tipo.usaFecha && (
          <div className="space-y-1.5">
            <label htmlFor="nr-fecha" className="text-sm font-medium">
              Fecha y hora
            </label>
            <input id="nr-fecha" type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-2.5 text-sm" />
          </div>
        )}
        {tipo.campos
          .filter((c) => c.tipo === "lista" || c.tipo === "texto")
          .map((c) => (
            <div key={c.clave} className="space-y-1.5">
              <label htmlFor={`nr-${c.clave}`} className="text-sm font-medium">
                {c.etiqueta}
              </label>
              {c.tipo === "lista" ? (
                <select id={`nr-${c.clave}`} value={datos[c.clave] ?? ""} onChange={(e) => setDatos({ ...datos, [c.clave]: e.target.value })} className="h-10 w-full rounded-md border border-border bg-background px-2.5 text-sm">
                  <option value="">—</option>
                  {c.opciones?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input id={`nr-${c.clave}`} value={datos[c.clave] ?? ""} onChange={(e) => setDatos({ ...datos, [c.clave]: e.target.value })} className="h-10 w-full rounded-md border border-border bg-background px-2.5 text-sm" />
              )}
            </div>
          ))}
        {tipo.usaImporte && <p className="text-[12.5px] text-text-3">El precio sale del catálogo según el servicio; lo puede cambiar después.</p>}
        {error && (
          <p role="alert" className="text-[13px] font-semibold text-danger-text">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm font-semibold text-text-2 hover:bg-accent">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}

export function RegistrosFicha({ contactId, onCambio }: { contactId: string; onCambio?: () => void }) {
  const { ficha } = useFichaPlantilla(contactId);
  const [registros, setRegistros] = useState<RegistroDto[]>([]);
  const [nuevo, setNuevo] = useState<TipoRegistro | null>(null);
  const cargar = useCallback(async () => {
    const r = await fetch(`/api/contactos/${contactId}/registros`, { cache: "no-store" }).catch(() => null);
    if (r?.ok) setRegistros(((await r.json()) as { registros: RegistroDto[] }).registros);
  }, [contactId]);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  if (!ficha || ficha.tiposRegistro.length === 0) return null;

  async function cambiarEstado(id: string, estado: string) {
    await fetch(`/api/registros/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ estado }) }).catch(() => null);
    await cargar();
    onCambio?.();
  }

  return (
    <>
      {ficha.tiposRegistro.map((tipo) => {
        const lista = registros.filter((r) => r.tipo === tipo.clave);
        const activos = lista.filter((r) => !tipo.estados.find((e) => e.clave === r.estado)?.final).length;
        return (
          <section key={tipo.clave} aria-label={tipo.plural} className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="kicker">
                {tipo.plural} {lista.length > 0 && <span className="font-normal normal-case text-text-3">· {activos} por venir</span>}
              </p>
              <button type="button" onClick={() => setNuevo(tipo)} className="flex items-center gap-1 rounded px-1.5 py-1 text-[13px] font-semibold text-brand-text hover:bg-accent [@media(pointer:coarse)]:min-h-11">
                <CalendarPlus className="h-4 w-4" aria-hidden /> Nueva
              </button>
            </div>
            {lista.length === 0 ? (
              <p className="text-[13px] text-text-3">Todavía no tiene {tipo.plural.toLowerCase()}.</p>
            ) : (
              <ul className="space-y-2">
                {lista.slice(0, 6).map((r) => {
                  const estado = tipo.estados.find((e) => e.clave === r.estado);
                  return (
                    <li key={r.id} className={cn("rounded-md border border-border p-2.5", estado?.final && "opacity-75")}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-semibold">{r.titulo}</p>
                          <p className="text-[12px] text-text-3">
                            {fechaHora(r.fecha)}
                            {typeof r.datos.profesional === "string" && r.datos.profesional !== "Cualquiera" ? ` · ${r.datos.profesional}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-[12.5px] font-semibold tabular-nums">{dinero(r.importeCents, r.moneda)}</span>
                      </div>
                      <label className="mt-1.5 flex items-center gap-1.5 text-[12px] text-text-3">
                        <span className="sr-only">Estado de {r.titulo}</span>
                        <select
                          aria-label={`Estado de ${r.titulo}`}
                          value={r.estado}
                          onChange={(e) => void cambiarEstado(r.id, e.target.value)}
                          className="h-8 rounded-md border border-border bg-background px-1.5 text-[12.5px] font-semibold text-foreground"
                        >
                          {tipo.estados.map((e) => (
                            <option key={e.clave} value={e.clave}>
                              {e.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      {nuevo && (
        <NuevoRegistro
          tipo={nuevo}
          contactId={contactId}
          onClose={() => setNuevo(null)}
          onCreado={() => {
            setNuevo(null);
            void cargar();
            onCambio?.();
          }}
        />
      )}
    </>
  );
}
