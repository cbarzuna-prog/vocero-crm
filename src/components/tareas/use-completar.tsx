"use client";

import { useEffect, useState } from "react";
import { nextBusinessDays, type TaskDto } from "@/lib/tareas";
import { NuevaTareaDialog } from "./nueva-tarea-dialog";

/**
 * 046 — Completar una tarea y ofrecer la siguiente (H4).
 *
 * Completar es optimista e inmediato; el aviso que aparece abajo propone la
 * siguiente con el mismo contacto y tipo, a dos días hábiles. Ignorarlo no
 * cuesta nada: desaparece solo. Así el seguimiento no depende de acordarse de
 * crear la próxima tarea, que es justo lo que se olvida.
 */
export function useCompletarTarea({
  today,
  onChanged,
}: {
  /** Día del negocio, `AAAA-MM-DD`. */
  today: string;
  onChanged: () => void;
}) {
  const [aviso, setAviso] = useState<TaskDto | null>(null);
  const [siguiente, setSiguiente] = useState<TaskDto | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 8000);
    return () => clearTimeout(t);
  }, [aviso]);

  async function toggle(task: TaskDto) {
    const done = !task.doneAt;
    const res = await fetch(`/api/tareas/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ done }),
    }).catch(() => null);
    onChanged();
    if (res?.ok && done) setAviso(task);
  }

  async function remove(task: TaskDto) {
    if (!window.confirm(`¿Borrar «${task.title}»?`)) return;
    await fetch(`/api/tareas/${task.id}`, { method: "DELETE" }).catch(() => null);
    onChanged();
  }

  const ui = (
    <>
      {aviso && (
        <div
          role="status"
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-popover px-4 py-3 shadow-pop"
        >
          <p className="min-w-0 flex-1 truncate text-sm">
            Hecha: <span className="font-semibold">{aviso.title}</span>
          </p>
          <button
            type="button"
            className="shrink-0 text-sm font-semibold text-brand-text hover:underline"
            onClick={() => {
              setSiguiente(aviso);
              setAviso(null);
            }}
          >
            Crear siguiente
          </button>
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
    </>
  );

  return { toggle, remove, ui };
}
