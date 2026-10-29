"use client";

import { useEffect, useRef, useState } from "react";
import type { SourceValue, StageDto } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { selectClass } from "@/components/propiedades/shared";
import { Dialogo } from "./dialogo";

const ORIGENES: { value: SourceValue; label: string }[] = [
  { value: "referido", label: "Referido" },
  { value: "organico", label: "Redes o sitio web" },
  { value: "conocido", label: "Conocido" },
  { value: "anuncio", label: "Anuncio" },
  { value: "otro", label: "Otro" },
];

/** Códigos de país más comunes para Knock Knock (compradores locales y extranjeros). */
export const PAISES = [
  { codigo: "506", label: "🇨🇷 +506", digitos: 8 },
  { codigo: "1", label: "🇺🇸 +1", digitos: 10 },
  { codigo: "52", label: "🇲🇽 +52", digitos: 10 },
  { codigo: "34", label: "🇪🇸 +34", digitos: 9 },
  { codigo: "", label: "Otro país", digitos: 0 },
] as const;

/**
 * Teléfono completo (solo dígitos, con código de país) a partir de lo que
 * escribió la persona. Si ya pegó el número con su código («+506 8888…»,
 * «1 305…»), se respeta.
 */
export function telefonoCompleto(codigo: string, numero: string): string {
  const d = numero.replace(/\D/g, "");
  if (!codigo) return d;
  if (numero.trim().startsWith("+")) return d;
  return d.startsWith(codigo) && d.length > PAISES.find((p) => p.codigo === codigo)!.digitos ? d : codigo + d;
}

export function errorTelefono(codigo: string, numero: string): string | null {
  const d = numero.replace(/\D/g, "");
  if (!d) return "Escriba el teléfono: es con el que la persona aparece en WhatsApp.";
  const pais = PAISES.find((p) => p.codigo === codigo);
  const completo = telefonoCompleto(codigo, numero);
  if (pais && pais.digitos && completo.length !== codigo.length + pais.digitos) {
    return `Un número de ${pais.label.split(" ")[0]} tiene ${pais.digitos} dígitos (sin el código).`;
  }
  if (completo.length < 11 || completo.length > 15) return "Escríbalo con el código de país, por ejemplo +44 20 7946 0958.";
  return null;
}

/**
 * 056 (fork) — Alta de un contacto que no llegó por WhatsApp. Reemplaza el
 * diálogo de upstream en el fork: abre en un portal (no dentro de la barra),
 * código de país con +506 por defecto, campos obligatorios marcados y el
 * botón siempre activo: si falta algo, se dice debajo de ese campo.
 */
