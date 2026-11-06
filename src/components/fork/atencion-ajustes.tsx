"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { CAPTACION_TIEMPOS, tiempoPorNombre, type ConfigAtencion, type Tiempo } from "@/lib/atencion";
import { ETAPA_LABELS } from "@/lib/captaciones";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EtapaDto = { id: string; name: string; kind: "open" | "won" | "lost"; tiempo: Tiempo | null; guardado: boolean };

const DIAS = [
  { n: 1, l: "L" },
  { n: 2, l: "K" },
  { n: 3, l: "M" },
  { n: 4, l: "J" },
  { n: 5, l: "V" },
  { n: 6, l: "S" },
  { n: 0, l: "D" },
];
const NOMBRE_DIA: Record<number, string> = { 0: "domingo", 1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábado" };

type Unidad = "min" | "h" | "d";
const aMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

/** Un umbral en minutos, editado como número + unidad (el «día» es un día de oficina). */
function Umbral({ etiqueta, minutos, minDia, onChange, invalido }: { etiqueta: string; minutos: number; minDia: number; onChange: (m: number) => void; invalido?: boolean }) {
  const unidadDe = (m: number): Unidad => (m >= minDia && m % minDia === 0 ? "d" : m >= 60 && m % 60 === 0 ? "h" : "min");
  const [unidad, setUnidad] = useState<Unidad>(unidadDe(minutos));
  const factor = unidad === "d" ? minDia : unidad === "h" ? 60 : 1;
  const [texto, setTexto] = useState(String(Math.round((minutos / factor) * 100) / 100));
  return (
    <span className="inline-flex items-center gap-1">
      <Input
        aria-label={etiqueta}
        inputMode="decimal"
        value={texto}
        aria-invalid={invalido}
        className={cn("h-9 w-16 text-right [@media(pointer:coarse)]:h-11", invalido && "!border-danger")}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,]/g, "");
          setTexto(t);
          const n = Number(t.replace(",", "."));
          if (t && !Number.isNaN(n) && n > 0) onChange(Math.max(1, Math.round(n * factor)));
        }}
      />
      <select
        aria-label={`Unidad: ${etiqueta}`}
        value={unidad}
        onChange={(e) => {
          const u = e.target.value as Unidad;
          const f = u === "d" ? minDia : u === "h" ? 60 : 1;
          setUnidad(u);
          const n = Number(texto.replace(",", "."));
          if (!Number.isNaN(n) && n > 0) onChange(Math.max(1, Math.round(n * f)));
        }}
        className="h-9 rounded-md border bg-background px-1.5 text-[13px] [@media(pointer:coarse)]:h-11"
      >
        <option value="min">min</option>
        <option value="h">h</option>
        <option value="d">días</option>
      </select>
    </span>
  );
}

function FilaTiempo({ nombre, t, minDia, onChange, onRestablecer, sugerido }: { nombre: string; t: Tiempo; minDia: number; onChange: (t: Tiempo) => void; onRestablecer?: () => void; sugerido: boolean }) {
  const invalido = t.rojoMin <= t.ambarMin;
  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-center">
      <span className="text-sm font-semibold">
        {nombre}
        {sugerido && <span className="ml-1.5 text-[12px] font-normal text-text-3">sugerido</span>}
      </span>
      <Input aria-label={`Qué hacer en ${nombre}`} value={t.accion} maxLength={160} onChange={(e) => onChange({ ...t, accion: e.target.value })} className="h-9 [@media(pointer:coarse)]:h-11" />
      <span className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-warning" aria-hidden />
          <Umbral etiqueta={`Ámbar en ${nombre}`} minutos={t.ambarMin} minDia={minDia} onChange={(m) => onChange({ ...t, ambarMin: m })} />
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-danger" aria-hidden />
          <Umbral etiqueta={`Rojo en ${nombre}`} minutos={t.rojoMin} minDia={minDia} onChange={(m) => onChange({ ...t, rojoMin: m })} invalido={invalido} />
        </span>
        {onRestablecer && (
          <button type="button" onClick={onRestablecer} className="rounded p-1.5 text-text-3 hover:bg-accent hover:text-foreground" aria-label={`Volver al sugerido en ${nombre}`} title="Volver al sugerido">
            <RotateCcw className="h-4 w-4" aria-hidden />
          </button>
        )}
      </span>
      {invalido && <span className="text-[13px] text-danger-text sm:col-span-3">El rojo tiene que ser mayor que el ámbar.</span>}
    </li>
  );
}

