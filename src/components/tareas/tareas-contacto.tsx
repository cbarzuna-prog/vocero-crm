"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { TaskDto } from "@/lib/tareas";
import { dayIsoInTz } from "@/lib/time/slots";
import { useEvents } from "@/components/use-events";
import { NuevaTareaDialog } from "./nueva-tarea-dialog";
import { TareaRow } from "./tarea-row";
import { useCompletarTarea } from "./use-completar";

type Data = { today: string; timezone: string; pendientes: TaskDto[]; hechas: TaskDto[] };

/**
 * 046 — Sección «Tareas» del panel de contacto y del trato.
 *
 * Se monta siempre y decide sola si existe: con `TAREAS` apagada la API
 * responde 404 y la sección no se pinta. Así la costura en los componentes de
 * upstream es UNA línea, sin bajar banderas por props.
 */
export function TareasContacto({ contact }: { contact: { id: string; name: string } }) {
  const [data, setData] = useState<Data | null>(null);
  const [creating, setCreating] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/tareas?vista=contacto&contactId=${contact.id}`).catch(() => null);
    if (!res?.ok) {
      setData(null);
      return;
    }
    setData((await res.json()) as Data);
  }, [contact.id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEvents({
    onTaskChanged: ({ contactId }) => {
      if (contactId === contact.id) void refetch();
    },
  });

  const { toggle, remove, ui } = useCompletarTarea({
    today: data?.today ?? new Date().toISOString().slice(0, 10),
    onChanged: () => void refetch(),
  });

  if (!data) return null;

  return (
    <section className="border-b p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="kicker">Tareas</p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 rounded text-xs font-semibold text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Nueva
        </button>
      </div>

      {data.pendientes.length === 0 ? (
        <p className="text-[13px] text-text-3">
          Sin siguiente paso.{" "}
          <button
            type="button"
            className="font-semibold text-brand-text hover:underline"
            onClick={() => setCreating(true)}
          >
            Agenda uno
          </button>
        </p>
      ) : (
        <ul className="space-y-1.5">
          {data.pendientes.map((t) => (
            <TareaRow
              key={t.id}
              task={t}
              timezone={data.timezone}
              withDay
              overdue={dayIsoInTz(new Date(t.dueAt), data.timezone) < data.today}
              showContact={false}
              onToggle={toggle}
              onDelete={remove}
            />
          ))}
        </ul>
      )}

      {data.hechas.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="text-xs text-text-3 hover:text-foreground"
          >
            {showDone ? "Ocultar hechas" : `Ver hechas (${data.hechas.length})`}
          </button>
          {showDone && (
            <ul className="mt-1.5 space-y-1.5">
              {data.hechas.map((t) => (
                <TareaRow
                  key={t.id}
                  task={t}
                  timezone={data.timezone}
                  withDay
                  showContact={false}
                  onToggle={toggle}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {creating && (
        <NuevaTareaDialog
          contact={contact}
          defaultDay={data.today}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void refetch();
          }}
        />
      )}
      {ui}
    </section>
  );
}