export function NuevoContactoDialog({
  onClose,
  onCreated,
  onOpenExisting,
}: {
  onClose: () => void;
  onCreated: () => void;
  onOpenExisting: (contactId: string) => void;
}) {
  const [name, setName] = useState("");
  const [codigo, setCodigo] = useState<string>("506");
  const [numero, setNumero] = useState("");
  const [source, setSource] = useState<SourceValue>("referido");
  const [notes, setNotes] = useState("");
  const [stages, setStages] = useState<StageDto[] | null>(null);
  const [stageId, setStageId] = useState("");
  const [intentado, setIntentado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicado, setDuplicado] = useState<{ id: string; name: string } | null>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const telRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/pipeline/stages").catch(() => null);
      if (!res?.ok) return setStages([]);
      const abiertas = ((await res.json()) as { stages: StageDto[] }).stages.filter((s) => s.kind === "open");
      setStages(abiertas);
      setStageId(abiertas[0]?.id ?? "");
    })();
  }, []);

  const errNombre = name.trim() ? null : "Escriba el nombre.";
  const errTel = errorTelefono(codigo, numero);

  async function guardar() {
    setIntentado(true);
    if (errNombre) return nombreRef.current?.focus();
    if (errTel) return telRef.current?.focus();
    setSaving(true);
    setError(null);
    setDuplicado(null);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        phone: telefonoCompleto(codigo, numero),
        source,
        notes: notes.trim() || undefined,
        stageId: stageId || undefined,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res) return setError("No se pudo guardar. Revise su conexión e intente de nuevo.");
    const data = (await res.json().catch(() => null)) as { error?: { message?: string }; contact?: { id: string; name: string } } | null;
    if (res.status === 409 && data?.contact) return setDuplicado({ id: data.contact.id, name: data.contact.name });
    if (!res.ok) return setError(data?.error?.message ?? "No se pudo guardar el contacto.");
    onCreated();
  }

  const obligatorio = <span className="text-danger-text" aria-hidden> *</span>;

  return (
    <Dialogo
      titulo="Nuevo contacto"
      descripcion="Para quien no llegó por WhatsApp: un referido, alguien que llamó o escribió por otra red, un conocido."
      onClose={onClose}
    >
      <form
        noValidate
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="nc-nombre">
            Nombre{obligatorio}
          </label>
          <Input
            ref={nombreRef}
            id="nc-nombre"
            data-autofocus
            required
            aria-required="true"
            aria-invalid={intentado && !!errNombre}
            aria-describedby={intentado && errNombre ? "nc-nombre-err" : undefined}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ana Mora – busca lote en Escazú"
          />
          {intentado && errNombre && (
            <p id="nc-nombre-err" className="text-[13px] text-danger-text">
              {errNombre}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="nc-tel">
            Teléfono (WhatsApp){obligatorio}
          </label>
          <div className="flex gap-2">
            <select
              aria-label="Código de país"
              className={cn(selectClass, "w-[7.5rem] shrink-0")}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            >
              {PAISES.map((p) => (
                <option key={p.codigo || "otro"} value={p.codigo}>
                  {p.label}
                </option>
              ))}
            </select>
            <Input
              ref={telRef}
              id="nc-tel"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              required
              aria-required="true"
              aria-invalid={intentado && !!errTel}
              aria-describedby={intentado && errTel ? "nc-tel-err" : "nc-tel-ayuda"}
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder={codigo === "506" ? "8888 1234" : codigo ? "Número sin el código" : "+44 20 7946 0958"}
            />
          </div>
          {intentado && errTel ? (
            <p id="nc-tel-err" className="text-[13px] text-danger-text">
              {errTel}
            </p>
          ) : (
            <p id="nc-tel-ayuda" className="text-[13px] text-text-3">
              Con el código de país, WhatsApp lo reconoce como la misma persona cuando le escriba.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="nc-origen">
              ¿De dónde llegó?
            </label>
            <select id="nc-origen" className={cn(selectClass, "w-full")} value={source} onChange={(e) => setSource(e.target.value as SourceValue)}>
              {ORIGENES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="nc-etapa">
              Etapa inicial
            </label>
            <select id="nc-etapa" className={cn(selectClass, "w-full")} value={stageId} onChange={(e) => setStageId(e.target.value)}>
              {(stages ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="nc-notas">
            Notas <span className="font-normal text-text-3">(opcional)</span>
          </label>
          <Textarea
            id="nc-notas"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Lo refirió Juan. Busca casa de 3 habitaciones en Santa Ana para mudarse en enero."
          />
        </div>

        {duplicado && (
          <div role="status" className="rounded-md border border-warning-soft bg-warning-tint px-3 py-2.5">
            <p className="text-[13px] text-warning-text">
              Ese teléfono ya es de <strong>{duplicado.name}</strong>. No se creó un duplicado.
            </p>
            <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => onOpenExisting(duplicado.id)}>
              Abrir su conversación
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-[13px] text-danger-text">
            {error}
          </p>
        )}
        {stages?.length === 0 && (
          <p className="text-[13px] text-warning-text">El pipeline no tiene etapas abiertas. Cree una en el Pipeline antes de agregar contactos.</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || stages?.length === 0}>
            {saving ? "Guardando…" : "Crear contacto"}
          </Button>
        </div>
      </form>
    </Dialogo>
  );
}
