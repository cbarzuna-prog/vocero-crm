"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft, ArrowRightLeft, Bot, Building2, CheckCircle2, Mail, MessageSquareText, Pencil, Phone, Send, Sparkles, SquareCheck, UserPlus } from "lucide-react";
import { diasDesde, type ContactoDetalle, type EventoHistorial } from "@/lib/contactos";
import { telHref } from "@/lib/tareas";
import { cn, formatPhone } from "@/lib/utils";
import { ContactAvatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { StartConversation } from "@/components/contacts/start-conversation";
import { PriorityBadge } from "@/components/pipeline/priority-picker";
import { PropiedadesContacto } from "@/components/propiedades/propiedades-contacto";
import { TareasContacto } from "@/components/tareas/tareas-contacto";
import { SOURCE_LABELS } from "@/server/contact-source";
import { Dialogo } from "./dialogo";
import { EditarContactoDialog } from "./editar-contacto-dialog";
import { PerfilCliente } from "./perfil-cliente";
import { cuando } from "./contactos-client";

const ICONO: Record<EventoHistorial["tipo"], typeof Phone> = {
  alta: UserPlus,
  mensaje: MessageSquareText,
  etapa: ArrowRightLeft,
  propiedad: Building2,
  tarea: SquareCheck,
  tarea_hecha: CheckCircle2,
};

/** Tarjeta que envuelve las secciones del panel (que traen su propio borde inferior). */
function Tarjeta({ children, className }: { children: React.ReactNode; className?: string }) {
  // `empty:hidden`: mientras la sección carga (o sin su módulo) no queda una línea suelta.
  return <div className={cn("overflow-hidden rounded-lg border bg-card empty:hidden [&>section]:border-b-0", className)}>{children}</div>;
}

/**
 * 057 (fork) — Todo de una persona en una página: quién es y qué busca,
 * qué propiedades se le han ofrecido, sus tareas, lo último que se dijeron y
 * su historia (etapas, propiedades, tareas). Las acciones del día —llamar,
 * escribir, nueva tarea— a un toque desde arriba.
 */
export function ContactoPagina({ id }: { id: string }) {
  const router = useRouter();
  const [d, setD] = useState<ContactoDetalle | null | "no">(null);
  const [editando, setEditando] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/contactos/${id}`).catch(() => null);
    if (res?.status === 404) return setD("no");
    if (res?.ok) setD((await res.json()) as ContactoDetalle);
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

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
  const tel = telHref(c.phone);
  const dias = c.lead ? diasDesde(c.lead.desde) : null;

  async function archivar() {
    await fetch(`/api/contacts/${c.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: !c.archivedAt }),
    }).catch(() => null);
    await refetch();
  }

  const accion = "flex h-11 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold hover:bg-accent sm:h-9";

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/contacts" className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-text-2 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Contactos
        </Link>
        <div className="flex flex-wrap items-start gap-3">
          <ContactAvatar name={c.name} seed={c.id} size="md" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold leading-tight tracking-tight">{c.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-2">
              <span className="tabular-nums">{formatPhone(c.phone)}</span>
              {d.perfil.email && <span>· {d.perfil.email}</span>}
              {c.source.value !== "desconocida" && <span>· {SOURCE_LABELS[c.source.value]}</span>}
              <span>· desde {new Date(c.createdAt).toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" })}</span>
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {c.lead && (
                <Badge variant={c.lead.stageKind === "won" ? "success" : c.lead.stageKind === "lost" ? "secondary" : "outline"}>
                  {c.lead.stageName}
                  {c.lead.stageKind === "open" && dias !== null && <span className="ml-1 font-normal text-text-3">· {dias === 0 ? "desde hoy" : `${dias} d`}</span>}
                </Badge>
              )}
              {c.priority && <PriorityBadge value={c.priority} />}
              {c.aiPaused && <Badge variant="warning">Sin agente</Badge>}
              {c.archivedAt && <Badge variant="secondary">Archivado</Badge>}
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {c.conversationId ? (
              <Link href={`/inbox?contact=${c.id}`} className={cn(accion, "border-transparent bg-brand text-brand-fg hover:bg-brand-hover")}>
                <MessageSquareText className="h-4 w-4" aria-hidden /> WhatsApp
              </Link>
            ) : (
              <button type="button" className={cn(accion, "border-transparent bg-brand text-brand-fg hover:bg-brand-hover")} onClick={() => setEscribiendo(true)}>
                <Send className="h-4 w-4" aria-hidden /> Escribir primero
              </button>
            )}
            {tel && (
              <a href={tel} className={accion}>
                <Phone className="h-4 w-4" aria-hidden /> Llamar
              </a>
            )}
            {d.perfil.email && (
              <a href={`mailto:${d.perfil.email}`} className={accion} title={d.perfil.email}>
                <Mail className="h-4 w-4" aria-hidden /> Correo
              </a>
            )}
            <button type="button" className={accion} onClick={() => setEditando(true)}>
              <Pencil className="h-4 w-4" aria-hidden /> Editar
            </button>
            <button type="button" className={accion} onClick={() => void archivar()} title={c.archivedAt ? "Volver a la lista" : "Sacarlo de la lista sin borrarlo"}>
              {c.archivedAt ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
              {c.archivedAt ? "Restaurar" : "Archivar"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24">
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6">
          {/* En el celular: tareas primero (lo que toca hacer), luego quién es. */}
          <div className="order-2 space-y-4 lg:order-1">
            <Tarjeta>
              <PerfilCliente contact={c} enlace={false} />
            </Tarjeta>
            <Tarjeta>
              <PropiedadesContacto contact={c} />
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

          <aside className="order-1 space-y-4 lg:order-2">
            <Tarjeta>
              <TareasContacto contact={c} />
            </Tarjeta>

            <Tarjeta className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="kicker">Conversación</p>
                {c.conversationId && (
                  <Link href={`/inbox?contact=${c.id}`} className="text-[13px] font-semibold text-brand-text hover:underline">
                    Abrir en la Bandeja
                  </Link>
                )}
              </div>
              {d.mensajes.length === 0 ? (
                <p className="text-[13px] text-text-3">Todavía no han conversado por WhatsApp.</p>
              ) : (
                <ol className="max-h-80 space-y-1.5 overflow-y-auto pr-1" aria-label="Últimos mensajes">
                  {d.mensajes.map((m) => (
                    <li key={m.id} className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
                      <span
                        className={cn(
                          "max-w-[85%] rounded-lg px-2.5 py-1.5 text-[13px] leading-snug",
                          m.direction === "out" ? "bg-[var(--bubble-out)] text-[var(--bubble-out-text)]" : "bg-[var(--bubble-in)]"
                        )}
                      >
                        {m.text ?? <span className="italic text-text-3">[{m.type}]</span>}
                        <span className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-text-3">
                          {m.deAgente && <Bot className="h-3 w-3" aria-label="Lo escribió el agente" />}
                          {cuando(m.en)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Tarjeta>

            <Tarjeta className="p-4">
              <p className="kicker mb-2">Historia</p>
              <ol className="space-y-2">
                {d.historial.map((e, i) => {
                  const Icono = ICONO[e.tipo];
                  return (
                    <li key={i} className="flex gap-2.5 text-[13px]">
                      <Icono className="mt-0.5 h-4 w-4 shrink-0 text-text-3" aria-hidden />
                      <span className="min-w-0 flex-1">
                        {e.texto}
                        {e.quien === "agente" && <Sparkles className="ml-1 inline h-3 w-3 text-brand-text" aria-label="Lo hizo el agente" />}
                      </span>
                      <time className="shrink-0 text-text-3 tabular-nums" dateTime={e.en} title={new Date(e.en).toLocaleString("es-CR")}>
                        {cuando(e.en)}
                      </time>
                    </li>
                  );
                })}
              </ol>
            </Tarjeta>
          </aside>
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
