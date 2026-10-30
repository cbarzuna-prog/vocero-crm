"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Divide, Trash2, UserPlus, Users } from "lucide-react";
import {
  partesIguales,
  porcentajeABp,
  repartir,
  ROL_LABELS,
  ROLES_COLABORACION,
  textoPorcentaje,
  type Participante,
  type RolColaboracion,
} from "@/lib/colaboracion";
import { formatPrecio, type PropertyCurrency } from "@/lib/propiedades";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Buscador, buscarContactos } from "@/components/propiedades/shared";

type Fila = Omit<Participante, "porcentajeBp"> & { pct: string };

const aFila = (p: Participante): Fila => ({ ...p, pct: String(p.porcentajeBp / 100).replace(".", ",") });

let equipoCache: Promise<{ userId: string; name: string }[]> | null = null;
function useEquipo() {
  const [equipo, setEquipo] = useState<{ userId: string; name: string }[]>([]);
  useEffect(() => {
    equipoCache ??= fetch("/api/settings/team")
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d: { members: { userId?: string; name: string }[] }) => d.members.flatMap((m) => (m.userId ? [{ userId: m.userId, name: m.name }] : [])))
      .catch(() => {
        equipoCache = null;
        return [];
      });
    void equipoCache.then(setEquipo);
  }, []);
  return equipo;
}

/**
 * 060 (fork) — Quién trajo y quién vende esta propiedad, y cómo se reparte la
 * comisión (70/30, 33/33/33…). Gente del equipo o co-corredores externos; lo
 * que no se reparte queda para la agencia. Se guarda aparte del resto de la
 * ficha, con su propio botón.
 */
