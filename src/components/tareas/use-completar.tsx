"use client";

import { useEffect, useRef, useState } from "react";
import { diaYHora, nextBusinessDays, sumarDias, type TaskDto } from "@/lib/tareas";
import { NuevaTareaDialog } from "./nueva-tarea-dialog";

type Aviso = {
  texto: string;
  acciones: { label: string; run: () => void | Promise<void> }[];
};

async function patch(id: string, body: Record<string, unknown>) {
  return fetch(`/api/tareas/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

/**
 * 046/050 — Completar, reprogramar y borrar tareas, con «Deshacer».
 *
 * Nada pide confirmación: cada acción se hace al instante y el aviso de abajo
 * la deshace durante 8 s (más rápido que un «¿Está seguro?», y sin el diálogo
 * del navegador que en el celular tapa la pantalla). Completar ofrece además
 * crear la siguiente, que es justo lo que se olvida.
 */
export function useCompletarTarea({
  today,
  timezone,
  onChanged,
}: {
  /** Día del negocio, `AAAA-MM-DD`. */
  today: string;
  timezone: string;
  onChanged: () => void;
}) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [siguiente, setSiguiente] = useState<TaskDto | null>(null);
  const [editando, setEditando] = useState<TaskDto | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!aviso) return;
    timer.current = setTimeout(() => setAviso(null), 8000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [aviso]);

  const hecho = async (fn: () => Promise<unknown>) => {
    setAviso(null);
    await fn();
    onChanged();
  };

  async function toggle(task: TaskDto) {
    const done = !task.doneAt;
    const res = await patch(task.id, { done });
    onChanged();
    if (res?.ok && done) {
      setAviso({
        texto: `Hecha: ${task.title}`,
        acciones: [
          { label: "Deshacer", run: () => hecho(() => patch(task.id, { done: false })) },
          {
            label: "Crear siguiente",
            run: () => {
              setAviso(null);
              setSiguiente(task);
            },
          },
        ],
      });
    }
  }

  async function posponer(task: TaskDto, dias: number, label: string) {
    const antes = diaYHora(task, timezone);
    const res = await patch(task.id, { day: sumarDias(today, dias) });
    onChanged();
    if (res?.ok) {
      setAviso({
        texto: `${task.title} → ${label.toLowerCase()}`,
        acciones: [{ label: "Deshacer", run: () => hecho(() => patch(task.id, { day: antes.day, time: antes.time })) }],
      });
    }
  }

  async function remove(task: TaskDto) {
    const antes = diaYHora(task, timezone);
    const res = await fetch(`/api/tareas/${task.id}`, { method: "DELETE" }).catch(() => null);
    onChanged();
    if (res?.ok) {
      setAviso({
        texto: `Borrada: ${task.title}`,
        acciones: [
          {
            label: "Deshacer",
            // Se vuelve a crear con los mismos datos (otro id; nada más depende de él).
            run: () =>
              hecho(() =>
                fetch("/api/tareas", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    contactId: task.contact.id,
                    propertyId: task.property?.id ?? null,
                    title: task.title,
                    type: task.type,
                    day: antes.day,
                    time: antes.time,
                    assignedUserId: task.assignedUserId,
                  }),
                })
              ),
          },
        ],
      });
    }
  }

  const ui = (
    <>
      {aviso && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+var(--bottom-nav,0px))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-popover px-4 py-2 shadow-pop"
        >
          <p className="min-w-0 flex-1 truncate text-sm">{aviso.texto}</p>
          {aviso.acciones.map((a) => (
            <button
              key={a.label}
              type="button"
              className="min-h-11 shrink-0 px-1 text-sm font-semibold text-brand-text hover:underline sm:min-h-8"
              onClick={() => void a.run()}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      {siguiente && (
        <NuevaTareaDialog
          contact={siguiente.contact}
          defaultType={siguiente.type}
          defaultDay={nextBusinessDays(today)}
          onCancel={() => setSiguiente(null)}
          onCreated={() => {
            setSiguiente(null);
            onChanged();
          }}
        />
      )}
      {editando && (
        <NuevaTareaDialog
          editing={editando}
          timezone={timezone}
          contact={editando.contact}
          defaultDay={today}
          onCancel={() => setEditando(null)}
          onCreated={() => {
            setEditando(null);
            onChanged();
          }}
        />
      )}
    </>
  );

  return { toggle, remove, posponer, editar: setEditando, ui };
}
