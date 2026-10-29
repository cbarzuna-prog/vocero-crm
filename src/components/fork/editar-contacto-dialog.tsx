"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialogo } from "./dialogo";

/** 057 (fork) — Editar nombre, notas y si el agente le responde (misma API de upstream). */
export function EditarContactoDialog({
  contacto,
  onClose,
  onSaved,
}: {
  contacto: { id: string; name: string; notes: string | null; aiPaused: boolean };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(contacto.name);
  const [notes, setNotes] = useState(contacto.notes ?? "");
  const [aiPaused, setAiPaused] = useState(contacto.aiPaused);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function guardar() {
    if (!name.trim()) return setError("Escriba el nombre.");
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/contacts/${contacto.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), notes, ...(aiPaused !== contacto.aiPaused ? { aiPaused } : {}) }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return setError("No se pudo guardar. Intente de nuevo.");
    onSaved();
  }

  return (
    <Dialogo titulo="Editar contacto" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="ec-nombre">
            Nombre<span className="text-danger-text" aria-hidden> *</span>
          </label>
          <Input id="ec-nombre" required aria-required="true" aria-invalid={!!error && !name.trim()} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="ec-notas">
            Notas
          </label>
          <Textarea id="ec-notas" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={aiPaused} onChange={(e) => setAiPaused(e.target.checked)} />
          <span>
            El agente no le responde
            <span className="block text-[13px] text-text-3">Sus mensajes llegan a la Bandeja y los atiende usted.</span>
          </span>
        </label>
        {error && (
          <p role="alert" className="text-[13px] text-danger-text">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </Dialogo>
  );
}
