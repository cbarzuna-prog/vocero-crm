"use client";

import { EsperandoAtencion, useAtencionDatos } from "@/components/fork/atencion";
import { BienvenidaHoy } from "@/components/fork/bienvenida-hoy";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarCheck, CircleDashed, Sun } from "lucide-react";
import type { HoyDto } from "@/lib/tareas";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth/client";
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
      <h2
        className={cn(
          "mb-2 flex items-center gap-2 text-[15px] font-bold",
          tone === "danger" ? "text-danger-text" : "text-foreground"
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
        {title}
        <span className="font-semibold text-text-2 tabular-nums">{count}</span>
      </h2>
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
  // Los tratos sin siguiente paso pueden ser muchos: se ven 6 y el resto a pedido.
  const [verTodos, setVerTodos] = useState(false);
  const [creating, setCreating] = useState<{ id: string; name: string } | null | "nuevo">(null);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/tareas?vista=hoy&de=${filtro}`).catch(() => null);
    if (res?.ok) setData((await res.json()) as HoyDto);
  }, [filtro]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEvents({ onTaskChanged: () => void refetch(), onReconnect: () => void refetch() });

  const { data: session } = authClient.useSession();
  const meId = session?.user.id ?? null;
  const atencion = useAtencionDatos(); // 063: un solo pedido para la franja y la lista
  const { toggle, remove, posponer, editar, ui } = useCompletarTarea({
    today: data.today,
    timezone: data.timezone,
    onChanged: () => void refetch(),
  });
  const acciones = { meId, onToggle: toggle, onPosponer: posponer, onEditar: editar, onDelete: remove };

  // La vencida más antigua: la franja dice de cuándo es.
  const masVieja = data.vencidas[0];
  const diasVieja = masVieja
    ? Math.max(1, Math.round((Date.parse(`${data.today}T12:00:00Z`) - Date.parse(masVieja.dueAt)) / 86_400_000))
    : 0;

  const total = data.vencidas.length + data.hoy.length + data.sinSiguientePaso.length;
  const fechaRaw = new Intl.DateTimeFormat("es", {
    timeZone: data.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${data.today}T12:00:00Z`));
  // «Viernes, 23 de octubre»: mayúscula solo al inicio, como se escribe en español.
  const fecha = fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1);
  const horaNegocio = Number(new Intl.DateTimeFormat("en-US", { timeZone: data.timezone, hour: "numeric", hourCycle: "h23" }).format(new Date()));

  return (
    <div className="flex h-full flex-col">

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Escritorio: tareas a la izquierda, tratos sin siguiente paso a la
            derecha (dos preguntas, dos columnas, sin hueco). Celular: una columna. */}
        <div className="mx-auto max-w-6xl">
          {/* 063 — Franja de bienvenida con el día en cuatro números (estilo Kommo). */}
          <div className="mb-6">
            <BienvenidaHoy
              nombre={session?.user.name ?? null}
              fecha={fecha}
              hora={horaNegocio}
              atencion={atencion}
              vencidas={data.vencidas.length}
              diasVencida={diasVieja}
              paraHoy={data.hoy.length}
              visitasHoy={data.hoy.filter((t) => t.type === "visita").length}
              sinSiguiente={data.sinSiguientePaso.length}
              filtro={filtro}
              onFiltro={setFiltro}
              onNueva={() => setCreating("nuevo")}
            />
          </div>
          {/* 062 — Lo que espera contacto según los tiempos de su etapa, lo rojo primero. */}
          <EsperandoAtencion datos={atencion} />
          {total === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              className="h-full py-16"
              title="Todo al día"
              description="No hay tareas vencidas ni para hoy, y todos sus tratos abiertos tienen un siguiente paso."
            />
          ) : (
            <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
              <div>
              {data.vencidas.length > 0 && (
                <Section icon={AlertCircle} title="Vencidas" count={data.vencidas.length} tone="danger">
                  <ul className="space-y-1.5">
                    {data.vencidas.map((t) => (
                      <TareaRow key={t.id} task={t} timezone={data.timezone} withDay overdue {...acciones} />
                    ))}
                  </ul>
                </Section>
              )}

              <Section icon={Sun} title="Para hoy" count={data.hoy.length}>
                {data.hoy.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-3 text-[13px] text-text-2">Nada agendado para hoy.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.hoy.map((t) => (
                      <TareaRow key={t.id} task={t} timezone={data.timezone} {...acciones} />
                    ))}
                  </ul>
                )}
              </Section>
              </div>

              <div>
              {data.sinSiguientePaso.length > 0 && (
                <Section icon={CircleDashed} title="Sin siguiente paso" count={data.sinSiguientePaso.length}>
                  <ul className="space-y-1.5">
                    {(verTodos ? data.sinSiguientePaso : data.sinSiguientePaso.slice(0, 6)).map((l) => (
                      <li key={l.leadId} className="flex items-center gap-3 rounded-lg border border-dashed bg-card px-3 py-2.5">
                        <Link
                          href={`/inbox?contact=${l.contact.id}`}
                          className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <p className="truncate text-[15px] font-[620]">{l.contact.name}</p>
                          <p className="text-[13px] text-text-2">
                            {l.stageName} · {hace(l.lastActivityAt)}
                          </p>
                        </Link>
                        <Button size="sm" variant="secondary" onClick={() => setCreating(l.contact)}>
                          Agendar
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {data.sinSiguientePaso.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setVerTodos((v) => !v)}
                      className="mt-2 min-h-11 text-[13px] font-semibold text-brand-text hover:underline sm:min-h-8"
                    >
                      {verTodos ? "Ver menos" : `Ver los ${data.sinSiguientePaso.length}`}
                    </button>
                  )}
                </Section>
              )}
              </div>
            </div>
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
