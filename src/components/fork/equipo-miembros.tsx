"use client";

import { useState } from "react";
import { KeyRound, Pencil, UserMinus } from "lucide-react";
import { ROL_AYUDA, ROL_LABELS, ROLES_EQUIPO, type RolEquipo } from "@/lib/equipo";
import { cn } from "@/lib/utils";
import { ContactAvatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type MiembroEquipo = { id: string; role: string; name: string; email: string; createdAt: string };

type Abierto = { id: string; que: "editar" | "contrasena" | "quitar" } | null;

function generar(): string {
  const alfabeto = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

async function enviar(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> | null; error?: string }> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  const data = (await res?.json().catch(() => null)) as (Record<string, unknown> & { error?: { message?: string } }) | null;
  if (!res?.ok) return { ok: false, data, error: data?.error?.message ?? "No se pudo completar. Intente de nuevo." };
  return { ok: true, data };
}

/**
 * 054 (fork) — Lista del equipo con acciones: editar nombre, correo y rol,
 * poner una contraseña temporal (y quitar los dos pasos a quien perdió el
 * teléfono) y quitar del equipo. Solo un propietario ve las acciones.
 */
export function EquipoMiembros({
  members,
  meEmail,
  esPropietario,
  onChanged,
}: {
  members: MiembroEquipo[];
  meEmail: string;
  esPropietario: boolean;
  onChanged: () => void;
}) {
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const propietarios = members.filter((m) => m.role === "owner").length;

  return (
    <section className="space-y-2" aria-labelledby="equipo-titulo">
      <h2 id="equipo-titulo" className="text-[15px] font-semibold">
        Equipo · {members.length}
      </h2>
      {aviso && (
        <p role="status" className="rounded-md border border-success-soft bg-success-tint px-3 py-2 text-[13px] text-success-text">
          {aviso}
        </p>
      )}
      <ul className="space-y-2">
        {members.map((m) => {
          const soyYo = m.email.toLowerCase() === meEmail.toLowerCase();
          const abiertoAqui = abierto?.id === m.id ? abierto.que : null;
          const cerrar = () => setAbierto(null);
          const listo = (msg: string) => {
            setAbierto(null);
            setAviso(msg);
            onChanged();
          };
          return (
            <li key={m.id} className="rounded-lg border bg-card">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <ContactAvatar name={m.name} seed={m.id} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-[620]">
                    {m.name}
                    {soyYo && <span className="font-normal text-text-3"> (usted)</span>}
                  </p>
                  <p className="truncate text-[13px] text-text-2">{m.email}</p>
                </div>
                <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                  {ROL_LABELS[m.role as RolEquipo] ?? m.role}
                </Badge>
                {esPropietario && (
                  <div className="flex w-full justify-end gap-1 sm:w-auto">
                    <Button size="sm" variant="ghost" aria-label={`Editar a ${m.name}`} title="Editar nombre, correo o rol" onClick={() => setAbierto(abiertoAqui === "editar" ? null : { id: m.id, que: "editar" })}>
                      <Pencil className="h-4 w-4" /> <span className="sm:sr-only">Editar</span>
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Contraseña de ${m.name}`} title="Poner contraseña temporal" onClick={() => setAbierto(abiertoAqui === "contrasena" ? null : { id: m.id, que: "contrasena" })}>
                      <KeyRound className="h-4 w-4" /> <span className="sm:sr-only">Contraseña</span>
                    </Button>
                    {!soyYo && (
                      <Button size="sm" variant="ghost" className="text-danger-text" aria-label={`Quitar a ${m.name} del equipo`} title="Quitar del equipo" onClick={() => setAbierto(abiertoAqui === "quitar" ? null : { id: m.id, que: "quitar" })}>
                        <UserMinus className="h-4 w-4" /> <span className="sm:sr-only">Quitar</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {abiertoAqui === "editar" && (
                <Editar m={m} ultimoPropietario={m.role === "owner" && propietarios <= 1} onCancel={cerrar} onDone={() => listo(`Se guardaron los cambios de ${m.name}.`)} />
              )}
              {abiertoAqui === "contrasena" && <Contrasena m={m} soyYo={soyYo} onCancel={cerrar} onDone={onChanged} />}
              {abiertoAqui === "quitar" && (
                <Quitar
                  m={m}
                  onCancel={cerrar}
                  onDone={(n) =>
                    listo(`${m.name} ya no está en el equipo.${n > 0 ? ` Sus ${n} ${n === 1 ? "tarea pendiente pasó" : "tareas pendientes pasaron"} a usted.` : ""}`)
                  }
                />
              )}
            </li>
          );
        })}
      </ul>
      {!esPropietario && <p className="text-[13px] text-text-3">Solo un propietario puede editar o quitar personas del equipo.</p>}
    </section>
  );
}

const panel = "space-y-3 border-t bg-subtle px-4 py-3";

function Editar({ m, ultimoPropietario, onCancel, onDone }: { m: MiembroEquipo; ultimoPropietario: boolean; onCancel: () => void; onDone: () => void }) {
  const [name, setName] = useState(m.name);
  const [email, setEmail] = useState(m.email);
  const [role, setRole] = useState<RolEquipo>((m.role as RolEquipo) ?? "member");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function guardar() {
    setSaving(true);
    setError(null);
    const cambios: Record<string, string> = {};
    if (name.trim() !== m.name) cambios.name = name.trim();
    if (email.trim().toLowerCase() !== m.email.toLowerCase()) cambios.email = email.trim();
    if (role !== m.role) cambios.role = role;
    if (Object.keys(cambios).length === 0) return onCancel();
    const r = await enviar(`/api/equipo/${m.id}`, "PATCH", cambios);
    setSaving(false);
    if (!r.ok) return setError(r.error ?? null);
    onDone();
  }

  return (
    <div className={panel}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`eq-nombre-${m.id}`}>Nombre</Label>
          <Input id={`eq-nombre-${m.id}`} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`eq-correo-${m.id}`}>Correo para entrar</Label>
          <Input id={`eq-correo-${m.id}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Rol</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES_EQUIPO.map((r) => {
            const bloqueado = ultimoPropietario && r !== "owner";
            return (
              <label
                key={r}
                className={cn(
                  "flex cursor-pointer gap-2 rounded-md border bg-card p-2.5",
                  role === r && "border-brand",
                  bloqueado && "cursor-not-allowed opacity-60"
                )}
              >
                <input type="radio" name={`eq-rol-${m.id}`} className="mt-1" checked={role === r} disabled={bloqueado} onChange={() => setRole(r)} />
                <span>
                  <span className="block text-sm font-semibold">{ROL_LABELS[r]}</span>
                  <span className="block text-[13px] text-text-2">{ROL_AYUDA[r]}</span>
                </span>
              </label>
            );
          })}
        </div>
        {ultimoPropietario && <p className="text-[13px] text-text-3">Es el único propietario: para cambiarle el rol, haga propietario a otra persona primero.</p>}
      </fieldset>
      {error && <p className="text-[13px] text-danger-text">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" disabled={saving || !name.trim() || !email.trim()} onClick={() => void guardar()}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}

function Contrasena({ m, soyYo, onCancel, onDone }: { m: MiembroEquipo; soyYo: boolean; onCancel: () => void; onDone: () => void }) {
  const [password, setPassword] = useState(generar);
  const [quitarDosPasos, setQuitarDosPasos] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function guardar() {
    setSaving(true);
    setError(null);
    const r = await enviar(`/api/equipo/${m.id}/contrasena`, "POST", { password, quitarDosPasos });
    setSaving(false);
    if (!r.ok) return setError(r.error ?? null);
    setHecho(password);
    onDone();
  }

  if (hecho) {
    return (
      <div className={panel}>
        <p className="text-sm font-semibold text-success-text">Contraseña cambiada</p>
        <p className="text-[13px] text-text-2">
          Compártala ahora con {m.name}; no se vuelve a mostrar.{!soyYo && " Sus sesiones abiertas se cerraron."}
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-card px-2 py-1 text-[14px]">{m.email}</code>
          <code className="rounded bg-card px-2 py-1 text-[14px]">{hecho}</code>
          <Button size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(`${m.email}\n${hecho}`)}>
            Copiar
          </Button>
        </p>
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Listo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={panel}>
      <p className="text-[13px] text-text-2">
        Para quien olvidó su contraseña: póngale una temporal y compártala con esa persona. Después la puede cambiar en Ajustes → Seguridad.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor={`eq-pass-${m.id}`}>Contraseña temporal</Label>
        <div className="flex gap-2">
          <Input id={`eq-pass-${m.id}`} value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button size="sm" variant="outline" className="h-auto" onClick={() => setPassword(generar())}>
            Otra
          </Button>
        </div>
      </div>
      <label className="flex items-start gap-2 text-[13px]">
        <input type="checkbox" className="mt-0.5" checked={quitarDosPasos} onChange={(e) => setQuitarDosPasos(e.target.checked)} />
        <span>
          Quitar también la verificación en dos pasos <span className="text-text-3">(si perdió el teléfono; la vuelve a activar en Seguridad)</span>
        </span>
      </label>
      {error && <p className="text-[13px] text-danger-text">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" disabled={saving || password.length < 8} onClick={() => void guardar()}>
          {saving ? "Guardando…" : "Poner contraseña"}
        </Button>
      </div>
    </div>
  );
}

function Quitar({ m, onCancel, onDone }: { m: MiembroEquipo; onCancel: () => void; onDone: (tareas: number) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function quitar() {
    setSaving(true);
    setError(null);
    const r = await enviar(`/api/equipo/${m.id}`, "DELETE");
    setSaving(false);
    if (!r.ok) return setError(r.error ?? null);
    onDone(Number(r.data?.tareasReasignadas ?? 0));
  }

  return (
    <div className={cn(panel, "bg-danger-tint")}>
      <p className="text-sm font-semibold text-danger-text">¿Quitar a {m.name} del equipo?</p>
      <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-text-2">
        <li>Su cuenta se borra y se le cierran las sesiones: ya no puede entrar.</li>
        <li>Sus tareas pendientes pasan a usted. Las conversaciones, contactos y propiedades se quedan.</li>
        <li>No se puede deshacer; si vuelve, se le crea una cuenta nueva.</li>
      </ul>
      {error && <p className="text-[13px] text-danger-text">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" variant="destructive" disabled={saving} onClick={() => void quitar()}>
          {saving ? "Quitando…" : `Sí, quitar a ${m.name.split(" ")[0]}`}
        </Button>
      </div>
    </div>
  );
}
