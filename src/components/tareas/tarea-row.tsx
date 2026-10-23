"use client";

import Link from "next/link";
import { Check, Trash2 } from "lucide-react";
import { isLate, TASK_TYPE_LABELS, type TaskDto } from "@/lib/tareas";
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

/**
 * 046 — Un renglón de tarea. Completar es UN toque en la casilla (H4); tocar
 * el resto abre la conversación del contacto.
 */
export function TareaRow({
  task,
  timezone,
  withDay = false,
  overdue = false,
  showContact = true,
  onToggle,
  onDelete,
}: {
  task: TaskDto;
  timezone: string;
  withDay?: boolean;
  overdue?: boolean;
  showContact?: boolean;
  onToggle: (task: TaskDto) => void;
  onDelete?: (task: TaskDto) => void;
}) {
  const done = !!task.doneAt;
  const late = overdue || isLate(task, new Date());
  const Icon = TASK_TYPE_ICONS[task.type];

  return (
    <li className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5">
      <button
        type="button"
        onClick={() => onToggle(task)}
        aria-label={done ? `Reabrir «${task.title}»` : `Completar «${task.title}»`}
        aria-pressed={done}
        className={cn(
          // 28px de diana: cómodo con el pulgar.
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          done
            ? "border-brand bg-brand text-brand-fg"
            : late
              ? "border-danger-text hover:bg-danger-soft"
              : "border-border-strong hover:border-brand"
        )}
      >
        {done && <Check className="h-4 w-4" strokeWidth={3} />}
      </button>

      <Link
        href={`/inbox?contact=${task.contact.id}`}
        className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className={cn("text-[14px] font-[620] leading-snug", done && "text-text-3 line-through")}>
          {task.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-3">
          <span className="inline-flex items-center gap-1">
            <Icon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            <span className="sr-only">{TASK_TYPE_LABELS[task.type]}</span>
            <span className={cn(late && !done && "font-semibold text-danger-text")}>
              {formatDue(task, timezone, withDay)}
            </span>
          </span>
          {showContact && <span className="truncate text-text-2">{task.contact.name}</span>}
          {task.property && <span className="truncate">{task.property.code}</span>}
          {task.assignedUserName && <span className="truncate">· {task.assignedUserName}</span>}
        </p>
      </Link>

      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(task)}
          aria-label={`Borrar «${task.title}»`}
          className="mt-1 rounded p-1 text-text-3 hover:text-danger-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
        </button>
      )}
    </li>
  );
}
