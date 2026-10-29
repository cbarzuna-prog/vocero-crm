"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Sparkles, X } from "lucide-react";
import { CR_CANTONES, CR_PROVINCIAS } from "@/lib/cr-zonas";
import { parseMoneyToCents } from "@/lib/money";
import {
  FORMAS_PAGO,
  IDIOMA_LABELS,
  IDIOMAS,
  OPERACION_BUSCADA_LABELS,
  OPERACIONES_BUSCADAS,
  PAGO_LABELS,
  PLAZO_LABELS,
  PLAZOS,
  rangoPresupuesto,
  TIPO_CLIENTE_LABELS,
  TIPOS_CLIENTE,
  type CampoPerfil,
  type PerfilDto,
} from "@/lib/perfil-cliente";
import { PROPERTY_TYPES, TYPE_LABELS } from "@/lib/propiedades";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { selectClass } from "@/components/propiedades/shared";

const TODOS_LOS_CANTONES = CR_PROVINCIAS.flatMap((p) => CR_CANTONES[p] as readonly string[]);
const cents = (v: number | null) => (v === null ? "" : String(Math.round(v / 100)));
const lista = (xs: string[]) => xs.join(", ");

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[13px] font-semibold transition-colors [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:py-2",
        activo ? "border-brand bg-brand-tint text-brand-text" : "border-border-strong text-text-2 hover:border-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[13px] font-medium">{label}</p>
      {children}
    </div>
  );
}

/**
 * 055 (fork) — Ficha inmobiliaria del contacto: quién es y qué busca, con
 * campos fijos para poder filtrar y cruzar con propiedades. El agente la
 * llena al conversar (✦); lo que corrige una persona, el agente ya no lo pisa.
 * Se monta siempre y desaparece sola sin `PROPIEDADES` (la API da 404).
 */
