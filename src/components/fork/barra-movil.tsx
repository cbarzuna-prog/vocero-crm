"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Inbox, Kanban, Menu, Plus, Sun, UserPlus, ListPlus, Home } from "lucide-react";
import { isNavActive } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useEvents } from "@/components/use-events";
import { NewContactDialog } from "@/components/contacts/new-contact-dialog";
import { NuevaTareaDialog } from "@/components/tareas/nueva-tarea-dialog";
import { NuevaPropiedadDialog } from "@/components/propiedades/nueva-propiedad-dialog";

/** Hoy en la zona del navegador: el diálogo deja cambiarlo. */
const hoyLocal = () => new Date().toLocaleDateString("en-CA");

type Creando = "contacto" | "tarea" | "propiedad" | null;

/**
 * 050 (fork) — Crear rápido: contacto, tarea o propiedad desde cualquier
 * pantalla. Un lead que llama por teléfono ya no exige tres pantallas.
 */
export function CrearRapido({
  propiedades,
  variante,
}: {
  propiedades: boolean;
  /** `lateral`: botón ancho en la barra de escritorio. `barra`: el «+» al centro de la barra del celular. */
  variante: "lateral" | "barra";
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [creando, setCreando] = useState<Creando>(null);

  useEffect(() => {
    if (!abierto) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [abierto]);

  const opciones: { id: Exclude<Creando, null>; label: string; icon: typeof Plus }[] = [
    { id: "contacto", label: "Contacto", icon: UserPlus },
    { id: "tarea", label: "Tarea", icon: ListPlus },
    ...(propiedades ? [{ id: "propiedad" as const, label: "Propiedad", icon: Home }] : []),
  ];

  return (
    <div className={variante === "lateral" ? "relative mb-4 hidden lg:block" : "flex flex-1 justify-center"}>
      {variante === "lateral" ? (
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="flex w-full items-center justify-center gap-2 rounded-sm border border-border-strong px-3 py-2 text-[13.5px] font-semibold text-foreground hover:bg-accent"
        >
          <Plus className="h-4 w-4" strokeWidth={2} /> Crear
        </button>
      ) : (
        // En la barra y no flotando: un «+» flotante tapa el renglón que esté debajo.
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-label="Crear contacto, tarea o propiedad"
          className="flex h-16 flex-1 items-center justify-center"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus className={cn("h-6 w-6 transition-transform", abierto && "rotate-45")} strokeWidth={2} />
          </span>
        </button>
      )}

      {abierto && (
        <>
          <button type="button" aria-label="Cerrar" tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setAbierto(false)} />
          <div
            role="menu"
            className={cn(
              "z-40 w-48 overflow-hidden rounded-md border bg-popover py-1 text-foreground shadow-pop",
              variante === "lateral" ? "absolute left-0 right-0 top-full mt-1" : "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 lg:hidden"
            )}
          >
            {opciones.map((o) => (
              <button
                key={o.id}
                type="button"
                role="menuitem"
                className="flex min-h-11 w-full items-center gap-2.5 px-3 text-left text-sm hover:bg-accent"
                onClick={() => {
                  setAbierto(false);
                  setCreando(o.id);
                }}
              >
                <o.icon className="h-4 w-4 text-text-2" strokeWidth={1.8} aria-hidden /> {o.label}
              </button>
            ))}
          </div>
        </>
      )}

      {creando === "contacto" && (
        <NewContactDialog
          onClose={() => setCreando(null)}
          onCreated={() => {
            setCreando(null);
            router.refresh();
          }}
          onOpenExisting={(id) => {
            setCreando(null);
            router.push(`/inbox?contact=${id}`);
          }}
        />
      )}
      {creando === "tarea" && (
        <NuevaTareaDialog
          defaultDay={hoyLocal()}
          onCancel={() => setCreando(null)}
          onCreated={() => {
            setCreando(null);
            router.refresh();
          }}
        />
      )}
      {creando === "propiedad" && <NuevaPropiedadDialog onCancel={() => setCreando(null)} />}
    </div>
  );
}

/**
 * 050 (fork) — Barra inferior en el celular: las pantallas del día a un
 * toque, en vez de todo detrás del menú ☰. «Más» abre el menú completo.
 * Solo existe con los módulos del fork encendidos; sin ellos el celular queda
 * como en upstream.
 */
export function BarraMovil({
  tareas,
  propiedades,
  onMas,
}: {
  tareas: boolean;
  propiedades: boolean;
  onMas: () => void;
}) {
  const pathname = usePathname();
  const [noLeidos, setNoLeidos] = useState(0);
  const [vencidas, setVencidas] = useState(0);

  async function refetch() {
    const [conv, tar] = await Promise.all([
      fetch("/api/conversations").catch(() => null),
      tareas ? fetch("/api/tareas?vista=contador&de=mias").catch(() => null) : Promise.resolve(null),
    ]);
    if (conv?.ok) {
      const d = (await conv.json()) as { conversations: { unreadCount: number }[] };
      setNoLeidos(d.conversations.filter((c) => c.unreadCount > 0).length);
    }
    if (tar?.ok) setVencidas(((await tar.json()) as { vencidas: number }).vencidas);
  }

  useEffect(() => {
    void refetch();
    // Una sola vez por montaje; los eventos la mantienen al día.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEvents({
    onMessageNew: () => void refetch(),
    onConversationUpdated: () => void refetch(),
    onTaskChanged: () => void refetch(),
  });

  // La altura de la barra, para que avisos y contenido no queden debajo.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const aplicar = () => document.documentElement.style.setProperty("--bottom-nav", mq.matches ? "4rem" : "0px");
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => {
      mq.removeEventListener("change", aplicar);
      document.documentElement.style.removeProperty("--bottom-nav");
    };
  }, []);

  const pipeline = { href: "/pipeline", label: "Pipeline", icon: Kanban, badge: 0, danger: false };
  // Cinco celdas: dos a cada lado del «+». Con propiedades, el Pipeline (un
  // tablero ancho, incómodo en el teléfono) queda en «Más».
  const izquierda = [
    ...(tareas ? [{ href: "/hoy", label: "Hoy", icon: Sun, badge: vencidas, danger: true }] : []),
    { href: "/inbox", label: "Bandeja", icon: Inbox, badge: noLeidos, danger: false },
  ];
  const derecha = propiedades
    ? [{ href: "/propiedades", label: "Propiedades", icon: Building2, badge: 0, danger: false }]
    : [pipeline];
  if (!tareas) izquierda.push(...(propiedades ? [pipeline] : []));

  const celda = (it: (typeof izquierda)[number]) => {
    const active = isNavActive(pathname, it.href);
    return (
      <Link
        key={it.href}
        href={it.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[12px] font-semibold",
          active ? "text-foreground" : "text-text-2"
        )}
      >
        <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-accent")}>
          <it.icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
        </span>
        {it.label}
        {it.badge > 0 && (
          <span
            className={cn(
              "absolute right-[calc(50%-1.6rem)] top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums",
              it.danger ? "bg-destructive text-destructive-foreground" : "bg-brand text-brand-fg"
            )}
          >
            {it.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Pantallas principales"
        className="flex shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {izquierda.map(celda)}
        <CrearRapido propiedades={propiedades} variante="barra" />
        {derecha.map(celda)}
        <button
          type="button"
          onClick={onMas}
          className="flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[12px] font-semibold text-text-2"
        >
          <span className="flex h-7 w-12 items-center justify-center">
            <Menu className="h-5 w-5" strokeWidth={1.8} aria-hidden />
          </span>
          Más
        </button>
      </nav>
    </>
  );
}
