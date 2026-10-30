"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, MessageSquareText, MoreHorizontal, Phone, Search, Send, SlidersHorizontal, Upload, UserPlus, Users, X } from "lucide-react";
import {
  codigosDePropiedades,
  diasDesde,
  FILTRO_VACIO,
  filtrarContactos,
  ORDEN_CONTACTOS_LABELS,
  ORDENES_CONTACTOS,
  ordenarContactos,
  referidoresDe,
  type ContactoFila,
  type FiltroContactos,
  type OrdenContactos,
} from "@/lib/contactos";
import { rangoPresupuesto, TIPO_CLIENTE_LABELS, TIPOS_CLIENTE } from "@/lib/perfil-cliente";
import { telHref } from "@/lib/tareas";
import type { StageDto } from "@/lib/types";
import { cn, formatPhone } from "@/lib/utils";
import { ContactAvatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ImportContactsDialog } from "@/components/contacts/import-contacts-dialog";
import { StartConversation } from "@/components/contacts/start-conversation";
import { PriorityBadge } from "@/components/pipeline/priority-picker";
import { selectClass } from "@/components/propiedades/shared";
import { SOURCE_LABELS } from "@/server/contact-source";
import { Dialogo } from "./dialogo";
import { EditarContactoDialog } from "./editar-contacto-dialog";
import { NuevoContactoDialog } from "./nuevo-contacto-dialog";

const ORDEN_KEY = "kk.contactos.orden";