export function PerfilCliente({
  contact,
  enlace = true,
}: {
  contact: { id: string; name: string };
  /** 057: en la Bandeja y el Pipeline, un enlace a la página completa del contacto. */
  enlace?: boolean;
}) {
  const [perfil, setPerfil] = useState<PerfilDto | null>(null);
  const [editando, setEditando] = useState(false);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/contacts/${contact.id}/perfil`).catch(() => null);
    setPerfil(res?.ok ? ((await res.json()) as { perfil: PerfilDto }).perfil : null);
  }, [contact.id]);

  useEffect(() => {
    setEditando(false);
    void refetch();
  }, [refetch]);

  if (!perfil) return null;

  const agente = (c: CampoPerfil) =>
    perfil.fuentes[c] === "agente" ? (
      <Sparkles className="ml-1 inline h-3 w-3 text-brand-text" aria-label="Lo anotó el agente" />
    ) : null;

  const busca = [
    perfil.operacion ? OPERACION_BUSCADA_LABELS[perfil.operacion] : null,
    perfil.tiposPropiedad.length ? lista(perfil.tiposPropiedad.map((t) => TYPE_LABELS[t])) : null,
    perfil.habitaciones !== null ? `${perfil.habitaciones}+ hab` : null,
  ].filter(Boolean);
  const vive = [perfil.viveDetalle ?? perfil.viveCanton, perfil.viveCanton ? perfil.viveProvincia : null].filter(Boolean);
  const filas: { k: string; v: React.ReactNode; c: CampoPerfil }[] = [];
  if (perfil.tiposCliente.length) filas.push({ k: "Es", v: lista(perfil.tiposCliente.map((t) => TIPO_CLIENTE_LABELS[t])), c: "tiposCliente" });
  if (busca.length) filas.push({ k: "Busca", v: busca.join(" · "), c: perfil.operacion ? "operacion" : "tiposPropiedad" });
  if (perfil.zonas.length) filas.push({ k: "Zonas", v: lista(perfil.zonas), c: "zonas" });
  const rango = rangoPresupuesto(perfil);
  if (rango) filas.push({ k: "Presupuesto", v: <span className="tabular-nums">{rango}</span>, c: "presupuesto" });
  if (perfil.plazo) filas.push({ k: "Para cuándo", v: PLAZO_LABELS[perfil.plazo], c: "plazo" });
  if (perfil.pago) filas.push({ k: "Pago", v: PAGO_LABELS[perfil.pago], c: "pago" });
  if (perfil.email)
    filas.push({ k: "Correo", v: <a className="text-brand-text hover:underline" href={`mailto:${perfil.email}`}>{perfil.email}</a>, c: "email" });
  if (perfil.telefono2)
    filas.push({ k: "Otro tel.", v: <a className="tabular-nums hover:underline" href={`tel:${perfil.telefono2.replace(/[^\d+]/g, "")}`}>{perfil.telefono2}</a>, c: "telefono2" });
  if (vive.length) filas.push({ k: "Vive en", v: vive.join(", "), c: "vive" });
  if (perfil.idioma) filas.push({ k: "Idioma", v: IDIOMA_LABELS[perfil.idioma], c: "idioma" });

  return (
    <section className="border-b p-4" aria-labelledby={`perfil-${contact.id}`}>
      <div className="mb-2 flex items-center justify-between">
        <p id={`perfil-${contact.id}`} className="kicker">
          Cliente
        </p>
        {!editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[13px] font-semibold text-text-2 hover:bg-accent hover:text-foreground [@media(pointer:coarse)]:min-h-11"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden /> {filas.length ? "Editar" : "Agregar datos"}
          </button>
        )}
      </div>

      {editando ? (
        <Editor
          contactId={contact.id}
          perfil={perfil}
          onCancel={() => setEditando(false)}
          onSaved={(p) => {
            setPerfil(p);
            setEditando(false);
          }}
        />
      ) : filas.length === 0 ? (
        <p className="text-[13px] text-text-3">
          Sin datos todavía. El agente los anota al conversar, o agréguelos usted: qué busca, presupuesto, zonas, correo…
        </p>
      ) : (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
          {filas.map((f) => (
            <div key={f.k} className="contents">
              <dt className="text-text-3">{f.k}</dt>
              <dd className="min-w-0 break-words">
                {f.v}
                {agente(f.c)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {enlace && !editando && (
        <a href={`/contacts/${contact.id}`} className="mt-3 inline-flex text-[13px] font-semibold text-brand-text hover:underline">
          Ver página completa →
        </a>
      )}
    </section>
  );
}

type Borrador = {
  email: string;
  telefono2: string;
  viveProvincia: string;
  viveCanton: string;
  viveDetalle: string;
  idioma: PerfilDto["idioma"];
  tiposCliente: PerfilDto["tiposCliente"];
  operacion: PerfilDto["operacion"];
  tiposPropiedad: PerfilDto["tiposPropiedad"];
  zonas: string[];
  min: string;
  max: string;
  moneda: PerfilDto["moneda"];
  habitaciones: string;
  plazo: PerfilDto["plazo"];
  pago: PerfilDto["pago"];
};

const aBorrador = (p: PerfilDto): Borrador => ({
  email: p.email ?? "",
  telefono2: p.telefono2 ?? "",
  viveProvincia: p.viveProvincia ?? "",
  viveCanton: p.viveCanton ?? "",
  viveDetalle: p.viveDetalle ?? "",
  idioma: p.idioma,
  tiposCliente: p.tiposCliente,
  operacion: p.operacion,
  tiposPropiedad: p.tiposPropiedad,
  zonas: p.zonas,
  min: cents(p.presupuestoMinCents),
  max: cents(p.presupuestoMaxCents),
  moneda: p.moneda,
  habitaciones: p.habitaciones === null ? "" : String(p.habitaciones),
  plazo: p.plazo,
  pago: p.pago,
});

const alternar = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

function Editor({
  contactId,
  perfil,
  onCancel,
  onSaved,
}: {
  contactId: string;
  perfil: PerfilDto;
  onCancel: () => void;
  onSaved: (p: PerfilDto) => void;
}) {
  const inicial = useMemo(() => aBorrador(perfil), [perfil]);
  const [b, setB] = useState<Borrador>(inicial);
  const [zona, setZona] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Borrador>) => setB((x) => ({ ...x, ...patch }));
  const cantones = (CR_CANTONES as Record<string, readonly string[]>)[b.viveProvincia] ?? [];

  const minC = b.min.trim() ? parseMoneyToCents(b.min) : null;
  const maxC = b.max.trim() ? parseMoneyToCents(b.max) : null;
  const montoMalo = (b.min.trim() && minC === null) || (b.max.trim() && maxC === null);

  function agregarZona() {
    const z = zona.trim();
    if (z && !b.zonas.includes(z) && b.zonas.length < 20) set({ zonas: [...b.zonas, z] });
    setZona("");
  }

  async function guardar() {
    setSaving(true);
    setError(null);
    const todo: Record<string, unknown> = {
      email: b.email,
      telefono2: b.telefono2,
      viveProvincia: b.viveProvincia || null,
      viveCanton: b.viveCanton,
      viveDetalle: b.viveDetalle,
      idioma: b.idioma,
      tiposCliente: b.tiposCliente,
      operacion: b.operacion,
      tiposPropiedad: b.tiposPropiedad,
      zonas: b.zonas,
      presupuestoMinCents: minC,
      presupuestoMaxCents: maxC,
      moneda: b.moneda,
      habitaciones: b.habitaciones.trim() ? Number(b.habitaciones) : null,
      plazo: b.plazo,
      pago: b.pago,
    };
    // Solo lo que cambió: así lo que no tocó sigue siendo del agente.
    const antes: Record<string, unknown> = {
      email: inicial.email,
      telefono2: inicial.telefono2,
      viveProvincia: inicial.viveProvincia || null,
      viveCanton: inicial.viveCanton,
      viveDetalle: inicial.viveDetalle,
      idioma: inicial.idioma,
      tiposCliente: inicial.tiposCliente,
      operacion: inicial.operacion,
      tiposPropiedad: inicial.tiposPropiedad,
      zonas: inicial.zonas,
      presupuestoMinCents: perfil.presupuestoMinCents,
      presupuestoMaxCents: perfil.presupuestoMaxCents,
      moneda: inicial.moneda,
      habitaciones: perfil.habitaciones,
      plazo: inicial.plazo,
      pago: inicial.pago,
    };
    const cambios = Object.fromEntries(Object.entries(todo).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(antes[k])));
    if (Object.keys(cambios).length === 0) {
      setSaving(false);
      return onCancel();
    }
    const res = await fetch(`/api/contacts/${contactId}/perfil`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cambios),
    }).catch(() => null);
    setSaving(false);
    const data = (await res?.json().catch(() => null)) as { perfil?: PerfilDto; error?: { message?: string } } | null;
    if (!res?.ok || !data?.perfil) return setError(data?.error?.message ?? "No se pudo guardar. Intente de nuevo.");
    onSaved(data.perfil);
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!montoMalo) void guardar();
      }}
    >
      <Campo label="Es">
        <div className="flex flex-wrap gap-1.5">
          {TIPOS_CLIENTE.map((t) => (
            <Chip key={t} activo={b.tiposCliente.includes(t)} onClick={() => set({ tiposCliente: alternar(b.tiposCliente, t) })}>
              {TIPO_CLIENTE_LABELS[t]}
            </Chip>
          ))}
        </div>
      </Campo>

      <Campo label="Quiere">
        <div className="flex flex-wrap gap-1.5">
          {OPERACIONES_BUSCADAS.map((o) => (
            <Chip key={o} activo={b.operacion === o} onClick={() => set({ operacion: b.operacion === o ? null : o })}>
              {OPERACION_BUSCADA_LABELS[o]}
            </Chip>
          ))}
        </div>
      </Campo>

      <Campo label="Tipo de propiedad">
        <div className="flex flex-wrap gap-1.5">
          {PROPERTY_TYPES.map((t) => (
            <Chip key={t} activo={b.tiposPropiedad.includes(t)} onClick={() => set({ tiposPropiedad: alternar(b.tiposPropiedad, t) })}>
              {TYPE_LABELS[t]}
            </Chip>
          ))}
        </div>
      </Campo>

      <Campo label="Zonas donde busca">
        {b.zonas.length > 0 && (
          <ul className="mb-1.5 flex flex-wrap gap-1.5">
            {b.zonas.map((z) => (
              <li key={z} className="flex items-center gap-1 rounded-full bg-subtle py-0.5 pl-2.5 pr-1 text-[13px]">
                {z}
                <button type="button" aria-label={`Quitar ${z}`} className="rounded-full p-0.5 hover:bg-accent" onClick={() => set({ zonas: b.zonas.filter((x) => x !== z) })}>
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            list={`zonas-${contactId}`}
            aria-label="Agregar zona"
            placeholder="Cantón, barrio o condominio"
            value={zona}
            onChange={(e) => setZona(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregarZona();
              }
            }}
          />
          <Button type="button" size="sm" variant="outline" className="h-auto" onClick={agregarZona} disabled={!zona.trim()}>
            Agregar
          </Button>
          <datalist id={`zonas-${contactId}`}>
            {TODOS_LOS_CANTONES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </Campo>

      <Campo label="Presupuesto">
        <div className="flex items-center gap-1.5">
          <Input aria-label="Presupuesto mínimo" inputMode="numeric" placeholder="Desde" value={b.min} onChange={(e) => set({ min: e.target.value })} />
          <span className="text-text-3">–</span>
          <Input aria-label="Presupuesto máximo" inputMode="numeric" placeholder="Hasta" value={b.max} onChange={(e) => set({ max: e.target.value })} />
          <div className="flex shrink-0 self-stretch rounded-md border p-0.5" role="radiogroup" aria-label="Moneda del presupuesto">
            {(["USD", "CRC"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={b.moneda === m}
                onClick={() => set({ moneda: m })}
                className={cn("rounded px-2 text-[13px] font-semibold", b.moneda === m ? "bg-brand-tint text-brand-text" : "text-text-2")}
              >
                {m === "USD" ? "US$" : "₡"}
              </button>
            ))}
          </div>
        </div>
        {montoMalo && <p className="text-[13px] text-danger-text">Escriba el monto en números, como 450000 o 450,000.</p>}
      </Campo>

      <div className="grid grid-cols-2 gap-2">
        <Campo label="Habitaciones (mín.)">
          <Input inputMode="numeric" aria-label="Habitaciones mínimas" value={b.habitaciones} onChange={(e) => set({ habitaciones: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
        </Campo>
        <Campo label="Para cuándo">
          <select aria-label="Para cuándo" className={cn(selectClass, "w-full")} value={b.plazo ?? ""} onChange={(e) => set({ plazo: (e.target.value || null) as Borrador["plazo"] })}>
            <option value="">—</option>
            {PLAZOS.map((p) => (
              <option key={p} value={p}>
                {PLAZO_LABELS[p]}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo label="Cómo paga">
        <div className="flex flex-wrap gap-1.5">
          {FORMAS_PAGO.map((p) => (
            <Chip key={p} activo={b.pago === p} onClick={() => set({ pago: b.pago === p ? null : p })}>
              {PAGO_LABELS[p]}
            </Chip>
          ))}
        </div>
      </Campo>

      <div className="space-y-2 border-t pt-3">
        <Campo label="Correo">
          <Input type="email" aria-label="Correo" value={b.email} onChange={(e) => set({ email: e.target.value })} />
        </Campo>
        <Campo label="Otro teléfono">
          <Input type="tel" aria-label="Otro teléfono" value={b.telefono2} onChange={(e) => set({ telefono2: e.target.value })} />
        </Campo>
        <Campo label="Vive en">
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Provincia donde vive" className={cn(selectClass, "w-full")} value={b.viveProvincia} onChange={(e) => set({ viveProvincia: e.target.value, viveCanton: "" })}>
              <option value="">Provincia</option>
              {CR_PROVINCIAS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select aria-label="Cantón donde vive" className={cn(selectClass, "w-full")} value={b.viveCanton} onChange={(e) => set({ viveCanton: e.target.value })} disabled={!b.viveProvincia}>
              <option value="">Cantón</option>
              {cantones.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <Input aria-label="Barrio o detalle" placeholder="Barrio o condominio (opcional)" className="mt-2" value={b.viveDetalle} onChange={(e) => set({ viveDetalle: e.target.value })} />
        </Campo>
        <Campo label="Idioma">
          <div className="flex flex-wrap gap-1.5">
            {IDIOMAS.map((i) => (
              <Chip key={i} activo={b.idioma === i} onClick={() => set({ idioma: b.idioma === i ? null : i })}>
                {IDIOMA_LABELS[i]}
              </Chip>
            ))}
          </div>
        </Campo>
      </div>

      {error && <p className="text-[13px] text-danger-text">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={saving || !!montoMalo}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
