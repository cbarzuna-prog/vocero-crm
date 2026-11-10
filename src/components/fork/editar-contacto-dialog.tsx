"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialogo } from "./dialogo";

/** 057 (fork) — Editar nombre, notas y si el agente le responde (misma API de upstream). 067: también teléfono y correo. */
export function EditarContactoDialog({
  contacto,
  onClose,
  onSaved,
}: {
  contacto: { id: string; name: string; notes: string | null; aiPaused: boolean; phone?: string | null; email?: string | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(contacto.name);
  const [notes, setNotes] = useState(contacto.notes ?? "");
  const [aiPaused, setAiPaused] = useState(contacto.aiPaused);
  const telInicial = contacto.phone ? `+${contacto.phone}` : "";
  const [telefono, setTelefono] = useState(telInicial);
  const [correo, setCorreo] = useState(contacto.email ?? "");
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
    if (!res?.ok) {
      setSaving(false);
      return setError("No se pudo guardar. Intente de nuevo.");
    }
    // 067 — Teléfono (atributo del contacto) y correo (de la ficha), solo si cambiaron.
    const motivo = async (r: Response | null) => ((await r?.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message;
    if (telefono.trim() !== telInicial) {
      const r = await fetch(`/api/contactos/${contacto.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: telefono.trim() || null }),
      }).catch(() => null);
      if (!r?.ok) {
        setSaving(false);
        return setError((await motivo(r)) ?? "No se pudo guardar el teléfono.");
      }
    }
    if (correo.trim() !== (contacto.email ?? "")) {
      const r = await fetch(`/api/contacts/${contacto.id}/perfil`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: correo.trim() }),
      }).catch(() => null);
      if (!r?.ok) {
        setSaving(false);
        return setError(r?.status === 422 ? "Ese correo no parece válido." : "No se pudo guardar el correo.");
      }
    }
    setSaving(false);
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="ec-telefono">
              Teléfono
            </label>
            <Input id="ec-telefono" type="tel" inputMode="tel" autoComplete="off" placeholder="8888 8888" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="ec-correo">
              Correo
            </label>
            <Input id="ec-correo" type="email" autoComplete="off" placeholder="nombre@correo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </div>
        </div>
        <p className="-mt-1 text-[12.5px] text-text-3">Puede dejarlos vacíos. Un número de 8 dígitos se guarda con el +506.</p>
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
