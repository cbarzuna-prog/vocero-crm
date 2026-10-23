"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarCheck, CircleDashed, Plus, Sun } from "lucide-react";
import type { HoyDto } from "@/lib/tareas";
import { cn } from "@/lib/utils";
import { useEvents } from "@/components/use-events";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NuevaTareaDialog } from "@/components/tareas/nueva-tarea-dialog";
import { TareaRow } from "@/components/tareas/tarea-row";
import { useCompletarTarea } from "@/components/tareas/use-completar";

type Filtro = "mias" | "todas";

/** «Hace 12 días», para medir el olvido de un trato sin siguiente paso. */
function hace(iso: string | null): string {
  if (!iso) return "sin actividad";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

function Section({
  icon: Icon,
  title,
  count,
  tone = "neutral",
  children,
}: {
  icon: typeof Sun;
  title: string;
  count: number;
  tone?: "danger" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h3
        className={cn(
          "mb-2 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide",
          tone === "danger" ? "text-danger-text" : "text-text-2"
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
        {title}
        <span className="font-semibold text-text-3">· {count}</span>
      </h3>
      {children}
    </section>
  );
}

/**
 * 046 — «Hoy»: la respuesta a «¿qué hago hoy?» (H5).
 *
 * Orden fijo y a propósito: lo vencido arriba y en rojo (es lo que ya está
 * costando), luego lo de hoy, y al final los tratos sin siguiente paso — los
 * que nadie va a recordar porque no tienen ninguna tarea que los recuerde.
 */
export function HoyClient({ initial }: { initial: HoyDto }) {
  const [data, setData] = useState<HoyDto>(initial);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [creating, setCreating] = useState<{ id: string; name: string } | null | "nuevo">(null);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/tareas?vista=hoy&de=${filtro}`).catch(() => null);
    if (res?.ok) setData((await res.json()) as HoyDto);
  }, [filtro]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEvents({ onTaskChanged: () => void refetch(), onReconnect: () => void refetch() });

  const { toggle, ui } = useCompletarTarea({ today: data.today, onChanged: () => void refetch() });

  const total = data.vencidas.length + data.hoy.length + data.sinSiguientePaso.length;
  const fechaRaw = new Intl.DateTimeFormat("es", {
    timeZone: data.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${data.today}T12:00:00Z`));
  // «Viernes, 23 de octubre»: mayúscula solo al inicio, como se escribe en español.
  const fecha = fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
        <div>
          <h2 className="text-[17px] font-bold tracking-tight">Hoy</h2>
          <p className="text-xs text-text-3">{fecha}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border p-0.5" role="radiogroup" aria-label="Qué tareas ver">
            {(["todas", "mias"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filtro === f}
                onClick={() => setFiltro(f)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  filtro === f ? "bg-brand-tint text-brand-text" : "text-text-2 hover:text-foreground"
                )}
              >
                {f === "todas" ? "Todas" : "Mías"}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setCreating("nuevo")}>
            <Plus className="mr-1 h-4 w-4" strokeWidth={2} />
            Tarea
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl">
          {total === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              className="h-full py-16"
              title="Todo al día"
              description="No hay tareas vencidas ni para hoy, y todos sus tratos abiertos tienen un siguiente paso."
            />
          ) : (
            <>
              {data.vencidas.length > 0 && (
                <Section icon={AlertCircle} title="Vencidas" count={data.vencidas.length} tone="danger">
                  <ul className="space-y-1.5">
                    {data.vencidas.map((t) => (
                      <TareaRow key={t.id} task={t} timezone={data.timezone} withDay overdue onToggle={toggle} />
                    ))}
                  </ul>
                </Section>
              )}

              <Section icon={Sun} title="Para hoy" count={data.hoy.length}>
                {data.hoy.length === 0 ? (
                  <p className="text-[13px] text-text-3">Nada agendado para hoy.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.hoy.map((t) => (
                      <TareaRow key={t.id} task={t} timezone={data.timezone} onToggle={toggle} />
                    ))}
                  </ul>
                )}
              </Section>

              {data.sinSiguientePaso.length > 0 && (
                <Section icon={CircleDashed} title="Sin siguiente paso" count={data.sinSiguientePaso.length}>
                  <ul className="space-y-1.5">
                    {data.sinSiguientePaso.map((l) => (
                      <li key={l.leadId} className="flex items-center gap-3 rounded-lg border border-dashed bg-card px-3 py-2.5">
                        <Link
                          href={`/inbox?contact=${l.contact.id}`}
                          className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <p className="truncate text-[14px] font-[620]">{l.contact.name}</p>
                          <p className="text-xs text-text-3">
                            {l.stageName} · {hace(l.lastActivityAt)}
                          </p>
                        </Link>
                        <Button size="sm" variant="secondary" onClick={() => setCreating(l.contact)}>
                          Agendar
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </>
          )}
        </div>
      </div>

      {creating && (
        <NuevaTareaDialog
          contact={creating === "nuevo" ? null : creating}
          defaultDay={data.today}
          onCancel={() => setCreating(null)}
          onCreated={() => {
            setCreating(null);
            void refetch();
          }}
        />
      )}
      {ui}
    </div>
  );
}