export function ColaboracionPropiedad({
  propertyId,
  comisionCents,
  currency,
  comisionTexto,
}: {
  propertyId: string;
  comisionCents: number | null;
  currency: PropertyCurrency;
  comisionTexto: string | null;
}) {
  const equipo = useEquipo();
  const [guardadas, setGuardadas] = useState<Participante[] | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [agregando, setAgregando] = useState<null | "equipo" | "colaborador" | "nuevo">(null);
  const [nuevo, setNuevo] = useState({ nombre: "", telefono: "" });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/propiedades/${propertyId}/colaboracion`).catch(() => null);
    if (!res?.ok) return;
    const { participantes } = (await res.json()) as { participantes: Participante[] };
    setGuardadas(participantes);
    setFilas(participantes.map(aFila));
  }, [propertyId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const bps = filas.map((f) => porcentajeABp(f.pct));
  const invalida = bps.findIndex((b) => b === null);
  const suma = bps.reduce<number>((a, b) => a + (b ?? 0), 0);
  const { montos, agenciaBp, agenciaCents } = repartir(comisionCents, bps.map((b) => ({ porcentajeBp: b ?? 0 })));
  const sucio = guardadas !== null && JSON.stringify(filas.map((f) => [f.key, f.rol, porcentajeABp(f.pct)])) !== JSON.stringify(guardadas.map((g) => [g.key, g.rol, g.porcentajeBp]));
  const problema = invalida >= 0 ? `Revise el porcentaje de ${filas[invalida]?.nombre}` : suma > 10_000 ? `Los porcentajes suman ${textoPorcentaje(suma)}: no pueden pasar de 100 %` : null;

  function agregar(p: { userId?: string; contactId?: string; nombre: string }) {
    const key = p.userId ? `u:${p.userId}` : `c:${p.contactId}`;
    setAgregando(null);
    setOk(false);
    if (filas.some((f) => f.key === key)) {
      setError(`${p.nombre} ya está en el reparto`);
      return;
    }
    setError(null);
    const resto = Math.max(0, 10_000 - suma);
    setFilas([...filas, { key, userId: p.userId ?? null, contactId: p.contactId ?? null, nombre: p.nombre, externo: !p.userId, rol: "ambos", pct: String(resto / 100).replace(".", ",") }]);
  }

  async function crearColaborador() {
    setError(null);
    const res = await fetch("/api/colaboradores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nuevo),
    }).catch(() => null);
    const b = (await res?.json().catch(() => null)) as { contacto?: { id: string; name: string }; error?: { message?: string } } | null;
    if (!res?.ok || !b?.contacto) {
      setError(b?.error?.message ?? "No se pudo registrar. Intente de nuevo.");
      return;
    }
    setNuevo({ nombre: "", telefono: "" });
    agregar({ contactId: b.contacto.id, nombre: b.contacto.name });
  }

  async function guardar() {
    if (problema) return;
    setGuardando(true);
    setError(null);
    const res = await fetch(`/api/propiedades/${propertyId}/colaboracion`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantes: filas.map((f, i) => ({ userId: f.userId, contactId: f.contactId, rol: f.rol, porcentajeBp: bps[i] })) }),
    }).catch(() => null);
    setGuardando(false);
    if (!res?.ok) {
      const b = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(b?.error?.message ?? "No se pudo guardar el reparto. Intente de nuevo.");
      return;
    }
    const { participantes } = (await res.json()) as { participantes: Participante[] };
    setGuardadas(participantes);
    setFilas(participantes.map(aFila));
    setOk(true);
  }

  const dinero = (c: number | null) => (c === null ? null : formatPrecio(c, currency));

  return (
    <section aria-labelledby={`colab-${propertyId}`} className="mt-4 rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`colab-${propertyId}`} className="flex items-center gap-1.5 text-[13px] font-semibold">
          <Users className="h-3.5 w-3.5" aria-hidden /> Quién la trajo y quién la vende
        </h3>
        <p className="text-[12.5px] text-text-3">
          Comisión {comisionTexto ?? "sin definir"}
          {comisionCents !== null && ` · ${dinero(comisionCents)}`}
        </p>
      </div>

      {filas.length === 0 ? (
        <p className="mt-2 text-[13px] text-text-3">Nadie más participa: la comisión completa es de la agencia.</p>
      ) : (
        <ul className="mt-2 divide-y" aria-label="Reparto de la comisión">
          {filas.map((f, i) => (
            <li key={f.key} className="flex flex-wrap items-center gap-2 py-2">
              <span className="w-full min-w-0 text-sm sm:w-auto sm:flex-1">
                {f.contactId ? (
                  <Link href={`/contacts/${f.contactId}`} className="font-semibold hover:underline">
                    {f.nombre}
                  </Link>
                ) : (
                  <span className="font-semibold">{f.nombre}</span>
                )}
                <span className="ml-1.5 rounded bg-subtle px-1.5 py-0.5 text-[11px] font-semibold text-text-2">{f.externo ? "Colaborador" : "Equipo"}</span>
              </span>
              <select
                aria-label={`Papel de ${f.nombre}`}
                value={f.rol}
                onChange={(e) => {
                  setOk(false);
                  setFilas(filas.map((x, j) => (j === i ? { ...x, rol: e.target.value as RolColaboracion } : x)));
                }}
                className="h-9 rounded-md border bg-background px-2 text-[13px] [@media(pointer:coarse)]:h-11"
              >
                {ROLES_COLABORACION.map((r) => (
                  <option key={r} value={r}>
                    {ROL_LABELS[r]}
                  </option>
                ))}
              </select>
              <span className="flex items-center gap-1">
                <Input
                  aria-label={`Porcentaje de ${f.nombre}`}
                  inputMode="decimal"
                  className={cn("h-9 w-20 text-right [@media(pointer:coarse)]:h-11", bps[i] === null && "border-danger")}
                  value={f.pct}
                  onChange={(e) => {
                    setOk(false);
                    setFilas(filas.map((x, j) => (j === i ? { ...x, pct: e.target.value.replace(/[^\d.,]/g, "") } : x)));
                  }}
                />
                <span className="text-[13px] text-text-3">%</span>
              </span>
              <span className="ml-auto w-24 text-right text-[13px] tabular-nums text-text-2 sm:ml-0">{dinero(montos[i] ?? null) ?? "—"}</span>
              <button
                type="button"
                aria-label={`Quitar a ${f.nombre}`}
                onClick={() => {
                  setOk(false);
                  setFilas(filas.filter((_, j) => j !== i));
                }}
                className="rounded p-1.5 text-text-3 hover:bg-accent hover:text-foreground [@media(pointer:coarse)]:p-3"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
          <li className="flex items-center gap-2 py-2 text-[13px]">
            <span className="flex-1 text-text-2">Queda para la agencia</span>
            <span className={cn("tabular-nums", suma > 10_000 ? "text-danger-text" : "text-text-2")}>{textoPorcentaje(agenciaBp)}</span>
            <span className="w-24 text-right tabular-nums text-text-2">{dinero(agenciaCents) ?? "—"}</span>
            <span className="w-7 [@media(pointer:coarse)]:w-10" aria-hidden />
          </li>
        </ul>
      )}

      {agregando === "colaborador" && (
        <div className="mt-2">
          <Buscador placeholder="Buscar al colaborador en Contactos…" autoFocus fetchOptions={buscarContactos} onPick={(o) => agregar({ contactId: o.id, nombre: o.label })} />
          <button type="button" className="mt-1 text-[13px] font-semibold text-brand-text hover:underline" onClick={() => setAgregando("nuevo")}>
            No está: registrarlo
          </button>
        </div>
      )}
      {agregando === "nuevo" && (
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void crearColaborador();
          }}
        >
          <Input aria-label="Nombre del colaborador" placeholder="Nombre" className="min-w-40 flex-1" value={nuevo.nombre} maxLength={120} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} required />
          <Input aria-label="Teléfono del colaborador" placeholder="8888 8888" inputMode="tel" className="w-36" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} required />
          <Button type="submit" size="sm" variant="outline">
            Registrar y agregar
          </Button>
        </form>
      )}
      {agregando === "equipo" && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Elegir del equipo">
          {equipo.length === 0 && <p className="text-[13px] text-text-3">Cargando el equipo…</p>}
          {equipo.map((m) => (
            <button key={m.userId} type="button" onClick={() => agregar({ userId: m.userId, nombre: m.name })} className="min-h-9 rounded-full border px-3 text-[13px] font-semibold hover:border-foreground [@media(pointer:coarse)]:min-h-11">
              {m.name}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[13px] text-danger-text">
          {error}
        </p>
      )}
      {problema && !error && <p className="mt-2 text-[13px] text-danger-text">{problema}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setAgregando(agregando === "colaborador" || agregando === "nuevo" ? null : "colaborador")}>
          <UserPlus className="h-4 w-4" aria-hidden /> Colaborador externo
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAgregando(agregando === "equipo" ? null : "equipo")}>
          <UserPlus className="h-4 w-4" aria-hidden /> Del equipo
        </Button>
        {filas.length >= 2 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            title="Todos por igual, sin parte para la agencia"
            onClick={() => {
              setOk(false);
              const partes = partesIguales(filas.length);
              setFilas(filas.map((f, i) => ({ ...f, pct: String((partes[i] ?? 0) / 100).replace(".", ",") })));
            }}
          >
            <Divide className="h-4 w-4" aria-hidden /> Partes iguales
          </Button>
        )}
        <span className="ml-auto flex items-center gap-2">
          {ok && !sucio && <span className="text-[13px] text-success-text">Reparto guardado</span>}
          {sucio && (
            <Button type="button" size="sm" onClick={() => void guardar()} disabled={guardando || !!problema}>
              {guardando ? "Guardando…" : "Guardar reparto"}
            </Button>
          )}
        </span>
      </div>
    </section>
  );
}