/** «hoy 10:32», «ayer», «hace 5 d», «12 sep». */
export function cuando(iso: string, ahora = new Date()): string {
  const d = new Date(iso);
  const dias = diasDesde(iso, ahora.getTime());
  if (d.toDateString() === ahora.toDateString())
    return `hoy ${d.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`;
  if (dias <= 1) return "ayer";
  if (dias < 30) return `hace ${dias} d`;
  return d.toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

function busca(c: ContactoFila): string {
  return [
    c.tiposCliente.length ? c.tiposCliente.map((t) => TIPO_CLIENTE_LABELS[t]).join(", ") : null,
    rangoPresupuesto(c),
    c.zonas.length ? c.zonas.slice(0, 2).join(", ") + (c.zonas.length > 2 ? "…" : "") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function Menu({ c, onEditar, onEscribir, onArchivar }: { c: ContactoFila; onEditar: () => void; onEscribir: () => void; onArchivar: () => void }) {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", cerrar);
    return () => document.removeEventListener("keydown", cerrar);
  }, [abierto]);
  const item = "flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-accent sm:min-h-9";
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Más acciones para ${c.name}`}
        title="Más acciones"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-text-2 hover:bg-accent hover:text-foreground sm:h-9 sm:w-9"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {abierto && (
        <>
          <button type="button" tabIndex={-1} aria-hidden className="fixed inset-0 z-20 cursor-default" onClick={() => setAbierto(false)} />
          <div role="menu" className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-md border bg-popover py-1 shadow-pop">
            <button type="button" role="menuitem" className={item} onClick={() => { setAbierto(false); onEditar(); }}>
              Editar nombre y notas
            </button>
            <button type="button" role="menuitem" className={item} onClick={() => { setAbierto(false); onEscribir(); }}>
              <Send className="h-4 w-4 text-text-3" aria-hidden /> Escribir primero (plantilla)
            </button>
            <button type="button" role="menuitem" className={item} onClick={() => { setAbierto(false); onArchivar(); }}>
              {c.archivedAt ? <ArchiveRestore className="h-4 w-4 text-text-3" aria-hidden /> : <Archive className="h-4 w-4 text-text-3" aria-hidden />}
              {c.archivedAt ? "Restaurar" : "Archivar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 057 (fork) — Contactos para trabajar la cartera: buscar por nombre,
 * teléfono, correo, zona o código de propiedad; filtrar por etapa, origen,
 * tipo de cliente, propiedad o tareas vencidas; ordenar; seleccionar varios
 * para moverlos de etapa o archivarlos, con «Deshacer». Cada nombre abre la
 * página del contacto.
 */
export function ContactosClient() {
  const router = useRouter();
  const [filas, setFilas] = useState<ContactoFila[] | null>(null);
  const [etapas, setEtapas] = useState<StageDto[]>([]);
  const [f, setF] = useState<FiltroContactos>(FILTRO_VACIO);
  const [orden, setOrden] = useState<OrdenContactos>("actividad");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState<{ texto: string; deshacer?: () => void } | null>(null);
  const [creando, setCreando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [editando, setEditando] = useState<ContactoFila | null>(null);
  const [escribiendo, setEscribiendo] = useState<ContactoFila | null>(null);
  const [moviendo, setMoviendo] = useState(false);

  const refetch = useCallback(async () => {
    const res = await fetch("/api/contactos").catch(() => null);
    if (res?.ok) setFilas(((await res.json()) as { contactos: ContactoFila[] }).contactos);
  }, []);

  useEffect(() => {
    void refetch();
    // 058: desde Referidos llega con ?referidor=<id> ya filtrado.
    const ref = new URLSearchParams(window.location.search).get("referidor");
    if (ref) {
      setF((x) => ({ ...x, referidor: ref }));
      setFiltrosAbiertos(true);
    }
    void (async () => {
      const r = await fetch("/api/pipeline/stages").catch(() => null);
      if (r?.ok) setEtapas(((await r.json()) as { stages: StageDto[] }).stages);
    })();
    try {
      const o = window.localStorage.getItem(ORDEN_KEY);
      if (o && (ORDENES_CONTACTOS as readonly string[]).includes(o)) setOrden(o as OrdenContactos);
    } catch {
      /* sin almacenamiento */
    }
  }, [refetch]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 8000);
    return () => clearTimeout(t);
  }, [aviso]);

  const visibles = useMemo(() => (filas ? ordenarContactos(filtrarContactos(filas, f), orden) : null), [filas, f, orden]);
  const codigos = useMemo(() => (filas ? codigosDePropiedades(filas) : []), [filas]);
  const referidores = useMemo(() => (filas ? referidoresDe(filas) : []), [filas]);
  const activos = filas?.filter((c) => !c.archivedAt) ?? [];
  const resumen = filas
    ? [
        `${activos.length} ${activos.length === 1 ? "contacto" : "contactos"}`,
        activos.filter((c) => c.tareas.vencidas > 0).length ? `${activos.filter((c) => c.tareas.vencidas > 0).length} con tareas vencidas` : null,
        activos.filter((c) => c.noLeidos > 0).length ? `${activos.filter((c) => c.noLeidos > 0).length} sin leer` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const nFiltros = (["etapa", "origen", "tipo", "propiedad", "referidor"] as const).filter((k) => f[k]).length + (f.soloVencidas ? 1 : 0) + (f.archivados ? 1 : 0);
  const set = (patch: Partial<FiltroContactos>) => {
    setF((x) => ({ ...x, ...patch }));
    setSel(new Set());
  };

  async function lote(ids: string[], accion: "archivar" | "restaurar") {
    await fetch("/api/contactos/lote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids, accion }) }).catch(() => null);
    await refetch();
  }

  async function archivar(ids: string[], restaurar = false) {
    await lote(ids, restaurar ? "restaurar" : "archivar");
    setSel(new Set());
    const n = ids.length;
    setAviso({
      texto: restaurar ? `${n} ${n === 1 ? "restaurado" : "restaurados"}` : `${n} ${n === 1 ? "contacto archivado" : "contactos archivados"}`,
      deshacer: () => {
        void lote(ids, restaurar ? "archivar" : "restaurar");
        setAviso(null);
      },
    });
  }

  async function moverA(stageId: string) {
    const nombre = etapas.find((e) => e.id === stageId)?.name ?? "";
    const leads = (filas ?? []).filter((c) => sel.has(c.id) && c.lead && c.lead.stageId !== stageId).map((c) => c.lead!.id);
    setMoviendo(true);
    for (const id of leads) {
      await fetch(`/api/pipeline/leads/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ stageId }) }).catch(() => null);
    }
    setMoviendo(false);
    setSel(new Set());
    await refetch();
    setAviso({ texto: `${leads.length} ${leads.length === 1 ? "contacto pasó" : "contactos pasaron"} a «${nombre}»` });
  }

  const todos = visibles ?? [];
  const todosSel = todos.length > 0 && todos.every((c) => sel.has(c.id));
  const alternar = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const check = "h-5 w-5 shrink-0 cursor-pointer accent-[var(--accent)]";

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight">Contactos</h1>
            {resumen && <p className="truncate text-[13px] text-text-2 tabular-nums">{resumen}</p>}
          </div>
          <Button size="sm" onClick={() => setCreando(true)}>
            <UserPlus className="mr-1 h-4 w-4" strokeWidth={1.8} /> Nuevo
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setImportando(true)} title="Importar contactos desde un archivo CSV">
            <Upload className="h-4 w-4 sm:mr-1" strokeWidth={1.8} aria-hidden />
            <span className="sr-only sm:not-sr-only">Importar</span>
          </Button>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-72 sm:flex-none">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Nombre, teléfono, zona o KK-…"
              aria-label="Buscar contacto"
              value={f.q}
              onChange={(e) => set({ q: e.target.value })}
              className="pl-8"
            />
          </div>
          <Button size="sm" variant={filtrosAbiertos || nFiltros > 0 ? "secondary" : "outline"} onClick={() => setFiltrosAbiertos((v) => !v)} aria-expanded={filtrosAbiertos}>
            <SlidersHorizontal className="h-4 w-4 sm:mr-1" strokeWidth={1.8} aria-hidden />
            <span className="sr-only sm:not-sr-only">Filtros</span>
            {nFiltros > 0 && <span className="ml-1 tabular-nums">· {nFiltros}</span>}
          </Button>
          <select
            aria-label="Ordenar contactos"
            className={cn(selectClass, "hidden max-w-[12rem] sm:block")}
            value={orden}
            onChange={(e) => {
              const v = e.target.value as OrdenContactos;
              setOrden(v);
              try {
                window.localStorage.setItem(ORDEN_KEY, v);
              } catch {
                /* la elección dura la visita */
              }
            }}
          >
            {ORDENES_CONTACTOS.map((o) => (
              <option key={o} value={o}>
                {ORDEN_CONTACTOS_LABELS[o]}
              </option>
            ))}
          </select>
        </div>

        {filtrosAbiertos && (
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
            <select aria-label="Ordenar (celular)" className={cn(selectClass, "col-span-2 sm:hidden")} value={orden} onChange={(e) => setOrden(e.target.value as OrdenContactos)}>
              {ORDENES_CONTACTOS.map((o) => (
                <option key={o} value={o}>
                  Ordenar: {ORDEN_CONTACTOS_LABELS[o]}
                </option>
              ))}
            </select>
            <select aria-label="Etapa" className={selectClass} value={f.etapa} onChange={(e) => set({ etapa: e.target.value })}>
              <option value="">Toda etapa</option>
              {etapas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select aria-label="Origen" className={selectClass} value={f.origen} onChange={(e) => set({ origen: e.target.value })}>
              <option value="">Todo origen</option>
              {(Object.keys(SOURCE_LABELS) as (keyof typeof SOURCE_LABELS)[]).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
            <select aria-label="Tipo de cliente" className={selectClass} value={f.tipo} onChange={(e) => set({ tipo: e.target.value })}>
              <option value="">Todo tipo de cliente</option>
              {TIPOS_CLIENTE.map((t) => (
                <option key={t} value={t}>
                  {TIPO_CLIENTE_LABELS[t]}
                </option>
              ))}
            </select>
            <select aria-label="Propiedad de interés" className={selectClass} value={f.propiedad} onChange={(e) => set({ propiedad: e.target.value })}>
              <option value="">Cualquier propiedad</option>
              {codigos.map((c) => (
                <option key={c} value={c}>
                  Interesado en {c}
                </option>
              ))}
            </select>
            {referidores.length > 0 && (
              <select aria-label="Referido por" className={selectClass} value={f.referidor} onChange={(e) => set({ referidor: e.target.value })}>
                <option value="">Cualquier referidor</option>
                {referidores.map((r) => (
                  <option key={r.id} value={r.id}>
                    Referido por {r.nombre}
                  </option>
                ))}
              </select>
            )}
            <label className="flex min-h-9 items-center gap-2 text-[13px] [@media(pointer:coarse)]:min-h-11">
              <input type="checkbox" className={check} checked={f.soloVencidas} onChange={(e) => set({ soloVencidas: e.target.checked })} />
              Con tareas vencidas
            </label>
            <label className="flex min-h-9 items-center gap-2 text-[13px] [@media(pointer:coarse)]:min-h-11">
              <input type="checkbox" className={check} checked={f.archivados} onChange={(e) => set({ archivados: e.target.checked })} />
              Ver archivados
            </label>
            {nFiltros > 0 && (
              <Button size="sm" variant="ghost" className="h-9" onClick={() => set({ ...FILTRO_VACIO, q: f.q })}>
                Limpiar
              </Button>
            )}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-28">
        {visibles === null ? (
          <ul className="space-y-2" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="h-16 animate-pulse rounded-lg border bg-card" />
            ))}
          </ul>
        ) : visibles.length === 0 ? (
          f.q || nFiltros > 0 ? (
            <EmptyState icon={Search} className="h-full" title="Sin resultados" description="Nadie coincide con esa búsqueda o esos filtros." />
          ) : (
            <EmptyState icon={Users} className="h-full" title="Sin contactos todavía" description="Cada persona que le escriba por WhatsApp o deje sus datos en su sitio aparece aquí sola." />
          )
        ) : (
          <div className="mx-auto max-w-7xl overflow-hidden rounded-lg border bg-card">
            <div className="hidden items-center gap-3 border-b bg-subtle px-4 py-2 text-[12px] font-semibold text-text-2 lg:flex">
              <input type="checkbox" className={check} aria-label="Seleccionar todos" checked={todosSel} onChange={() => setSel(todosSel ? new Set() : new Set(todos.map((c) => c.id)))} />
              <span className="w-[26%]">Contacto</span>
              <span className="w-[16%]">Etapa</span>
              <span className="flex-1">Busca</span>
              <span className="w-24">Propiedades</span>
              <span className="w-20">Tareas</span>
              <span className="w-24">Actividad</span>
              <span className="w-[8.5rem]" />
            </div>
            <ul className="divide-y">
              {visibles.map((c) => {
                const tel = telHref(c.phone);
                const dias = c.lead ? diasDesde(c.lead.desde) : null;
                const b = busca(c);
                return (
                  <li key={c.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 sm:px-4 lg:flex-nowrap", sel.has(c.id) && "bg-brand-tint")}>
                    <label className="flex h-11 w-7 shrink-0 items-center justify-center lg:h-auto lg:w-auto">
                      <input type="checkbox" className={check} aria-label={`Seleccionar a ${c.name}`} checked={sel.has(c.id)} onChange={() => alternar(c.id)} />
                    </label>
                    <Link href={`/contacts/${c.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-[26%] lg:flex-none">
                      <ContactAvatar name={c.name} seed={c.id} size="sm" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[15px] font-[620]" title={c.name}>
                            {c.name}
                          </span>
                          {c.priority && <PriorityBadge value={c.priority} />}
                          {c.noLeidos > 0 && (
                            <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-brand-fg" title="Mensajes sin leer">
                              {c.noLeidos}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[13px] text-text-2 tabular-nums">
                          {formatPhone(c.phone)}
                          {c.referidor ? (
                            <span className="text-text-3"> · Ref. {c.referidor.nombre}</span>
                          ) : (
                            c.source.source === "capturada" && <span className="text-text-3"> · {SOURCE_LABELS[c.source.value]}</span>
                          )}
                        </span>
                      </span>
                    </Link>
                    <span className="order-last w-full pl-10 text-[13px] lg:order-none lg:w-[16%] lg:pl-0">
                      {c.lead ? (
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <Badge variant={c.lead.stageKind === "won" ? "success" : c.lead.stageKind === "lost" ? "secondary" : "outline"}>{c.lead.stageName}</Badge>
                          {c.lead.stageKind === "open" && dias !== null && (
                            <span className={cn("tabular-nums", dias >= 14 ? "font-semibold text-warning-text" : "text-text-3")} title="Días en esta etapa">
                              {dias === 0 ? "hoy" : `${dias} d`}
                            </span>
                          )}
                          {c.archivedAt && <Badge variant="secondary">Archivado</Badge>}
                          <span className="text-text-2 lg:hidden">{b ? `· ${b}` : ""}</span>
                        </span>
                      ) : (
                        <span className="text-text-3">Sin etapa</span>
                      )}
                    </span>
                    <span className="hidden min-w-0 flex-1 truncate text-[13px] text-text-2 lg:block" title={b}>
                      {b || <span className="text-text-3">—</span>}
                    </span>
                    <span className="hidden w-24 truncate text-[13px] lg:block" title={c.propiedades.join(", ")}>
                      {c.propiedades.length ? c.propiedades.join(", ") : <span className="text-text-3">—</span>}
                    </span>
                    <span className="hidden w-20 text-[13px] tabular-nums lg:block">
                      {c.tareas.vencidas > 0 ? (
                        <span className="font-semibold text-danger-text" title={`${c.tareas.vencidas} vencida(s) de ${c.tareas.pendientes} pendiente(s)`}>
                          {c.tareas.vencidas} vencida{c.tareas.vencidas === 1 ? "" : "s"}
                        </span>
                      ) : c.tareas.pendientes > 0 ? (
                        <span className="text-text-2">{c.tareas.pendientes} pend.</span>
                      ) : (
                        <span className="text-warning-text" title="Sin siguiente paso: agende una tarea">Sin tarea</span>
                      )}
                    </span>
                    <span className="hidden w-24 text-[13px] text-text-2 tabular-nums lg:block">{cuando(c.ultimaActividad)}</span>
                    <span className="flex shrink-0 items-center lg:w-[8.5rem] lg:justify-end">
                      {tel && (
                        <a href={tel} aria-label={`Llamar a ${c.name}`} title="Llamar" className="flex h-11 w-11 items-center justify-center rounded-full text-text-2 hover:bg-accent hover:text-foreground sm:h-9 sm:w-9">
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                      {c.conversationId ? (
                        <Link href={`/inbox?contact=${c.id}`} aria-label={`Abrir la conversación con ${c.name}`} title="Abrir la conversación" className="flex h-11 w-11 items-center justify-center rounded-full text-text-2 hover:bg-accent hover:text-foreground sm:h-9 sm:w-9">
                          <MessageSquareText className="h-4 w-4" />
                        </Link>
                      ) : (
                        <button type="button" onClick={() => setEscribiendo(c)} aria-label={`Escribirle primero a ${c.name}`} title="Escribir primero (con plantilla)" className="flex h-11 w-11 items-center justify-center rounded-full text-text-2 hover:bg-accent hover:text-foreground sm:h-9 sm:w-9">
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      <Menu c={c} onEditar={() => setEditando(c)} onEscribir={() => setEscribiendo(c)} onArchivar={() => void archivar([c.id], !!c.archivedAt)} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {(sel.size > 0 || aviso) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav,0px)+1rem)] z-40 flex justify-center px-4">
          {sel.size > 0 ? (
            <div role="region" aria-label="Acciones con los seleccionados" className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg border bg-popover px-3 py-2 shadow-pop">
              <span className="text-sm font-semibold tabular-nums">{sel.size} seleccionado{sel.size === 1 ? "" : "s"}</span>
              <select
                aria-label="Mover a la etapa"
                className={cn(selectClass, "h-9")}
                value=""
                disabled={moviendo}
                onChange={(e) => e.target.value && void moverA(e.target.value)}
              >
                <option value="">{moviendo ? "Moviendo…" : "Mover a…"}</option>
                {etapas
                  .filter((s) => s.kind !== "lost")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
              <Button size="sm" variant="secondary" onClick={() => void archivar([...sel], f.archivados)}>
                {f.archivados ? <ArchiveRestore className="mr-1 h-4 w-4" /> : <Archive className="mr-1 h-4 w-4" />}
                {f.archivados ? "Restaurar" : "Archivar"}
              </Button>
              <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent" aria-label="Quitar la selección" title="Quitar la selección" onClick={() => setSel(new Set())}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : aviso ? (
            <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-lg bg-foreground px-4 py-2.5 text-sm text-background shadow-pop">
              {aviso.texto}
              {aviso.deshacer && (
                <button type="button" className="font-semibold underline underline-offset-2" onClick={aviso.deshacer}>
                  Deshacer
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}

      {creando && (
        <NuevoContactoDialog
          onClose={() => setCreando(false)}
          onCreated={() => {
            setCreando(false);
            void refetch();
            setAviso({ texto: "Contacto creado" });
          }}
          onOpenExisting={(id) => {
            setCreando(false);
            router.push(`/contacts/${id}`);
          }}
        />
      )}
      {importando && <ImportContactsDialog onClose={() => setImportando(false)} onImported={() => void refetch()} />}
      {editando && (
        <EditarContactoDialog
          contacto={editando}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null);
            void refetch();
          }}
        />
      )}
      {escribiendo && (
        <Dialogo titulo={`Escribir a ${escribiendo.name}`} descripcion="A quien no le ha escrito, WhatsApp solo deja abrirle la conversación con una plantilla aprobada." onClose={() => setEscribiendo(null)}>
          <StartConversation
            contactId={escribiendo.id}
            onStarted={() => {
              const id = escribiendo.id;
              setEscribiendo(null);
              router.push(`/inbox?contact=${id}`);
            }}
          />
        </Dialogo>
      )}
    </div>
  );
}
