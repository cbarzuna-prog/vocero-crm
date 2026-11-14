"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft, ArrowRightLeft, Building2, CheckCircle2, ExternalLink, Globe, Mail, MessageSquareText, Pencil, Phone, RefreshCw, Sparkles, SquareCheck, UserPlus } from "lucide-react";
import { diasDesde, origenDe, type ContactoDetalle, type EventoHistorial } from "@/lib/contactos";
import { TIPO_WEB_LABELS, type TipoWeb } from "@/lib/web-leads";
import { ROL_LABELS, textoPorcentaje } from "@/lib/colaboracion";
import { formatPrecio } from "@/lib/propiedades";
import { TIPO_CLIENTE_LABELS } from "@/lib/perfil-cliente";
import { textoEspera } from "@/lib/atencion";
import { LOSS_REASON_LABEL, type LossReason, type StageDto } from "@/lib/types";
import { telHref } from "@/lib/tareas";
import { cn, formatPhone } from "@/lib/utils";
import { ContactAvatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StartConversation } from "@/components/contacts/start-conversation";
import { PriorityBadge } from "@/components/pipeline/priority-picker";
import { PropiedadesContacto } from "@/components/propiedades/propiedades-contacto";
import { TareasContacto } from "@/components/tareas/tareas-contacto";
import { NuevaTareaDialog } from "@/components/tareas/nueva-tarea-dialog";
import { Dialogo } from "./dialogo";
import { EditarContactoDialog } from "./editar-contacto-dialog";
import { PerfilCliente } from "./perfil-cliente";
import { cuando } from "./contactos-client";
import { useAtencionDatos } from "./atencion";
import { AnuncioDeContacto, TratoFicha } from "./trato-ficha";
import { DatosContacto } from "./datos-contacto";
import { CamposFicha } from "./plantillas/campos-ficha";
import { RegistrosFicha } from "./plantillas/registros-ficha";

const ICONO: Record<EventoHistorial["tipo"], typeof Phone> = {
  alta: UserPlus,
  mensaje: MessageSquareText,
  etapa: ArrowRightLeft,
  propiedad: Building2,
  tarea: SquareCheck,
  tarea_hecha: CheckCircle2,
  web: Globe,
};

/** Tarjeta que envuelve las secciones del panel (que traen su propio borde inferior). */
function Tarjeta({ children, className }: { children: React.ReactNode; className?: string }) {
  // `empty:hidden`: mientras la sección carga (o sin su módulo) no queda una línea suelta.
  return <div className={cn("overflow-hidden rounded-xl bg-card shadow-sm empty:hidden [&>section]:border-b-0", className)}>{children}</div>;
}

