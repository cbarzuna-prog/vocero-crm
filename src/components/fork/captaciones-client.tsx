"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CalendarClock, ExternalLink, KeyRound, MessageSquareText, Phone, Plus, XCircle } from "lucide-react";
import {
  CAPTACION_ETAPAS,
  COMISION_VENTA_BP,
  comisionEstimadaCents,
  diasHasta,
  ETAPA_AYUDA,
  ETAPA_LABELS,
  estadoVence,
  MESES_EXCLUSIVA,
  MOTIVO_LABELS,
  MOTIVOS_NO_CAPTADA,
  sumarMeses,
  textoComision,
  totalComisiones,
  type CaptacionTarjeta,
  type EtapaCaptacion,
  type MotivoNoCaptada,
} from "@/lib/captaciones";
import { diasDesde } from "@/lib/contactos";
import { formatPrecio, TYPE_LABELS } from "@/lib/propiedades";
import { telHref } from "@/lib/tareas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialogo } from "./dialogo";
import { NuevaCaptacionDialog } from "./nueva-captacion-dialog";

const ETAPA_KEY = "kk.captaciones.etapa";

/** Hoy en la zona de quien mira (el negocio está en Costa Rica). */
export function hoyLocal(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const fechaCorta = (dia: string) =>
  new Date(`${dia}T12:00:00`).toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" });

type Pendiente = { tarjeta: CaptacionTarjeta; etapa: "firmada" | "perdida" };

/**
 * 048 (fork) — Captaciones: el pipeline de vendedores. Cada tarjeta es la
 * propiedad que se quiere captar, con su dueño. Escritorio: columnas con
 * arrastrar y soltar. Celular: una etapa a la vez, con pestañas. Firmar la
 * exclusiva pide fechas y comisión; perderla pide el motivo.
 */
export function CaptacionesClient() {
  const [tarjetas, setTarjetas] = useState<CaptacionTarjeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nueva, setNueva] = useState(false);
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [etapaMovil, setEtapaMovil] = useState<EtapaCaptacion>("contacto");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const refetch = useCallback(async () => {
    const res = await fetch("/api/captaciones", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setError("No se pudieron cargar las captaciones. Recargue la página.");
      return;
    }
    setError(null);
    setTarjetas(((await res.json()) as { captaciones: CaptacionTarjeta[] }).captaciones);
  }, []);

  useEffect(() => {
    void refetch();
    try {
      const g = window.localStorage.getItem(ETAPA_KEY);
      if (g && (CAPTACION_ETAPAS as readonly string[]).includes(g)) setEtapaMovil(g as EtapaCaptacion);
    } catch {
      /* sin almacenamiento */
    }
  }, [refetch]);

  const porEtapa = useMemo(() => {
    const m = new Map<EtapaCaptacion, CaptacionTarjeta[]>(CAPTACION_ETAPAS.map((e) => [e, []]));
    for (const t of tarjetas ?? []) m.get(t.etapa)?.push(t);
    return m;
  }, [tarjetas]);

  async function mover(t: CaptacionTarjeta, etapa: EtapaCaptacion, extra: Record<string, unknown> = {}) {
    if (t.etapa === etapa && Object.keys(extra).length === 0) return;
    // Firmar y perder piden datos: primero el diálogo.
    if (Object.keys(extra).length === 0 && (etapa === "firmada" || etapa === "perdida")) {
      setPendiente({ tarjeta: t, etapa });
      return;
    }
    const antes = tarjetas;
    setTarjetas((xs) => xs?.map((x) => (x.id === t.id ? { ...x, etapa, desde: x.etapa === etapa ? x.desde : new Date().toISOString() } : x)) ?? null);
    const res = await fetch(`/api/captaciones/${t.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ etapa, ...extra }),
    }).catch(() => null);
    if (!res?.ok) {
      setTarjetas(antes);
      const b = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(b?.error?.message ?? "No se pudo mover. Intente de nuevo.");
      return;
    }
    void refetch();
  }

  function onDragEnd(e: DragEndEvent) {
    setArrastrando(null);
    const t = tarjetas?.find((x) => x.id === e.active.id);
    const etapa = e.over?.id as EtapaCaptacion | undefined;
    if (t && etapa && etapa !== t.etapa) void mover(t, etapa);
  }

  const abierta = tarjetas?.find((t) => t.id === abiertaId) ?? null;
  const activas = (tarjetas ?? []).filter((t) => t.etapa !== "perdida" && t.etapa !== "publicada");
  const porVencer = (tarjetas ?? []).filter((t) => t.exclusivaVence && t.etapa !== "perdida" && estadoVence(t.exclusivaVence, hoyLocal()) !== "vigente");

  function elegirEtapaMovil(e: EtapaCaptacion) {
    setEtapaMovil(e);
    try {
      window.localStorage.setItem(ETAPA_KEY, e);
    } catch {
      /* sin almacenamiento */
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight">Captaciones</h1>
          <p className="mt-0.5 text-[13px] text-text-2">
            {tarjetas === null
              ? "Cargando…"
              : `${activas.length} en proceso${porVencer.length ? ` · ${porVencer.length} exclusiva${porVencer.length === 1 ? "" : "s"} por renovar` : ""}`}
          </p>
        </div>
        <Button onClick={() => setNueva(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Nueva captación
        </Button>
      </header>

      {error && (
        <p role="alert" className="border-b bg-danger-tint px-4 py-2 text-[13px] text-danger-text sm:px-6">
          {error}
        </p>
      )}

      {tarjetas !== null && tarjetas.length === 0 ? (
        <div className="mx-auto mt-16 max-w-sm px-6 text-center">
          <KeyRound className="mx-auto h-8 w-8 text-text-3" aria-hidden />
          <p className="mt-3 font-semibold">Todavía no hay captaciones</p>
          <p className="mt-1 text-[13px] text-text-2">
            Cuando un dueño quiera vender o alquilar, regístrelo aquí y sígalo hasta firmar la exclusiva y publicar.
          </p>
          <Button className="mt-4" onClick={() => setNueva(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Nueva captación
          </Button>
        </div>
      ) : (
        <>
          {/* Celular: una etapa a la vez. */}
          <div className="flex min-h-0 flex-1 flex-col md:hidden">
            <div role="tablist" aria-label="Etapas" className="flex gap-1.5 overflow-x-auto border-b px-3 py-2">
              {CAPTACION_ETAPAS.map((e) => (
                <button
                  key={e}
                  type="button"
                  role="tab"
                  aria-selected={etapaMovil === e}
                  onClick={() => elegirEtapaMovil(e)}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold",
                    etapaMovil === e ? "border-brand bg-brand-tint text-brand-text" : "text-text-2"
                  )}
                >
                  {ETAPA_LABELS[e]}
                  <span className="tabular-nums text-text-3">{porEtapa.get(e)?.length ?? 0}</span>
                </button>
              ))}
            </div>
            <div role="tabpanel" aria-label={ETAPA_LABELS[etapaMovil]} className="flex-1 space-y-2 overflow-y-auto p-3 pb-24">
              <p className="text-[13px] text-text-3">{ETAPA_AYUDA[etapaMovil]}</p>
              <Totales tarjetas={porEtapa.get(etapaMovil) ?? []} />
              {(porEtapa.get(etapaMovil) ?? []).map((t) => (
                <button key={t.id} type="button" className="block w-full text-left" onClick={() => setAbiertaId(t.id)} aria-label={`Abrir la captación ${t.code}`}>
                  <Tarjeta t={t} />
                </button>
              ))}
              {tarjetas === null && <div className="h-28 animate-pulse rounded-md bg-subtle" aria-hidden />}
            </div>
          </div>

          {/* Escritorio: columnas. */}
          <div className="hidden flex-1 overflow-x-auto p-4 md:block">
            <DndContext sensors={sensors} onDragStart={(e) => setArrastrando(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setArrastrando(null)}>
              <div className="flex h-full gap-3">
                {CAPTACION_ETAPAS.map((e) => (
                  <Columna key={e} etapa={e} tarjetas={porEtapa.get(e) ?? []} cargando={tarjetas === null} onOpen={(t) => setAbiertaId(t.id)} />
                ))}
              </div>
              <DragOverlay>{arrastrando && tarjetas?.find((t) => t.id === arrastrando) ? <Tarjeta t={tarjetas.find((t) => t.id === arrastrando)!} overlay /> : null}</DragOverlay>
            </DndContext>
          </div>
        </>
      )}

      {abierta && (
        <Detalle
          t={abierta}
          onClose={() => setAbiertaId(null)}
          onMover={(etapa) => {
            if (etapa !== "firmada" && etapa !== "perdida") setAbiertaId(null);
            void mover(abierta, etapa);
          }}
          onRenovar={() => setPendiente({ tarjeta: abierta, etapa: "firmada" })}
        />
      )}
      {pendiente?.etapa === "firmada" && (
        <FirmarDialog
          t={pendiente.tarjeta}
          onClose={() => setPendiente(null)}
          onConfirm={(datos) => {
            const t = pendiente.tarjeta;
            setPendiente(null);
            setAbiertaId(null);
            void mover(t, "firmada", datos);
          }}
        />
      )}
      {pendiente?.etapa === "perdida" && (
        <PerdidaDialog
          t={pendiente.tarjeta}
          onClose={() => setPendiente(null)}
          onConfirm={(motivo) => {
            const t = pendiente.tarjeta;
            setPendiente(null);
            setAbiertaId(null);
            void mover(t, "perdida", { motivo });
          }}
        />
      )}
      {nueva && (
        <NuevaCaptacionDialog
          onClose={() => setNueva(false)}
          onCreated={() => {
            setNueva(false);
            elegirEtapaMovil("contacto");
            void refetch();
          }}
        />
      )}
    </div>
  );
}

function Totales({ tarjetas }: { tarjetas: CaptacionTarjeta[] }) {
  const t = totalComisiones(tarjetas);
  const partes = [t.USD ? formatPrecio(t.USD, "USD") : null, t.CRC ? formatPrecio(t.CRC, "CRC") : null].filter(Boolean);
  if (tarjetas.length === 0) return null;
  return (
    <p className="text-[12px] text-text-3">
      {partes.length ? (
        <>
          Comisión estimada <span className="font-semibold text-foreground tabular-nums">{partes.join(" + ")}</span>
          {t.sinDato ? ` · ${t.sinDato} sin precio` : ""}
        </>
      ) : (
        "Sin precios para estimar la comisión"
      )}
    </p>
  );
}

function Columna({ etapa, tarjetas, cargando, onOpen }: { etapa: EtapaCaptacion; tarjetas: CaptacionTarjeta[]; cargando: boolean; onOpen: (t: CaptacionTarjeta) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });
  const perdida = etapa === "perdida";
  // «No se captó» arranca plegada: es el cajón de lo que se cayó, no trabajo
  // del día, y así las cinco etapas vivas caben en una laptop sin deslizar.
  const [abierta, setAbierta] = useState(false);
  if (perdida && !abierta) {
    return (
      <section ref={setNodeRef} aria-label={ETAPA_LABELS[etapa]} className={cn("flex h-full w-12 shrink-0 flex-col items-center rounded-lg border border-border-strong bg-subtle py-2 transition-[box-shadow,border-color]", isOver && "border-brand ring-[3px] ring-brand-soft")}>
        <button type="button" onClick={() => setAbierta(true)} aria-expanded={false} aria-label={`Ver las que no se captaron (${tarjetas.length})`} className="flex flex-1 flex-col items-center gap-2 rounded px-1 py-1 text-text-3 hover:bg-background hover:text-foreground" title="Ver las que no se captaron">
          <XCircle className="h-4 w-4" aria-hidden />
          <span className="rounded-full border border-border-strong bg-background px-1.5 font-mono text-[12px]">{tarjetas.length}</span>
          <span className="text-[12.5px] font-bold [writing-mode:vertical-rl]">No se captó</span>
        </button>
      </section>
    );
  }
  return (
    <section
      ref={setNodeRef}
      aria-label={ETAPA_LABELS[etapa]}
      className={cn(
        "flex h-full shrink-0 flex-col rounded-lg border border-border-strong bg-subtle transition-[box-shadow,border-color]",
        perdida ? "w-56" : "min-w-[208px] flex-1 basis-0",
        isOver && "border-brand ring-[3px] ring-brand-soft"
      )}
    >
      <div className="px-3 pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-[13.5px] font-bold tracking-tight">
            {perdida && <XCircle className="h-3.5 w-3.5 text-text-3" aria-hidden />}
            {ETAPA_LABELS[etapa]}
          </h2>
          <span className="flex items-center gap-1">
            <span className="rounded-full border border-border-strong bg-background px-2 py-0.5 font-mono text-[12px] text-text-3">{tarjetas.length}</span>
            {perdida && (
              <button type="button" onClick={() => setAbierta(false)} aria-expanded className="rounded px-1 text-[12px] font-semibold text-text-3 hover:text-foreground">
                Plegar
              </button>
            )}
          </span>
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-text-3">{ETAPA_AYUDA[etapa]}</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {cargando && <div className="h-24 animate-pulse rounded-md bg-background" aria-hidden />}
        {tarjetas.map((t) => (
          <Arrastrable key={t.id} t={t} onOpen={onOpen} />
        ))}
      </div>
      {!perdida && (
        <div className="border-t px-3 py-2">
          <Totales tarjetas={tarjetas} />
          {tarjetas.length === 0 && <p className="text-[12px] text-text-3">Arrastre aquí</p>}
        </div>
      )}
    </section>
  );
}

function Arrastrable({ t, onOpen }: { t: CaptacionTarjeta; onOpen: (t: CaptacionTarjeta) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: t.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(t)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onOpen(t);
        }
      }}
      aria-label={`Abrir la captación ${t.code}`}
      className={cn("rounded-md", isDragging && "opacity-40")}
    >
      <Tarjeta t={t} />
    </div>
  );
}

function VenceBadge({ vence }: { vence: string }) {
  const hoy = hoyLocal();
  const estado = estadoVence(vence, hoy);
  const d = diasHasta(vence, hoy);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] font-semibold",
        estado === "vencida" ? "bg-danger-tint text-danger-text" : estado === "pronto" ? "bg-warning-tint text-warning-text" : "bg-subtle text-text-2"
      )}
      title={`La exclusiva vence el ${fechaCorta(vence)}`}
    >
      <CalendarClock className="h-3 w-3" aria-hidden />
      {estado === "vencida" ? `Exclusiva vencida hace ${-d} d` : estado === "pronto" ? `Vence en ${d} d` : `Vence ${fechaCorta(vence)}`}
    </span>
  );
}

function Tarjeta({ t, overlay = false }: { t: CaptacionTarjeta; overlay?: boolean }) {
  const precio = formatPrecio(t.priceCents, t.currency);
  const comision = comisionEstimadaCents(t);
  const dias = diasDesde(t.desde);
  return (
    <div className={cn("cursor-grab rounded-md border border-border-strong bg-card p-3 shadow-sm transition-shadow hover:shadow-md", overlay && "rotate-2 shadow-pop")}>
      <div className="flex gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto privada servida con sesión */}
        {t.coverUrl && <img src={t.coverUrl} alt="" className="h-11 w-11 shrink-0 rounded object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-text-3">
            <span className="font-mono">{t.code}</span> · {TYPE_LABELS[t.type]}
            {t.operation === "alquiler" ? " en alquiler" : ""}
          </p>
          <p className="truncate text-sm font-semibold">{t.title}</p>
          <p className="truncate text-[13px] text-text-2">{t.dueno ? t.dueno.name : <span className="text-warning-text">Sin dueño</span>}</p>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
        {precio ? (
          <span className="font-semibold tabular-nums">
            {precio}
            {t.operation === "alquiler" ? "/mes" : ""}
          </span>
        ) : (
          <span className="text-text-3">Sin precio</span>
        )}
        {comision !== null && <span className="text-text-3 tabular-nums">· comisión {formatPrecio(comision, t.currency)}</span>}
      </p>
      <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-text-3">
        {t.etapa === "perdida" ? (
          <span>{t.motivo ? MOTIVO_LABELS[t.motivo] : "No se captó"}</span>
        ) : (
          <span className={cn(dias >= 14 && t.etapa !== "publicada" && t.etapa !== "firmada" && "font-semibold text-warning-text")}>
            {dias === 0 ? "Desde hoy" : `${dias} d en la etapa`}
          </span>
        )}
        {t.exclusivaVence && t.etapa !== "perdida" && <VenceBadge vence={t.exclusivaVence} />}
      </p>
    </div>
  );
}

function Detalle({ t, onClose, onMover, onRenovar }: { t: CaptacionTarjeta; onClose: () => void; onMover: (e: EtapaCaptacion) => void; onRenovar: () => void }) {
  const tel = telHref(t.dueno?.phone ?? null);
  const comision = comisionEstimadaCents(t);
  const accion = "flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold hover:bg-accent sm:min-h-9";
  return (
    <Dialogo titulo={`${t.code} · ${t.title}`} descripcion={`${ETAPA_LABELS[t.etapa]} · ${TYPE_LABELS[t.type]} en ${t.operation}`} onClose={onClose} className="p-4" ancho="sm:max-w-lg">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        <dt className="text-text-3">Dueño</dt>
        <dd>
          {t.dueno ? (
            <Link href={`/contacts/${t.dueno.id}`} className="font-semibold hover:underline">
              {t.dueno.name}
            </Link>
          ) : (
            "Sin dueño (asígnelo en la ficha)"
          )}
        </dd>
        <dt className="text-text-3">Pide</dt>
        <dd className="tabular-nums">{formatPrecio(t.priceCents, t.currency) ?? "Sin precio todavía"}</dd>
        <dt className="text-text-3">Comisión</dt>
        <dd className="tabular-nums">
          {textoComision(t) ?? "Sin definir"}
          {comision !== null && <span className="text-text-3"> · {formatPrecio(comision, t.currency)}</span>}
        </dd>
        {t.exclusivaVence && (
          <>
            <dt className="text-text-3">Exclusiva</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <VenceBadge vence={t.exclusivaVence} />
              <button type="button" onClick={onRenovar} className="text-[13px] font-semibold text-brand-text hover:underline">
                Renovar o cambiar fechas
              </button>
            </dd>
          </>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {t.dueno && (
          <Link href={`/inbox?contact=${t.dueno.id}`} className={accion}>
            <MessageSquareText className="h-4 w-4" aria-hidden /> WhatsApp
          </Link>
        )}
        {tel && (
          <a href={tel} className={accion}>
            <Phone className="h-4 w-4" aria-hidden /> Llamar
          </a>
        )}
        <Link href={`/propiedades/${t.id}`} className={accion}>
          <ExternalLink className="h-4 w-4" aria-hidden /> Ficha completa
        </Link>
      </div>

      <fieldset className="mt-4">
        <legend className="kicker mb-2">Mover a</legend>
        <div className="flex flex-wrap gap-1.5">
          {CAPTACION_ETAPAS.map((e) => (
            <button
              key={e}
              type="button"
              disabled={e === t.etapa}
              onClick={() => onMover(e)}
              aria-current={e === t.etapa ? "step" : undefined}
              className={cn(
                "min-h-11 rounded-full border px-3 text-[13px] font-semibold sm:min-h-9",
                e === t.etapa ? "border-brand bg-brand-tint text-brand-text" : "text-text-2 hover:border-foreground",
                e === "perdida" && e !== t.etapa && "text-text-3"
              )}
            >
              {ETAPA_LABELS[e]}
            </button>
          ))}
        </div>
      </fieldset>
    </Dialogo>
  );
}

function FirmarDialog({ t, onClose, onConfirm }: { t: CaptacionTarjeta; onClose: () => void; onConfirm: (d: { firmadaEl: string; exclusivaVence: string; comisionBp?: number }) => void }) {
  const hoy = hoyLocal();
  const [firma, setFirma] = useState(hoy);
  const [vence, setVence] = useState(t.exclusivaVence ?? sumarMeses(hoy, MESES_EXCLUSIVA));
  const [tocado, setTocado] = useState(!!t.exclusivaVence);
  const [comision, setComision] = useState(String((t.comisionBp ?? COMISION_VENTA_BP) / 100));
  const venta = t.operation === "venta";
  const pct = Number(comision.replace(",", "."));
  const errorComision = venta && (comision.trim() === "" || Number.isNaN(pct) || pct < 0 || pct > 100) ? "La comisión va de 0 a 100 %" : null;
  const errorVence = !vence || vence <= firma ? "El vencimiento va después de la firma" : null;
  return (
    <Dialogo
      titulo={t.etapa === "firmada" ? "Exclusiva" : "Exclusiva firmada"}
      descripcion={`${t.code} · ${t.title}. 15 días antes del vencimiento le queda una tarea para renovarla.`}
      onClose={onClose}
      className="p-4"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (errorComision || errorVence) return;
          onConfirm({ firmadaEl: firma, exclusivaVence: vence, ...(venta ? { comisionBp: Math.round(pct * 100) } : {}) });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[13px] font-medium">
            Firmó el
            <Input
              type="date"
              className="mt-1"
              value={firma}
              onChange={(e) => {
                setFirma(e.target.value);
                if (!tocado && e.target.value) setVence(sumarMeses(e.target.value, MESES_EXCLUSIVA));
              }}
              required
            />
          </label>
          <label className="text-[13px] font-medium">
            Vence el
            <Input
              type="date"
              className="mt-1"
              value={vence}
              onChange={(e) => {
                setTocado(true);
                setVence(e.target.value);
              }}
              aria-invalid={!!errorVence}
              required
            />
          </label>
        </div>
        <p className={cn("mt-1 text-[13px]", errorVence ? "text-danger-text" : "text-text-3")}>{errorVence ?? `Por defecto, ${MESES_EXCLUSIVA} meses.`}</p>
        {venta ? (
          <label className="mt-3 block text-[13px] font-medium">
            Comisión sobre la venta (%)
            <Input inputMode="decimal" className="mt-1 w-28" value={comision} onChange={(e) => setComision(e.target.value.replace(/[^\d.,]/g, ""))} aria-invalid={!!errorComision} />
          </label>
        ) : (
          <p className="mt-3 text-[13px]">
            Comisión: <span className="font-semibold">1 mes de renta</span>
          </p>
        )}
        {errorComision && <p className="mt-1 text-[13px] text-danger-text">{errorComision}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Guardar</Button>
        </div>
      </form>
    </Dialogo>
  );
}

function PerdidaDialog({ t, onClose, onConfirm }: { t: CaptacionTarjeta; onClose: () => void; onConfirm: (m: MotivoNoCaptada) => void }) {
  const [motivo, setMotivo] = useState<MotivoNoCaptada | null>(null);
  return (
    <Dialogo titulo="¿Por qué no se captó?" descripcion={`${t.code} · ${t.title}. La propiedad queda como retirada; puede volver a moverla si el dueño regresa.`} onClose={onClose} className="p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (motivo) onConfirm(motivo);
        }}
      >
        <div role="radiogroup" aria-label="Motivo" className="space-y-1.5">
          {MOTIVOS_NO_CAPTADA.map((m) => (
            <label key={m} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-tint sm:min-h-9">
              <input type="radio" name="motivo" value={m} checked={motivo === m} onChange={() => setMotivo(m)} />
              {MOTIVO_LABELS[m]}
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!motivo}>
            Guardar
          </Button>
        </div>
      </form>
    </Dialogo>
  );
}
