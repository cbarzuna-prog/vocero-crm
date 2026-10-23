"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, ArrowLeft, ImagePlus, Lock, Star, Trash2, X } from "lucide-react";
import { parseMoneyToCents } from "@/lib/money";
import {
  formatPrecio,
  INTEREST_LABELS,
  MAX_PHOTOS,
  OPERATION_LABELS,
  PROPERTY_OPERATIONS,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  STATUS_LABELS,
  TYPE_LABELS,
  type DiscardReason,
  type InterestStatus,
  type PropertyDetail,
  type PropertyStatus,
} from "@/lib/propiedades";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Buscador, buscarContactos, Cover, InteresEstado, selectClass, StatusBadge, UbicacionFields } from "./shared";

/** Lo editable de la ficha, como lo maneja el formulario (precio y comisión como texto). */
type Draft = {
  title: string;
  operation: PropertyDetail["operation"];
  type: PropertyDetail["type"];
  precio: string;
  currency: PropertyDetail["currency"];
  provincia: string;
  canton: string | null;
  distrito: string;
  zona: string;
  m2Construccion: string;
  m2Terreno: string;
  habitaciones: string;
  banos: string;
  parqueos: string;
  descripcionPublica: string;
  notasInternas: string;
  seller: { id: string; name: string } | null;
  comision: string;
  exclusiva: boolean;
  captadaAt: string;
  urlExterna: string;
};

const num = (v: number | null) => (v === null ? "" : String(v));

function toDraft(p: PropertyDetail): Draft {
  return {
    title: p.title,
    operation: p.operation,
    type: p.type,
    precio: p.priceCents === null ? "" : String(p.priceCents / 100),
    currency: p.currency,
    provincia: p.provincia,
    canton: p.canton,
    distrito: p.distrito ?? "",
    zona: p.zona ?? "",
    m2Construccion: num(p.m2Construccion),
    m2Terreno: num(p.m2Terreno),
    habitaciones: num(p.habitaciones),
    banos: num(p.banos),
    parqueos: num(p.parqueos),
    descripcionPublica: p.descripcionPublica ?? "",
    notasInternas: p.notasInternas ?? "",
    seller: p.seller,
    comision: p.comisionBp === null ? "" : String(p.comisionBp / 100),
    exclusiva: p.exclusiva,
    captadaAt: p.captadaAt ?? "",
    urlExterna: p.urlExterna ?? "",
  };
}

const intOrNull = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s))));
const textOrNull = (s: string) => (s.trim() === "" ? null : s.trim());

/** Draft → cuerpo del PATCH. `null` si hay algo que no se puede guardar. */
function toPatch(d: Draft): { body: Record<string, unknown> } | { error: string } {
  const priceCents = d.precio.trim() ? parseMoneyToCents(d.precio) : null;
  if (d.precio.trim() && priceCents === null) return { error: "El precio no es un número válido" };
  const comision = d.comision.trim() ? Number(d.comision.replace(",", ".")) : null;
  if (comision !== null && (Number.isNaN(comision) || comision < 0 || comision > 100)) {
    return { error: "La comisión va de 0 a 100 %" };
  }
  const banos = d.banos.trim() ? Math.round(Number(d.banos.replace(",", ".")) * 2) / 2 : null;
  if (banos !== null && Number.isNaN(banos)) return { error: "Los baños no son un número válido" };
  if (!d.title.trim()) return { error: "El título no puede ir vacío" };
  return {
    body: {
      title: d.title.trim(),
      operation: d.operation,
      type: d.type,
      priceCents,
      currency: d.currency,
      provincia: d.provincia,
      canton: d.canton,
      distrito: textOrNull(d.distrito),
      zona: textOrNull(d.zona),
      m2Construccion: intOrNull(d.m2Construccion),
      m2Terreno: intOrNull(d.m2Terreno),
      habitaciones: intOrNull(d.habitaciones),
      banos,
      parqueos: intOrNull(d.parqueos),
      descripcionPublica: textOrNull(d.descripcionPublica),
      notasInternas: textOrNull(d.notasInternas),
      sellerContactId: d.seller?.id ?? null,
      comisionBp: comision === null ? null : Math.round(comision * 100),
      exclusiva: d.exclusiva,
      captadaAt: d.captadaAt || null,
      urlExterna: textOrNull(d.urlExterna),
    },
  };
}

