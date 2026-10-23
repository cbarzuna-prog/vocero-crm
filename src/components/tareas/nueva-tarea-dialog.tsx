"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, MoreHorizontal, Phone, Search, MapPin } from "lucide-react";
import { TASK_TYPE_LABELS, type TaskType } from "@/lib/tareas";
import { TASK_TYPES } from "@/lib/tareas-enums";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const TASK_TYPE_ICONS: Record<TaskType, typeof Phone> = {
  llamada: Phone,
  whatsapp: MessageCircle,
  visita: MapPin,
  otro: MoreHorizontal,
};

type ContactOption = { id: string; name: string };

/**
 * 046 — Crear una tarea con lo mínimo: título y fecha (D8). La fecha es día +
 * hora DEL NEGOCIO; sin hora es «todo el día». Con `contact` fijo (desde una
 * conversación o un trato) no se pregunta a quién; desde «Hoy» se busca.
 */
export function NuevaTareaDialog({
  contact,
  defaultDay,
  defaultType = "llamada",
  defaultTitle = "",
  onCancel,
  onCreated,
}: {
  contact?: ContactOption | null;
  /** `AAAA-MM-DD` en la zona del negocio. */
  defaultDay: string;
  defaultType?: TaskType;
  defaultTitle?: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [type, setType] = useState<TaskType>(defaultType);
  const [day, setDay] = useState(defaultDay);
  const [time, setTime] = useState("");
  const [picked, setPicked] = useState<ContactOption | null>(contact ?? null);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ContactOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (picked) titleRef.current?.focus();
  }, [picked]);

  useEffect(() => {
    if (picked || query.trim().length < 2) {
      setOptions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/contacts?q=${encodeURIComponent(query.trim())}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { contacts: [] }))
        .then((d: { contacts: ContactOption[] }) => setOptions(d.contacts.slice(0, 8)))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, picked]);

  async function save() {
    if (!picked || !title.trim() || !day) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/tareas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contactId: picked.id,
        title: title.trim(),
        type,
        day,
        time: time || null,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const body = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "No se pudo guardar. Intenta de nuevo.");
      return;
    }
    onCreated();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Nueva tarea"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      {/* Móvil: hoja desde abajo, al alcance del pulgar. Escritorio: modal. */}
      <form
        className="w-full rounded-t-xl border bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-pop sm:max-w-md sm:rounded-lg"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h3 className="font-semibold">Nueva tarea</h3>

        {contact ? (
          <p className="mt-0.5 text-xs text-text-3">{contact.name}</p>
        ) : picked ? (
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="mt-2 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand-text"
          >
            {picked.name} · cambiar
          </button>
        ) : (
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="¿Con quién? Busca un contacto…"
              aria-label="Buscar contacto"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
            {options.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover shadow-pop">
                {options.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => setPicked(o)}
                    >
                      {o.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <label className="mt-3 block text-xs font-medium" htmlFor="tarea-titulo">
          Qué hay que hacer
        </label>
        <Input
          id="tarea-titulo"
          ref={titleRef}
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Llamar para agendar segunda visita"
          className="mt-1"
        />

        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo">
          {TASK_TYPES.map((t) => {
            const Icon = TASK_TYPE_ICONS[t];
            const active = t === type;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setType(t)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-brand bg-brand-tint text-brand-text"
                    : "border-border-strong text-text-2 hover:border-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                {TASK_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium" htmlFor="tarea-dia">
              Día
            </label>
            <Input
              id="tarea-dia"
              type="date"
              required
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium" htmlFor="tarea-hora">
              Hora <span className="font-normal text-text-3">(opcional)</span>
            </label>
            <Input
              id="tarea-hora"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        {error && <p className="mt-2 text-xs text-danger-text">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !picked || !title.trim() || !day}>
            {saving ? "Guardando…" : "Guardar tarea"}
          </Button>
        </div>
      </form>
    </div>
  );
}
