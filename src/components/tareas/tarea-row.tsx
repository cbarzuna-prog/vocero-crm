"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, MessageCircle, MoreHorizontal, Phone } from "lucide-react";
import { isLate, POSPONER, TASK_TYPE_LABELS, telHref, type TaskDto } from "@/lib/tareas";
import { cn } from "@/lib/utils";
import { TASK_TYPE_ICONS } from "./nueva-tarea-dialog";

/** "10:00" o "lun 21 oct · 10:00" en la zona del negocio. */
export function formatDue(task: TaskDto, tz: string, withDay: boolean): string {
  const d = new Date(task.dueAt);
  const day = new Intl.DateTimeFormat("es", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
  const time = new Intl.DateTimeFormat("es", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  if (task.allDay) return withDay ? day : "Todo el día";
  return withDay ? `${day} · ${time}` : time;
}

/** Botón de 44 px en el táctil, 32 px con ratón. */
const iconBtn =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-2 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-8";

function Menu({
  task,
  onPosponer,
  onEditar,
  onBorrar,
}: {
  task: TaskDto;
  onPosponer?: (dias: number, label: string) => void;
  onEditar?: () => void;
  onBorrar?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = "flex min-h-11 w-full items-center px-3 text-left text-sm hover:bg-accent sm:min-h-9";
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={iconBtn}
        aria-label={`Más acciones para «${task.title}»`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.8} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-md border bg-popover py-1 shadow-pop">
          {onPosponer && !task.doneAt && (
            <>
              <p className="px-3 pb-1 pt-1.5 text-[13px] font-semibold text-text-2">Pasar a…</p>
              {POSPONER.map((p) => (
                <button
                  key={p.dias}
                  type="button"
                  role="menuitem"
                  className={item}
                  onClick={() => {
                    setOpen(false);
                    onPosponer(p.dias, p.label);
                  }}
                >
                  {p.label}
                </button>
              ))}
              <div className="my-1 h-px bg-border" />
            </>
          )}
          {onEditar && (
            <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onEditar(); }}>
              Editar
            </button>
          )}
          {onBorrar && (
            <button type="button" role="menuitem" className={cn(item, "text-danger-text")} onClick={() => { setOpen(false); onBorrar(); }}>
              Borrar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 046/050 — Un renglón de tarea.
 *
 * Completar es UN toque en la casilla; tocar el título abre la conversación.
 * A la derecha va la acción de la tarea misma —Llamar si es una llamada,
 * WhatsApp si es un mensaje—, para hacerla sin pasar por el contacto, y el
 * menú para reprogramar, editar o borrar.
 */
export function TareaRow({
  task,
  timezone,
  withDay = false,
  overdue = false,
  showContact = true,
  meId = null,
  onToggle,
  onPosponer,
  onEditar,
  onDelete,
}: {
  task: TaskDto;
  timezone: string;
  withDay?: boolean;
  overdue?: boolean;
  showContact?: boolean;
  /** Quien mira: su nombre no se repite como responsable de sus propias tareas. */
  meId?: string | null;
  onToggle: (task: TaskDto) => void;
  onPosponer?: (task: TaskDto, dias: number, label: string) => void;
  onEditar?: (task: TaskDto) => void;
  onDelete?: (task: TaskDto) => void;
}) {
  const done = !!task.doneAt;
  const late = overdue || isLate(task, new Date());
  const Icon = TASK_TYPE_ICONS[task.type];
  const tel = task.type === "llamada" ? telHref(task.contact.phone) : null;
  const otro = task.assignedUserName && task.assignedUserId !== meId ? task.assignedUserName : null;

  return (
    <li className="flex items-center gap-2 rounded-lg border bg-card py-1.5 pl-2 pr-1.5 sm:gap-3 sm:pl-3">
      <button
        type="button"
        onClick={() => onToggle(task)}
        aria-label={done ? `Reabrir «${task.title}»` : `Completar «${task.title}»`}
        aria-pressed={done}
        // 44 px de diana en el táctil; el círculo visible es de 28.
        className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:w-9"
      >
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors",
            done
              ? "border-brand bg-brand text-brand-fg"
              : late
                ? "border-danger-text group-hover:bg-danger-soft"
                : "border-border-strong group-hover:border-brand"
          )}
        >
          {done && <Check className="h-4 w-4" strokeWidth={3} />}
        </span>
      </button>

      {task.property?.coverUrl && (
        // El objeto que el corredor reconoce de un vistazo: la casa.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={task.property.coverUrl} alt="" className="hidden h-10 w-14 shrink-0 rounded object-cover sm:block" loading="lazy" />
      )}

      <Link
        href={`/inbox?contact=${task.contact.id}`}
        className="min-w-0 flex-1 rounded py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className={cn("text-[15px] font-[620] leading-snug", done && "text-text-2 line-through")}>{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-text-2">
          <span className="inline-flex items-center gap-1">
            <Icon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            <span className="sr-only">{TASK_TYPE_LABELS[task.type]}</span>
            <span className={cn("tabular-nums", late && !done && "font-semibold text-danger-text")}>
              {formatDue(task, timezone, withDay)}
            </span>
          </span>
          {showContact && <span className="truncate text-foreground">{task.contact.name}</span>}
          {task.property && <span className="truncate">{task.property.code}</span>}
          {otro && <span className="truncate">· {otro}</span>}
        </p>
      </Link>

      {!done && tel && (
        <a href={tel} className={iconBtn} aria-label={`Llamar a ${task.contact.name}`} title="Llamar">
          <Phone className="h-4 w-4" strokeWidth={1.8} />
        </a>
      )}
      {!done && task.type === "whatsapp" && (
        <Link href={`/inbox?contact=${task.contact.id}`} className={iconBtn} aria-label={`Escribir a ${task.contact.name}`} title="Abrir WhatsApp">
          <MessageCircle className="h-4 w-4" strokeWidth={1.8} />
        </Link>
      )}
      {(onPosponer || onEditar || onDelete) && (
        <Menu
          task={task}
          onPosponer={onPosponer ? (d, l) => onPosponer(task, d, l) : undefined}
          onEditar={onEditar ? () => onEditar(task) : undefined}
          onBorrar={onDelete ? () => onDelete(task) : undefined}
        />
      )}
    </li>
  );
}