const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function etiquetaDia(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  const t = d.toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Botón redondo de acción (como HubSpot): ícono arriba, palabra abajo. */
function Accion({ icono: Icono, texto, onClick, href, principal = false, title }: { icono: typeof Phone; texto: string; onClick?: () => void; href?: string; principal?: boolean; title?: string }) {
  const circulo = cn("flex h-11 w-11 items-center justify-center rounded-full transition-colors", principal ? "bg-brand text-brand-fg group-hover:bg-brand-hover" : "bg-muted text-brand-text group-hover:bg-accent");
  const contenido = (
    <>
      <span className={circulo}>
        <Icono className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="text-[12px] font-semibold">{texto}</span>
    </>
  );
  const clase = "group flex w-[3.75rem] shrink-0 flex-col items-center gap-1 rounded-md py-0.5 text-foreground sm:w-16";
  if (href)
    return (
      <a href={href} className={clase} title={title}>
        {contenido}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={clase} title={title}>
      {contenido}
    </button>
  );
}

/**
 * 063 (fork) — La barra de etapas de lado a lado (Bitrix): las pasadas en
 * azul, la actual en naranja con sus días, las que faltan en gris. Un clic
 * mueve el trato; perderlo pide el motivo.
 */
function BarraEtapas({ leadId, etapaId, dias, onMovido }: { leadId: string; etapaId: string; dias: number | null; onMovido: () => void }) {
  const [etapas, setEtapas] = useState<StageDto[]>([]);
  const [perdiendo, setPerdiendo] = useState<StageDto | null>(null);
  const [motivo, setMotivo] = useState<LossReason | null>(null);
  const [moviendo, setMoviendo] = useState(false);
  useEffect(() => {
    void fetch("/api/pipeline/board")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { stages: StageDto[] } | null) => d && setEtapas(d.stages));
  }, []);
  if (etapas.length === 0) return <div className="h-9 animate-pulse rounded-md bg-subtle" aria-hidden />;
  const actual = etapas.findIndex((e) => e.id === etapaId);

  async function mover(e: StageDto, lossReason?: LossReason) {
    setMoviendo(true);
    await fetch(`/api/pipeline/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stageId: e.id, position: 0, ...(lossReason ? { lossReason } : {}) }),
    }).catch(() => null);
    setMoviendo(false);
    setPerdiendo(null);
    onMovido();
  }

  return (
    <>
      <div role="group" aria-label="Etapa del trato" className="flex gap-[3px] overflow-x-auto pb-0.5">
        {etapas.map((e, i) => {
          const pasada = i < actual && e.kind === "open";
          const esActual = i === actual;
          const color = esActual
            ? e.kind === "won"
              ? "bg-success text-white"
              : e.kind === "lost"
                ? "bg-[var(--text-3)] text-white"
                : "bg-[#fd5d08] text-white"
            : pasada
              ? "bg-brand text-brand-fg"
              : e.kind === "won"
                ? "bg-success-tint text-success-text"
                : "bg-muted text-text-2";
          return (
            <button
              key={e.id}
              type="button"
              disabled={esActual || moviendo}
              aria-current={esActual ? "step" : undefined}
              onClick={() => (e.kind === "lost" ? setPerdiendo(e) : void mover(e))}
              title={esActual ? "Etapa actual" : `Mover a «${e.name}»`}
              className={cn("min-w-[7.5rem] flex-1 whitespace-nowrap px-4 py-2 text-[12.5px] font-semibold transition-opacity enabled:hover:opacity-85 disabled:cursor-default [@media(pointer:coarse)]:py-3", color)}
              style={{ clipPath: i === 0 ? "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)" : "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)" }}
            >
              {e.name}
              {esActual && e.kind === "open" && dias !== null ? ` · ${dias === 0 ? "hoy" : `${dias} d`}` : ""}
            </button>
          );
        })}
      </div>
      {perdiendo && (
        <Dialogo titulo={`¿Por qué se perdió?`} descripcion={`El trato pasa a «${perdiendo.name}».`} onClose={() => setPerdiendo(null)} className="p-4">
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              if (motivo) void mover(perdiendo, motivo);
            }}
          >
            <div role="radiogroup" aria-label="Motivo" className="space-y-1.5">
              {(Object.keys(LOSS_REASON_LABEL) as LossReason[]).map((m) => (
                <label key={m} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-tint sm:min-h-9">
                  <input type="radio" name="motivo" checked={motivo === m} onChange={() => setMotivo(m)} />
                  {LOSS_REASON_LABEL[m]}
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setPerdiendo(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!motivo || moviendo}>
                Guardar
              </Button>
            </div>
          </form>
        </Dialogo>
      )}
    </>
  );
}

type Resumen = { texto: string; siguientePaso: string | null; generadoAt: string } | null;

/** 063 — Resumen de la IA (Nea usa la misma llave): qué busca, qué pasó y qué espera. */
function ResumenIa({ contactId }: { contactId: string }) {
  const [r, setR] = useState<Resumen | undefined>(undefined);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void fetch(`/api/contactos/${contactId}/resumen`)
      .then((x) => (x.ok ? x.json() : { resumen: null }))
      .then((d: { resumen: Resumen }) => setR(d.resumen))
      .catch(() => setR(null));
  }, [contactId]);
  async function generar() {
    setCargando(true);
    setError(null);
    const res = await fetch(`/api/contactos/${contactId}/resumen`, { method: "POST" }).catch(() => null);
    const b = (await res?.json().catch(() => null)) as { resumen?: Resumen; error?: { message?: string } } | null;
    setCargando(false);
    if (!res?.ok || !b?.resumen) return setError(b?.error?.message ?? "No se pudo generar. Intente de nuevo.");
    setR(b.resumen);
  }
  if (r === undefined) return <div className="h-24 animate-pulse rounded-xl bg-card" aria-hidden />;
  return (
    <Tarjeta className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-brand-text">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Resumen
        </p>
        <button type="button" onClick={() => void generar()} disabled={cargando} className="flex items-center gap-1 rounded px-1.5 py-1 text-[12.5px] font-semibold text-text-2 hover:bg-accent disabled:opacity-60 [@media(pointer:coarse)]:min-h-11">
          <RefreshCw className={cn("h-3.5 w-3.5", cargando && "animate-spin")} aria-hidden />
          {cargando ? "Resumiendo…" : r ? "Actualizar" : "Resumir"}
        </button>
      </div>
      {r ? (
        <>
          <p className="mt-1.5 text-[14.5px] leading-relaxed">{r.texto}</p>
          <p className="mt-1.5 text-[12px] text-text-3">Escrito por la IA {cuando(r.generadoAt)} · revise antes de actuar</p>
        </>
      ) : (
        <p className="mt-1.5 text-[13.5px] text-text-2">Pídale a la IA un resumen de qué busca esta persona, qué ha pasado y qué está esperando.</p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] text-danger-text">
          {error}
        </p>
      )}
    </Tarjeta>
  );
}

/**
 * 057 + 063 (fork) — Todo de una persona en una página. Arriba: quién es, su
 * semáforo, los botones de lo que se le puede hacer y la barra de etapas. Al
 * centro: el resumen, el siguiente paso y una sola línea de tiempo (mensajes y
 * eventos). A los lados: su ficha y lo relacionado (tareas, propiedades, sitio).
 */
export function ContactoPagina({ id }: { id: string }) {
  const router = useRouter();
  const desdeCompradores = useSearchParams().get("desde") === "compradores";
  const [d, setD] = useState<ContactoDetalle | null | "no">(null);
  const [editando, setEditando] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const [nuevaTarea, setNuevaTarea] = useState(false);
  const [version, setVersion] = useState(0);
  const atencion = useAtencionDatos(version);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/contactos/${id}`).catch(() => null);
    if (res?.status === 404) return setD("no");
    if (res?.ok) setD((await res.json()) as ContactoDetalle);
    setVersion((v) => v + 1);
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const linea = useMemo(() => {
    if (!d || d === "no") return [];
    type Item = { en: string } & ({ k: "msg"; m: ContactoDetalle["mensajes"][number] } | { k: "ev"; e: EventoHistorial });
    const xs: Item[] = [
      ...d.mensajes.map((m) => ({ k: "msg" as const, en: m.en, m })),
      // El primer mensaje ya se ve como burbuja: no se repite como evento.
      ...d.historial.filter((e) => e.tipo !== "mensaje").map((e) => ({ k: "ev" as const, en: e.en, e })),
    ].sort((a, b) => b.en.localeCompare(a.en));
    const grupos: { dia: string; items: Item[] }[] = [];
    for (const x of xs) {
      const dia = etiquetaDia(x.en);
      const g = grupos[grupos.length - 1];
      if (g && g.dia === dia) g.items.push(x);
      else grupos.push({ dia, items: [x] });
    }
    return grupos;
  }, [d]);

  if (d === "no") {
    return (
      <div className="p-6">
        <p className="text-sm">Ese contacto no existe o ya no está.</p>
        <Link href="/contacts" className="mt-2 inline-block text-sm font-semibold text-brand-text hover:underline">
          Volver a Contactos
        </Link>
      </div>
    );
  }
  if (!d) return <div className="h-full animate-pulse bg-subtle/40" aria-busy="true" aria-label="Cargando contacto" />;

  const c = d.contacto;
  const p = d.perfil;
  const tel = telHref(c.phone);
  const dias = c.lead ? diasDesde(c.lead.desde) : null;
  const atn = c.lead ? (atencion?.leads[c.lead.id] ?? null) : null;
  const origen = origenDe(c);
  const busca = [
    p.tiposCliente.length ? p.tiposCliente.map((t) => TIPO_CLIENTE_LABELS[t]).join(", ") : null,
    p.zonas.length ? p.zonas.slice(0, 2).join(" o ") : null,
    p.presupuestoMaxCents ? `hasta ${formatPrecio(p.presupuestoMaxCents, p.moneda)}` : null,
  ].filter(Boolean);

  async function archivar() {
    await fetch(`/api/contacts/${c.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: !c.archivedAt }),
    }).catch(() => null);
    await refetch();
  }

  return (
    <div className="flex h-full flex-col bg-subtle">
      <header className="border-b bg-background px-4 py-3 sm:px-6 sm:py-4">
        {/* 065 — Si llegó desde la tarjeta de Compradores, vuelve allá. */}
        <Link href={desdeCompradores ? "/pipeline" : "/contacts"} className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-text-2 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {desdeCompradores ? "Compradores" : "Contactos"}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <ContactAvatar name={c.name} seed={c.id} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-bold leading-tight tracking-tight sm:text-[28px]">{c.name}</h1>
              {atn && atn.nivel !== "ok" && (
                <span className={cn("hidden items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12.5px] font-semibold sm:inline-flex", atn.nivel === "rojo" ? "border-danger bg-danger-tint text-danger-text" : "border-warning bg-warning-tint text-warning-text")}>
                  <span className={cn("h-2 w-2 rounded-full", atn.nivel === "rojo" ? "animate-pulse bg-danger" : "bg-warning")} aria-hidden />
                  {atn.accion} · {textoEspera(atn.minutos, atencion?.horario)}
                </span>
              )}
              {c.priority && <PriorityBadge value={c.priority} />}
              {c.aiPaused && <Badge variant="warning">Sin agente</Badge>}
              {c.archivedAt && <Badge variant="secondary">Archivado</Badge>}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13.5px] text-text-2">
              {busca.length > 0 && <span>{busca.join(" · ")}</span>}
              <span className="tabular-nums">{busca.length > 0 ? "· " : ""}{formatPhone(c.phone)}</span>
              {c.referidor ? (
                <span>
                  · Referido por{" "}
                  <Link href={`/contacts?referidor=${c.referidor.id}`} className="font-semibold text-foreground hover:underline">
                    {c.referidor.nombre}
                  </Link>
                </span>
              ) : (
                origen && <span>· {origen}</span>
              )}
              <span>· desde {new Date(c.createdAt).toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" })}</span>
            </p>
          </div>
          <nav aria-label="Acciones" className="-mx-1 flex w-full gap-0.5 overflow-x-auto px-1 sm:w-auto sm:gap-1">
            {c.conversationId ? (
              <Accion icono={MessageSquareText} texto="WhatsApp" href={`/inbox?contact=${c.id}`} principal />
            ) : (
              <Accion icono={MessageSquareText} texto="Escribir" onClick={() => setEscribiendo(true)} principal title="Escribir primero por WhatsApp" />
            )}
            {tel && <Accion icono={Phone} texto="Llamar" href={tel} />}
            {p.email && <Accion icono={Mail} texto="Correo" href={`mailto:${p.email}`} title={p.email} />}
            <Accion icono={SquareCheck} texto="Tarea" onClick={() => setNuevaTarea(true)} />
            <Accion icono={Pencil} texto="Editar" onClick={() => setEditando(true)} />
            <Accion icono={c.archivedAt ? ArchiveRestore : Archive} texto={c.archivedAt ? "Restaurar" : "Archivar"} onClick={() => void archivar()} title={c.archivedAt ? "Volver a la lista" : "Sacarlo de la lista sin borrarlo"} />
          </nav>
        </div>
        {c.lead && (
          <div className="mt-3">
            <BarraEtapas leadId={c.lead.id} etapaId={c.lead.stageId} dias={dias} onMovido={() => void refetch()} />
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24">
        <div className="mx-auto grid max-w-[90rem] gap-4 lg:grid-cols-[300px_minmax(0,1fr)_340px] lg:gap-5">
          {/* Centro (primero en el celular): resumen, siguiente paso y la historia. */}
          <div className="order-1 space-y-4 lg:order-2">
            <ResumenIa contactId={c.id} />

            {atn && (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3",
                  atn.nivel === "rojo" ? "border-danger/40 bg-danger-tint" : atn.nivel === "ambar" || atn.motivo === "etapa" ? "border-warning/50 bg-warning-tint" : "bg-card"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">{atn.motivo === "agendado" ? `Siguiente paso: ${atn.accion}` : atn.motivo === "etapa" && atn.nivel === "ok" ? "Sin siguiente paso agendado" : atn.accion}</p>
                  <p className="text-[12.5px] text-text-2">
                    {atn.nivel === "ok"
                      ? atn.motivo === "agendado"
                        ? "Está al día."
                        : `${c.lead?.stageName}: ${atn.accion.toLowerCase()}.`
                      : `Esperando ${textoEspera(atn.minutos, atencion?.horario)} en horario de oficina.`}
                  </p>
                </div>
                {(atn.motivo === "mensaje" || atn.motivo === "etapa") && (
                  <Button size="sm" onClick={() => (atn.motivo === "mensaje" && c.conversationId ? router.push(`/inbox?contact=${c.id}`) : setNuevaTarea(true))}>
                    {atn.motivo === "mensaje" ? "Responder" : "Agendar"}
                  </Button>
                )}
              </div>
            )}

            <Tarjeta className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[15px] font-bold">Actividad</p>
                {c.conversationId && (
                  <Link href={`/inbox?contact=${c.id}`} className="text-[13px] font-semibold text-brand-text hover:underline">
                    Abrir la conversación
                  </Link>
                )}
              </div>
              {linea.length === 0 ? (
                <p className="text-[13px] text-text-3">Todavía no hay actividad.</p>
              ) : (
                <div className="space-y-3">
                  {linea.map((g) => (
                    <section key={g.dia} aria-label={g.dia}>
                      <p className="mb-1.5 text-center text-[12px] font-semibold text-text-3">{g.dia}</p>
                      <ol className="space-y-2">
                        {g.items.map((x, i) =>
                          x.k === "msg" ? (
                            <li key={`m${x.m.id}`} className={cn("flex", x.m.direction === "out" ? "justify-end" : "justify-start")}>
                              <span
                                className={cn(
                                  "max-w-[85%] rounded-2xl px-3 py-2 text-[14px] leading-snug",
                                  x.m.direction === "out" ? "rounded-br-md bg-[var(--bubble-out)] text-[var(--bubble-out-text)]" : "rounded-bl-md bg-[var(--bubble-in)]"
                                )}
                              >
                                {x.m.text ?? <span className="italic text-text-3">[{x.m.type}]</span>}
                                <span className="mt-0.5 block text-right text-[11px] text-text-3">
                                  {x.m.deAgente ? "Agente · " : ""}
                                  {hora(x.en)}
                                </span>
                              </span>
                            </li>
                          ) : (
                            <li key={`e${i}${x.en}`} className="flex items-center gap-2.5 text-[13px] text-text-2">
                              {(() => {
                                const Icono = ICONO[x.e.tipo];
                                return <Icono className="h-4 w-4 shrink-0 text-text-3" aria-hidden />;
                              })()}
                              <span className="min-w-0 flex-1">
                                {x.e.texto}
                                {x.e.quien === "agente" && <Sparkles className="ml-1 inline h-3 w-3 text-brand-text" aria-label="Lo hizo el agente" />}
                              </span>
                              <time className="shrink-0 tabular-nums text-text-3" dateTime={x.en}>
                                {hora(x.en)}
                              </time>
                            </li>
                          )
                        )}
                      </ol>
                    </section>
                  ))}
                </div>
              )}
            </Tarjeta>
          </div>

          {/* Derecha: tareas, propiedades y lo que llegó del sitio. */}
          <aside className="order-2 space-y-4 lg:order-3">
            {/* 068 — Citas, pedidos… (registros vinculados de la plantilla). */}
            <Tarjeta>
              <RegistrosFicha contactId={c.id} onCambio={() => void refetch()} />
            </Tarjeta>
            <Tarjeta>
              <AnuncioDeContacto contactId={c.id} />
            </Tarjeta>
            <Tarjeta>
              <TareasContacto key={version} contact={c} />
            </Tarjeta>
            <Tarjeta>
              <PropiedadesContacto contact={c} />
            </Tarjeta>
            {d.solicitudesWeb.length > 0 && (
              <Tarjeta className="p-4">
                <p className="kicker mb-2">Del sitio web</p>
                <ol className="divide-y" aria-label="Formularios del sitio web">
                  {d.solicitudesWeb.map((w) => (
                    <li key={w.id} className="py-2.5 first:pt-0 last:pb-0">
                      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
                        <span className="font-semibold">{TIPO_WEB_LABELS[w.tipo as TipoWeb] ?? "Formulario"}</span>
                        <time className="tabular-nums text-text-3" dateTime={w.en} title={new Date(w.en).toLocaleString("es-CR")}>
                          {cuando(w.en)}
                        </time>
                      </p>
                      {(w.propiedad || w.propiedadTitulo || w.referidor) && (
                        <p className="mt-0.5 text-[13px] text-text-2">
                          {w.propiedad ? (
                            <Link href={`/propiedades/${w.propiedad.id}`} className="font-semibold text-foreground hover:underline">
                              {w.propiedad.code} · {w.propiedad.title}
                            </Link>
                          ) : (
                            w.propiedadTitulo
                          )}
                          {w.referidor && <span>{w.propiedad || w.propiedadTitulo ? " · " : ""}Referido por {w.referidor}</span>}
                        </p>
                      )}
                      {w.mensaje && <p className="mt-1 whitespace-pre-wrap border-l-2 pl-2.5 text-sm">{w.mensaje}</p>}
                      {w.pagina && /^https?:\/\//.test(w.pagina) && (
                        <a href={w.pagina} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-text-3 hover:text-foreground">
                          Ver la página donde escribió <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              </Tarjeta>
            )}
            {d.colabora.length > 0 && (
              <Tarjeta className="p-4">
                <p className="kicker mb-2">Colabora en</p>
                <ul className="divide-y" aria-label="Propiedades donde colabora">
                  {d.colabora.map((x) => (
                    <li key={x.propertyId} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-[13px] first:pt-0 last:pb-0">
                      <Link href={`/propiedades/${x.propertyId}`} className="min-w-0 flex-1 font-semibold hover:underline">
                        {x.code} · {x.title}
                      </Link>
                      <span className="text-text-2">
                        {ROL_LABELS[x.rol]} · {textoPorcentaje(x.porcentajeBp)}
                      </span>
                      <span className="w-24 text-right tabular-nums">{x.montoCents === null ? "—" : formatPrecio(x.montoCents, x.currency)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px] text-text-3">
                  Su parte estimada:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {(["USD", "CRC"] as const)
                      .map((m) => {
                        const t = d.colabora.filter((x) => x.currency === m && x.montoCents !== null).reduce((a, x) => a + x.montoCents!, 0);
                        return t ? formatPrecio(t, m) : null;
                      })
                      .filter(Boolean)
                      .join(" + ") || "sin precios todavía"}
                  </span>{" "}
                  (sobre la comisión de cada propiedad).
                </p>
              </Tarjeta>
            )}
          </aside>

          {/* Izquierda: quién es y qué busca, y las notas del equipo. */}
          <div className="order-3 space-y-4 lg:order-1">
            {/* 067 — Los datos de contacto también dentro de la ficha (se repiten a propósito). */}
            <Tarjeta>
              <DatosContacto
                phone={c.phone}
                email={c.email}
                origen={origen}
                referidor={c.referidor ? `${c.referidor.nombre}${c.referidor.codigo ? ` (${c.referidor.codigo})` : ""}` : null}
                tipos={p.tiposCliente.length ? p.tiposCliente.map((t) => TIPO_CLIENTE_LABELS[t]).join(", ") : null}
                creado={c.createdAt}
                ultimaActividad={c.ultimaActividad}
                onEditar={() => setEditando(true)}
              />
            </Tarjeta>
            {/* 068 — Los datos que pide la plantilla del negocio (sin PLANTILLAS no pinta nada). */}
            <Tarjeta>
              <CamposFicha contactId={c.id} onCambio={() => void refetch()} />
            </Tarjeta>
            {c.lead && (
              <Tarjeta>
                <TratoFicha
                  key={`${c.lead.id}-${c.lead.amountCents}-${c.priority}`}
                  leadId={c.lead.id}
                  amountCents={c.lead.amountCents}
                  moneda={c.lead.currency ?? d.monedaNegocio}
                  priority={c.priority}
                  onCambio={() => void refetch()}
                />
              </Tarjeta>
            )}
            <Tarjeta>
              <PerfilCliente contact={c} enlace={false} />
            </Tarjeta>
            <Tarjeta className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="kicker">Notas</p>
                <button type="button" onClick={() => setEditando(true)} className="rounded px-1.5 py-1 text-[13px] font-semibold text-text-2 hover:bg-accent [@media(pointer:coarse)]:min-h-11">
                  Editar
                </button>
              </div>
              {c.notes ? <p className="whitespace-pre-wrap text-sm">{c.notes}</p> : <p className="text-[13px] text-text-3">Sin notas.</p>}
            </Tarjeta>
          </div>
        </div>
      </div>

      {editando && (
        <EditarContactoDialog
          contacto={c}
          onClose={() => setEditando(false)}
          onSaved={() => {
            setEditando(false);
            void refetch();
          }}
        />
      )}
      {nuevaTarea && (
        <NuevaTareaDialog
          contact={{ id: c.id, name: c.name }}
          defaultDay={hoyLocal()}
          defaultTitle={atn && atn.motivo !== "agendado" && atn.motivo !== "mensaje" ? atn.accion.split(";")[0]!.slice(0, 120) : ""}
          onCancel={() => setNuevaTarea(false)}
          onCreated={() => {
            setNuevaTarea(false);
            void refetch();
          }}
        />
      )}
      {escribiendo && (
        <Dialogo titulo={`Escribir a ${c.name}`} descripcion="A quien no le ha escrito, WhatsApp solo deja abrirle la conversación con una plantilla aprobada." onClose={() => setEscribiendo(false)}>
          <StartConversation
            contactId={c.id}
            onStarted={() => {
              setEscribiendo(false);
              router.push(`/inbox?contact=${c.id}`);
            }}
          />
        </Dialogo>
      )}
    </div>
  );
}