/**
 * 062 (fork) — Ajustes → Tiempos de atención: horario de oficina, el tiempo
 * para responder un mensaje y, por etapa, qué hacer y cuándo se pone ámbar y
 * rojo. Las etapas sin tiempo guardado usan el sugerido por su nombre.
 */
export function AtencionAjustes() {
  const [cfg, setCfg] = useState<ConfigAtencion | null>(null);
  const [etapas, setEtapas] = useState<EtapaDto[]>([]);
  const [estado, setEstado] = useState<"idle" | "guardando" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  /** Al restablecer un sugerido, la fila se vuelve a montar con sus valores. */
  const [reinicio, setReinicio] = useState(0);

  useEffect(() => {
    void fetch("/api/atencion/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { config: ConfigAtencion; etapas: EtapaDto[] } | null) => {
        if (!d) return;
        // Las etapas abiertas sin guardar se muestran con su sugerido.
        const etapasCfg = { ...d.config.etapas };
        for (const e of d.etapas) if (e.kind === "open" && e.tiempo && !etapasCfg[e.id]) etapasCfg[e.id] = e.tiempo;
        setCfg({ ...d.config, etapas: etapasCfg });
        setEtapas(d.etapas);
      });
  }, []);

  if (!cfg) return <div className="h-64 max-w-3xl animate-pulse rounded-lg bg-subtle" aria-busy="true" aria-label="Cargando" />;

  const minDia = Math.max(60, aMin(cfg.horario.hasta) - aMin(cfg.horario.desde));
  const set = (patch: Partial<ConfigAtencion>) => {
    setEstado("idle");
    setCfg({ ...cfg, ...patch });
  };
  const abiertas = etapas.filter((e) => e.kind === "open");
  const invalido =
    Object.values(cfg.etapas).some((t) => t.rojoMin <= t.ambarMin || !t.accion.trim()) ||
    Object.values(cfg.captaciones).some((t) => t.rojoMin <= t.ambarMin || !t.accion.trim()) ||
    cfg.mensaje.rojoMin <= cfg.mensaje.ambarMin ||
    aMin(cfg.horario.hasta) <= aMin(cfg.horario.desde) ||
    cfg.horario.dias.length === 0;

  async function guardar() {
    if (!cfg || invalido) return;
    setEstado("guardando");
    setError(null);
    // Solo las etapas que existen hoy (las borradas no se arrastran).
    const etapasVivas = Object.fromEntries(Object.entries(cfg.etapas).filter(([id]) => abiertas.some((e) => e.id === id)));
    const res = await fetch("/api/atencion/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...cfg, etapas: etapasVivas }),
    }).catch(() => null);
    if (!res?.ok) {
      const b = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setEstado("error");
      setError(b?.error?.message ?? "No se pudo guardar. Intente de nuevo.");
      return;
    }
    setEstado("ok");
  }

  return (
    <div className="max-w-4xl space-y-8 pb-24">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">Tiempos de atención</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-2">
          Cuánto puede esperar una persona en cada etapa antes de que su tarjeta se ponga <span className="font-semibold text-warning-text">ámbar</span> y luego{" "}
          <span className="font-semibold text-danger-text">roja</span>. El reloj corre solo en horario de oficina y se reinicia con cada contacto: un mensaje enviado, una
          tarea hecha o un cambio de etapa. Si hay una tarea agendada a futuro, la tarjeta no se pone roja.
        </p>
      </div>

      <section aria-labelledby="horario" className="space-y-3">
        <h2 id="horario" className="text-[15px] font-bold">
          Horario de oficina
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <div role="group" aria-label="Días de oficina" className="flex gap-1">
            {DIAS.map((d) => {
              const on = cfg.horario.dias.includes(d.n);
              return (
                <button
                  key={d.n}
                  type="button"
                  aria-pressed={on}
                  aria-label={NOMBRE_DIA[d.n]}
                  onClick={() => set({ horario: { ...cfg.horario, dias: on ? cfg.horario.dias.filter((x) => x !== d.n) : [...cfg.horario.dias, d.n] } })}
                  className={cn("h-9 w-9 rounded-full border text-[13px] font-semibold [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11", on ? "border-brand bg-brand text-brand-fg" : "text-text-2")}
                >
                  {d.l}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            De
            <Input type="time" className="h-9 w-28" value={cfg.horario.desde} onChange={(e) => set({ horario: { ...cfg.horario, desde: e.target.value } })} />
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            a
            <Input type="time" className="h-9 w-28" value={cfg.horario.hasta} onChange={(e) => set({ horario: { ...cfg.horario, hasta: e.target.value } })} />
          </label>
        </div>
        <p className="text-[13px] text-text-3">Un «día» en los tiempos de abajo es un día de oficina ({minDia / 60} h).</p>
      </section>

      <section aria-labelledby="mensaje" className="space-y-2">
        <h2 id="mensaje" className="text-[15px] font-bold">
          Mensaje sin responder
        </h2>
        <p className="text-[13px] text-text-2">Si la persona escribió y nadie le contestó (ni el agente), en cualquier etapa.</p>
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-warning" aria-hidden /> Ámbar a los
            <Umbral etiqueta="Ámbar de mensaje sin responder" minutos={cfg.mensaje.ambarMin} minDia={minDia} onChange={(m) => set({ mensaje: { ...cfg.mensaje, ambarMin: m } })} />
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-danger" aria-hidden /> Rojo a los
            <Umbral
              etiqueta="Rojo de mensaje sin responder"
              minutos={cfg.mensaje.rojoMin}
              minDia={minDia}
              invalido={cfg.mensaje.rojoMin <= cfg.mensaje.ambarMin}
              onChange={(m) => set({ mensaje: { ...cfg.mensaje, rojoMin: m } })}
            />
          </span>
        </div>
      </section>

      <section aria-labelledby="etapas-pipeline">
        <h2 id="etapas-pipeline" className="text-[15px] font-bold">
          Pipeline (compradores)
        </h2>
        <ul className="divide-y">
          {abiertas.map((e) => (
            <FilaTiempo
              key={`${e.id}-${reinicio}`}
              nombre={e.name}
              t={cfg.etapas[e.id] ?? tiempoPorNombre(e.name)}
              minDia={minDia}
              sugerido={!e.guardado}
              onChange={(t) => set({ etapas: { ...cfg.etapas, [e.id]: t } })}
              onRestablecer={() => {
                set({ etapas: { ...cfg.etapas, [e.id]: tiempoPorNombre(e.name) } });
                setReinicio((n) => n + 1);
              }}
            />
          ))}
        </ul>
        {etapas.some((e) => e.kind !== "open") && (
          <p className="mt-1 text-[13px] text-text-3">
            {etapas
              .filter((e) => e.kind !== "open")
              .map((e) => e.name)
              .join(" y ")}{" "}
            no tienen reloj: el trato ya terminó.
          </p>
        )}
      </section>

      <section aria-labelledby="etapas-captaciones">
        <h2 id="etapas-captaciones" className="text-[15px] font-bold">
          Captaciones (dueños)
        </h2>
        <ul className="divide-y">
          {(Object.keys(CAPTACION_TIEMPOS) as (keyof typeof CAPTACION_TIEMPOS)[]).map((k) => (
            <FilaTiempo
              key={`${k}-${reinicio}`}
              nombre={ETAPA_LABELS[k as keyof typeof ETAPA_LABELS]}
              t={cfg.captaciones[k] ?? CAPTACION_TIEMPOS[k]!}
              minDia={minDia}
              sugerido={false}
              onChange={(t) => set({ captaciones: { ...cfg.captaciones, [k]: t } })}
              onRestablecer={() => {
                set({ captaciones: { ...cfg.captaciones, [k]: CAPTACION_TIEMPOS[k]! } });
                setReinicio((n) => n + 1);
              }}
            />
          ))}
        </ul>
      </section>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {estado === "ok" && <span className="text-[13px] text-success-text">Guardado</span>}
        {error && (
          <span role="alert" className="text-[13px] text-danger-text">
            {error}
          </span>
        )}
        {invalido && <span className="text-[13px] text-danger-text">Revise los tiempos marcados</span>}
        <Button onClick={() => void guardar()} disabled={estado === "guardando" || invalido}>
          {estado === "guardando" ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