function Field({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Galeria({ p, onChanged }: { p: PropertyDetail; onChanged: () => Promise<void> }) {
  const [sel, setSel] = useState(0);
  const [subiendo, setSubiendo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const photo = p.photos[sel] ?? p.photos[0] ?? null;

  useEffect(() => {
    if (sel >= p.photos.length) setSel(Math.max(0, p.photos.length - 1));
  }, [p.photos.length, sel]);

  async function subir(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const lista = [...files].slice(0, MAX_PHOTOS - p.photos.length);
    setSubiendo(lista.length);
    for (const file of lista) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/propiedades/${p.id}/fotos`, { method: "POST", body: form }).catch(() => null);
      if (!res?.ok) {
        const body = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(`${file.name}: ${body?.error?.message ?? "no se pudo subir"}`);
      }
      setSubiendo((n) => n - 1);
    }
    if (inputRef.current) inputRef.current.value = "";
    await onChanged();
  }

  async function portada() {
    if (!photo || sel === 0) return;
    const ids = [photo.id, ...p.photos.filter((x) => x.id !== photo.id).map((x) => x.id)];
    await fetch(`/api/propiedades/${p.id}/fotos`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => null);
    setSel(0);
    await onChanged();
  }

  async function borrar() {
    if (!photo || !window.confirm("¿Borrar esta foto?")) return;
    await fetch(`/api/propiedades/${p.id}/fotos/${photo.id}`, { method: "DELETE" }).catch(() => null);
    await onChanged();
  }

  return (
    <section>
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border">
        <Cover url={photo?.url ?? null} alt={p.title} />
        {photo && (
          <div className="absolute bottom-2 right-2 flex gap-1.5">
            {sel !== 0 && (
              <Button size="sm" variant="secondary" onClick={() => void portada()}>
                <Star className="mr-1 h-3.5 w-3.5" strokeWidth={1.8} /> Portada
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => void borrar()} aria-label="Borrar foto">
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Button>
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {p.photos.map((ph, i) => (
          <button
            key={ph.id}
            type="button"
            onClick={() => setSel(i)}
            aria-label={`Foto ${i + 1}${i === 0 ? " (portada)" : ""}`}
            className={cn(
              "h-14 w-20 shrink-0 overflow-hidden rounded-md border-2",
              i === sel ? "border-brand" : "border-transparent"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ph.url} alt="" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
        {p.photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo > 0}
            className="flex h-14 w-20 shrink-0 flex-col items-center justify-center rounded-md border-2 border-dashed text-[11px] font-semibold text-text-2 hover:border-brand hover:text-brand-text"
          >
            <ImagePlus className="h-4 w-4" strokeWidth={1.8} />
            {subiendo > 0 ? `Subiendo ${subiendo}…` : "Fotos"}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          aria-label="Subir fotos"
          onChange={(e) => void subir(e.target.files)}
        />
      </div>
      {error && <p className="mt-1 text-xs text-danger-text">{error}</p>}
    </section>
  );
}

function Interesados({ p, onChanged }: { p: PropertyDetail; onChanged: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);

  async function vincular(contactId: string) {
    setError(null);
    const res = await fetch("/api/interes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contactId, propertyId: p.id }),
    }).catch(() => null);
    if (!res?.ok) setError("No se pudo vincular");
    await onChanged();
  }

  async function cambiar(interestId: string, status: InterestStatus, discardReason?: DiscardReason | null) {
    await fetch(`/api/interes/${interestId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, discardReason: discardReason ?? null }),
    }).catch(() => null);
    await onChanged();
  }

  async function quitar(interestId: string, name: string) {
    if (!window.confirm(`¿Quitar a ${name} de esta propiedad? Si ya no le interesa, mejor márcala como descartada: así queda la historia.`)) return;
    await fetch(`/api/interes/${interestId}`, { method: "DELETE" }).catch(() => null);
    await onChanged();
  }

  const vigentes = p.interesadosDetalle.filter((i) => i.status !== "descartada").length;

  return (
    <section className="rounded-lg border bg-card p-4">
      <p className="kicker mb-3">
        Compradores interesados · {vigentes}
      </p>
      <Buscador placeholder="Vincular un comprador…" fetchOptions={buscarContactos} onPick={(o) => void vincular(o.id)} />
      {error && <p className="mt-1 text-xs text-danger-text">{error}</p>}
      {p.interesadosDetalle.length === 0 ? (
        <p className="mt-3 text-[13px] text-text-3">Nadie vinculado todavía.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {p.interesadosDetalle.map((i) => (
            <li key={i.interestId} className={cn("flex items-start gap-2 py-2.5", i.status === "descartada" && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <Link href={`/inbox?contact=${i.contact.id}`} className="block truncate text-sm font-[620] hover:underline">
                  {i.contact.name}
                </Link>
                <div className="mt-1">
                  <InteresEstado
                    status={i.status}
                    label={`Estado de ${i.contact.name}`}
                    onChange={(s, r) => void cambiar(i.interestId, s, r)}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => void quitar(i.interestId, i.contact.name)}
                aria-label={`Quitar a ${i.contact.name}`}
                className="mt-0.5 rounded p-1 text-text-3 hover:text-danger-text"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 046 — Ficha de una propiedad: galería, datos, lo interno aparte e interesados (H1–H3). */
export function FichaClient({ initial }: { initial: PropertyDetail }) {
  const [p, setP] = useState(initial);
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const base = useMemo(() => JSON.stringify(toDraft(p)), [p]);
  const dirty = JSON.stringify(draft) !== base;

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/propiedades/${p.id}`).catch(() => null);
    if (res?.ok) setP(((await res.json()) as { property: PropertyDetail }).property);
  }, [p.id]);

  // Si nadie está editando, lo que viene del servidor manda.
  useEffect(() => {
    if (!dirty) setDraft(toDraft(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  const set = (patch: Partial<Draft>) => {
    setGuardado(false);
    setDraft((d) => ({ ...d, ...patch }));
  };

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/propiedades/${p.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) {
      const b = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new Error(b?.error?.message ?? "No se pudo guardar");
    }
  }

  async function guardar() {
    const r = toPatch(draft);
    if ("error" in r) {
      setError(r.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await patch(r.body);
      await refetch();
      setGuardado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function cambiarEstado(status: PropertyStatus) {
    await patch({ status }).catch(() => {});
    await refetch();
  }

  async function archivar() {
    if (!p.archived && !window.confirm("¿Archivar esta propiedad? Deja de verse en la lista; puedes restaurarla.")) return;
    await patch({ archived: !p.archived }).catch(() => {});
    await refetch();
  }

  const precio = formatPrecio(p.priceCents, p.currency);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 sm:px-6">
        <Link href="/propiedades" className="rounded p-1 text-text-2 hover:text-foreground" aria-label="Volver a Propiedades">
          <ArrowLeft className="h-5 w-5" strokeWidth={1.8} />
        </Link>
        {/* En el teléfono el título se queda con la fila y las acciones bajan. */}
        <div className="min-w-[70%] flex-1 sm:min-w-0">
          <p className="truncate text-xs font-semibold text-text-3">
            {p.code} · {OPERATION_LABELS[p.operation]} · {TYPE_LABELS[p.type]}
          </p>
          <h2 className="truncate text-[17px] font-bold tracking-tight">{p.title}</h2>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            aria-label="Estado de la propiedad"
            className={cn(selectClass, "h-8 text-xs font-semibold")}
            value={p.status}
            onChange={(e) => void cambiarEstado(e.target.value as PropertyStatus)}
          >
            {PROPERTY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={() => void archivar()}>
            {p.archived ? <ArchiveRestore className="mr-1 h-4 w-4" /> : <Archive className="mr-1 h-4 w-4" />}
            {p.archived ? "Restaurar" : "Archivar"}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24">
        {p.archived && (
          <p className="mb-4 rounded-md border border-warning-soft bg-warning-tint px-3 py-2 text-sm text-warning-text">
            Esta propiedad está archivada: no aparece en la lista.
          </p>
        )}
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Galeria p={p} onChanged={refetch} />

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-2xl font-bold tracking-tight">
                {precio ?? <span className="text-text-3">Sin precio</span>}
                {precio && p.operation === "alquiler" && <span className="text-sm font-semibold text-text-3"> /mes</span>}
              </p>
              <StatusBadge status={p.status} />
              <p className="w-full text-sm text-text-2">
                {[p.zona, p.distrito, p.canton, p.provincia].filter(Boolean).join(", ")}
              </p>
            </div>

            <section className="rounded-lg border bg-card p-4">
              <p className="kicker mb-3">Datos</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Título" htmlFor="f-title" className="col-span-2 sm:col-span-4">
                  <Input id="f-title" value={draft.title} maxLength={160} onChange={(e) => set({ title: e.target.value })} />
                </Field>
                <Field label="Operación" htmlFor="f-op">
                  <select id="f-op" className={cn(selectClass, "w-full")} value={draft.operation} onChange={(e) => set({ operation: e.target.value as Draft["operation"] })}>
                    {PROPERTY_OPERATIONS.map((o) => (
                      <option key={o} value={o}>
                        {OPERATION_LABELS[o]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tipo" htmlFor="f-type">
                  <select id="f-type" className={cn(selectClass, "w-full")} value={draft.type} onChange={(e) => set({ type: e.target.value as Draft["type"] })}>
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Precio" htmlFor="f-precio">
                  <Input id="f-precio" inputMode="decimal" value={draft.precio} onChange={(e) => set({ precio: e.target.value })} />
                </Field>
                <Field label="Moneda" htmlFor="f-moneda">
                  <select id="f-moneda" className={cn(selectClass, "w-full")} value={draft.currency} onChange={(e) => set({ currency: e.target.value as Draft["currency"] })}>
                    <option value="USD">US$</option>
                    <option value="CRC">₡ colones</option>
                  </select>
                </Field>
                <div className="col-span-2">
                  <UbicacionFields
                    provincia={draft.provincia}
                    canton={draft.canton}
                    onChange={(v) => set(v)}
                    idPrefix="ficha"
                  />
                </div>
                <Field label="Distrito" htmlFor="f-distrito">
                  <Input id="f-distrito" value={draft.distrito} maxLength={80} onChange={(e) => set({ distrito: e.target.value })} />
                </Field>
                <Field label="Zona o condominio" htmlFor="f-zona">
                  <Input id="f-zona" value={draft.zona} maxLength={120} onChange={(e) => set({ zona: e.target.value })} />
                </Field>
                <Field label="m² construcción" htmlFor="f-m2c">
                  <Input id="f-m2c" inputMode="numeric" value={draft.m2Construccion} onChange={(e) => set({ m2Construccion: e.target.value.replace(/[^\d]/g, "") })} />
                </Field>
                <Field label="m² terreno" htmlFor="f-m2t">
                  <Input id="f-m2t" inputMode="numeric" value={draft.m2Terreno} onChange={(e) => set({ m2Terreno: e.target.value.replace(/[^\d]/g, "") })} />
                </Field>
                <Field label="Habitaciones" htmlFor="f-hab">
                  <Input id="f-hab" inputMode="numeric" value={draft.habitaciones} onChange={(e) => set({ habitaciones: e.target.value.replace(/[^\d]/g, "") })} />
                </Field>
                <Field label="Baños" htmlFor="f-banos">
                  <Input id="f-banos" inputMode="decimal" placeholder="2.5" value={draft.banos} onChange={(e) => set({ banos: e.target.value.replace(/[^\d.,]/g, "") })} />
                </Field>
                <Field label="Parqueos" htmlFor="f-parq">
                  <Input id="f-parq" inputMode="numeric" value={draft.parqueos} onChange={(e) => set({ parqueos: e.target.value.replace(/[^\d]/g, "") })} />
                </Field>
              </div>
            </section>

            <section className="rounded-lg border bg-card p-4">
              <p className="kicker mb-1">Descripción para el comprador</p>
              <p className="mb-2 text-xs text-text-3">Lo que le puedes mandar o enseñar tal cual.</p>
              <Textarea
                rows={5}
                maxLength={5000}
                value={draft.descripcionPublica}
                onChange={(e) => set({ descripcionPublica: e.target.value })}
                placeholder="Casa de dos niveles en condominio con seguridad 24/7, a 5 minutos de Multiplaza…"
              />
            </section>

            {/* D9 — lo interno, separado y marcado: quien comparte pantalla con
                un comprador debe saber de un vistazo qué no enseñar. */}
            <section className="rounded-lg border border-dashed bg-subtle p-4">
              <p className="kicker mb-1 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Interno · no compartir
              </p>
              <p className="mb-3 text-xs text-text-3">Vendedor, comisión y notas: nunca se muestran al comprador.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Vendedor" className="col-span-2">
                  {draft.seller ? (
                    <div className="flex h-9 items-center gap-2">
                      <Link href={`/inbox?contact=${draft.seller.id}`} className="truncate text-sm font-[620] hover:underline">
                        {draft.seller.name}
                      </Link>
                      <button type="button" className="text-xs text-text-3 hover:text-foreground" onClick={() => set({ seller: null })}>
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <Buscador
                      placeholder="Buscar contacto…"
                      fetchOptions={buscarContactos}
                      onPick={(o) => set({ seller: { id: o.id, name: o.label } })}
                    />
                  )}
                </Field>
                <Field label="Comisión %" htmlFor="f-com">
                  <Input id="f-com" inputMode="decimal" placeholder="5" value={draft.comision} onChange={(e) => set({ comision: e.target.value.replace(/[^\d.,]/g, "") })} />
                </Field>
                <Field label="Exclusiva">
                  <div className="flex h-9 items-center">
                    <Switch checked={draft.exclusiva} onCheckedChange={(v) => set({ exclusiva: v })} label="Exclusiva" />
                  </div>
                </Field>
                <Field label="Fecha de captación" htmlFor="f-capt">
                  <Input id="f-capt" type="date" value={draft.captadaAt} onChange={(e) => set({ captadaAt: e.target.value })} />
                </Field>
                <Field label="Anuncio en portal (URL)" htmlFor="f-url" className="col-span-2 sm:col-span-3">
                  <Input id="f-url" type="url" placeholder="https://" value={draft.urlExterna} onChange={(e) => set({ urlExterna: e.target.value })} />
                </Field>
                <Field label="Notas internas" htmlFor="f-notas" className="col-span-2 sm:col-span-4">
                  <Textarea id="f-notas" rows={3} maxLength={5000} value={draft.notasInternas} onChange={(e) => set({ notasInternas: e.target.value })} />
                </Field>
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
            <Interesados p={p} onChanged={refetch} />
            <p className="px-1 text-xs text-text-3">
              Pasos: {(["interesado", "enviada", "visitada", "oferto", "ganada"] as const).map((s) => INTEREST_LABELS[s]).join(" → ")}
            </p>
          </aside>
        </div>
      </div>

      {(dirty || error || guardado) && (
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-popover px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          {error ? (
            <p className="mr-auto text-xs text-danger-text">{error}</p>
          ) : guardado && !dirty ? (
            <p className="mr-auto text-xs text-success-text">Guardado</p>
          ) : (
            <p className="mr-auto text-xs text-text-3">Cambios sin guardar</p>
          )}
          {dirty && (
            <>
              <Button variant="ghost" size="sm" onClick={() => { setDraft(toDraft(p)); setError(null); }}>
                Descartar
              </Button>
              <Button size="sm" onClick={() => void guardar()} disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
