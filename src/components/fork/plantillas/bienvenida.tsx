"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, MessageCircle, Upload } from "lucide-react";
import type { ResumenPlantilla } from "@/lib/plantillas/catalogo";
import { cn } from "@/lib/utils";

/**
 * 068 (fork · Hiyou) — El setup en tres pasos (borrador del lienzo «Hiyou CRM
 * — setup y plantillas»): 1) qué tipo de negocio, 2) su marca, 3) WhatsApp y
 * listo. Cada paso queda guardado: si se cae, retoma donde iba.
 */

type Marca = { name: string; accent: string; currency: string; favicon: boolean };

const COLORES: { hex: string; nombre: string }[] = [
  { hex: "#0d5bff", nombre: "Azul" },
  { hex: "#3f6b66", nombre: "Verde" },
  { hex: "#5f5470", nombre: "Ciruela" },
  { hex: "#3f5972", nombre: "Azul acero" },
  { hex: "#4b5563", nombre: "Grafito" },
];

const MONEDAS = [
  { code: "CRC", nombre: "Colones (₡)" },
  { code: "USD", nombre: "Dólares ($)" },
];

function textoAlerta(a: ResumenPlantilla["alerta"]): string {
  if (!a) return "Según cada etapa";
  const t = (m: number) => (m < 60 ? `${m} min` : m === 60 ? "1 hora" : `${Math.round(m / 60)} horas`);
  return `Ámbar a los ${t(a.ambarMin)} · rojo a ${a.rojoMin === 60 ? "la hora" : t(a.rojoMin)}`;
}

async function enviar(url: string, init: RequestInit): Promise<string | null> {
  const res = await fetch(url, init).catch(() => null);
  if (res?.ok) return null;
  const j = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
  return j?.error?.message ?? "No se pudo guardar. Revise su conexión e intente de nuevo.";
}

export function Bienvenida({
  plantillas,
  actual,
  pasoInicial,
  marca,
  esPropietario,
}: {
  plantillas: ResumenPlantilla[];
  actual: string | null;
  pasoInicial: number;
  marca: Marca;
  esPropietario: boolean;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState(Math.min(Math.max(pasoInicial, 1), 3));
  const [elegida, setElegida] = useState<string>(actual ?? plantillas[0]?.clave ?? "general");
  const [nombre, setNombre] = useState(marca.name);
  const [color, setColor] = useState(marca.accent);
  const [moneda, setMoneda] = useState(MONEDAS.some((m) => m.code === marca.currency) ? marca.currency : "CRC");
  const [logo, setLogo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const pl = plantillas.find((p) => p.clave === elegida) ?? plantillas[0]!;

  async function paso1() {
    setTrabajando(true);
    setError(null);
    const e = await enviar("/api/plantillas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clave: elegida }) });
    setTrabajando(false);
    if (e) return setError(e);
    setPaso(2);
  }

  async function paso2() {
    if (!nombre.trim()) return setError("Escriba el nombre de su negocio.");
    setTrabajando(true);
    setError(null);
    if (esPropietario) {
      const e = await enviar("/api/settings/branding", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nombre.trim().slice(0, 30), accent: color, currency: moneda }),
      });
      if (e) {
        setTrabajando(false);
        return setError(e);
      }
    }
    const e2 = await enviar("/api/negocio", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ setupPaso: 3 }) });
    setTrabajando(false);
    if (e2) return setError(e2);
    setPaso(3);
  }

  async function subirLogo(f: File) {
    setError(null);
    const e = await enviar("/api/settings/branding/favicon", { method: "PUT", headers: { "content-type": f.type || "application/octet-stream" }, body: f });
    if (e) return setError(e);
    setLogo(URL.createObjectURL(f));
  }

  async function terminar() {
    setTrabajando(true);
    const e = await enviar("/api/negocio", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ setupPaso: null }) });
    setTrabajando(false);
    if (e) return setError(e);
    router.push("/");
    router.refresh();
  }

  const PASOS = ["Su negocio", "Su marca", "WhatsApp"];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[15px] font-extrabold text-white" style={{ background: color }} aria-hidden>
            {(nombre.trim() || "H").charAt(0).toUpperCase()}
          </span>
          <span className="text-[17px] font-extrabold tracking-tight">{nombre.trim() || "Su CRM"}</span>
        </div>
        <ol aria-label="Pasos del setup" className="flex items-center gap-2 text-[13px] font-semibold">
          {PASOS.map((t, i) => {
            const n = i + 1;
            const hecho = n < paso;
            const ahora = n === paso;
            return (
              <li key={t} className="flex items-center gap-2" aria-current={ahora ? "step" : undefined}>
                {i > 0 && <span className={cn("h-0.5 w-6 sm:w-8", hecho || ahora ? "bg-success" : "bg-border")} aria-hidden />}
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[12px]",
                    hecho ? "bg-success text-white" : ahora ? "bg-foreground text-background" : "border-2 border-border text-text-3"
                  )}
                >
                  {hecho ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
                </span>
                <span className={cn("hidden sm:inline", !hecho && !ahora && "text-text-3")}>{t}</span>
              </li>
            );
          })}
        </ol>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-4 sm:px-8">
        {paso === 1 && (
          <section aria-labelledby="t1">
            <p className="text-center text-[15px] font-semibold text-brand-text">¡Hola! Empecemos.</p>
            <h1 id="t1" className="mt-2 text-center text-[30px] font-extrabold tracking-tight sm:text-[40px]">
              ¿Qué tipo de negocio tiene?
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-center text-[16px] text-text-2">
              Con esto le dejamos listas las etapas, los nombres y los datos que su negocio necesita. Puede cambiarlo todo después.
            </p>
            <div role="radiogroup" aria-label="Tipo de negocio" className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
              {plantillas.map((p) => {
                const sel = p.clave === elegida;
                return (
                  <button
                    key={p.clave}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    onClick={() => setElegida(p.clave)}
                    className={cn(
                      "rounded-2xl border-2 bg-background p-5 text-left transition-shadow [@media(pointer:coarse)]:min-h-11",
                      sel ? "border-foreground shadow-md" : "border-border hover:shadow-sm"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[17px] font-bold">{p.nombre}</span>
                      {p.demo && <span className="rounded-full bg-warning-tint px-2 py-0.5 text-[11.5px] font-semibold text-warning-text">Inventado, para probar</span>}
                    </span>
                    <span className="mt-1 block text-[14px] text-text-2">{p.descripcion}</span>
                    <span className="mt-3 block text-[12.5px] text-text-3">{p.etapas.join(" → ")}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {paso === 2 && (
          <section aria-labelledby="t2" className="grid gap-10 lg:grid-cols-2">
            <div className="space-y-6">
              <div>
                <h1 id="t2" className="text-[30px] font-extrabold tracking-tight sm:text-[38px]">
                  Pongámosle su marca
                </h1>
                <p className="mt-2 text-[16px] text-text-2">Así lo verán usted y su equipo todos los días.</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="b-nombre" className="text-[14px] font-bold">
                  Nombre del negocio
                </label>
                <input
                  id="b-nombre"
                  value={nombre}
                  maxLength={30}
                  onChange={(e) => setNombre(e.target.value)}
                  className="h-12 w-full rounded-xl border border-border bg-background px-4 text-[16px] outline-none focus:border-foreground"
                />
              </div>
              {esPropietario && (
                <div className="space-y-2">
                  <span className="text-[14px] font-bold">
                    Logo <span className="font-medium text-text-3">(puede dejarlo para después)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => archivo.current?.click()}
                    className="flex h-16 w-full items-center gap-3 rounded-xl border-2 border-dashed border-border px-4 text-left text-[14.5px] hover:bg-muted"
                  >
                    {logo || marca.favicon ? (
                      // eslint-disable-next-line @next/next/no-img-element -- vista previa local del archivo elegido
                      <img src={logo ?? "/api/branding/favicon"} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Upload className="h-5 w-5 text-text-2" aria-hidden />
                      </span>
                    )}
                    <span>
                      <b>{logo || marca.favicon ? "Cambiar el logo" : "Subir su logo"}</b> <span className="text-text-3">· PNG, JPG o SVG, hasta 256 KB</span>
                    </span>
                  </button>
                  <input
                    ref={archivo}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
                    className="hidden"
                    aria-label="Archivo del logo"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void subirLogo(f);
                    }}
                  />
                </div>
              )}
              <fieldset className="space-y-3">
                <legend className="mb-3 text-[14px] font-bold">Color de su marca</legend>
                <div className="flex flex-wrap gap-3">
                  {COLORES.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      aria-label={c.nombre}
                      aria-pressed={color === c.hex}
                      onClick={() => setColor(c.hex)}
                      className={cn("h-11 w-11 rounded-full", color === c.hex && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
                      style={{ background: c.hex }}
                    />
                  ))}
                </div>
              </fieldset>
              {esPropietario && (
                <div className="space-y-2">
                  <label htmlFor="b-moneda" className="text-[14px] font-bold">
                    Moneda de sus precios
                  </label>
                  <select
                    id="b-moneda"
                    value={moneda}
                    onChange={(e) => setMoneda(e.target.value)}
                    className="h-12 w-full rounded-xl border border-border bg-background px-3 text-[16px]"
                  >
                    {MONEDAS.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!esPropietario && <p className="text-[13.5px] text-text-3">El nombre, el logo y el color los cambia la persona dueña de la cuenta.</p>}
            </div>
            <div aria-label="Vista previa" className="space-y-2">
              <p className="text-[12px] font-bold uppercase tracking-wider text-text-3">Así se verá</p>
              <div className="overflow-hidden rounded-2xl border border-border shadow-lg">
                <div className="flex">
                  <div className="w-36 space-y-1 border-r border-border bg-muted p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-extrabold text-white" style={{ background: color }}>
                        {(nombre.trim() || "H").charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate text-[12px] font-bold">{nombre.trim() || "Su negocio"}</span>
                    </div>
                    {["Hoy", "Bandeja", pl.embudo, pl.clientes].map((t, i) => (
                      <p key={t + i} className={cn("rounded-md px-2 py-1.5 text-[12.5px]", i === 0 ? "bg-background font-bold" : "text-text-2")}>
                        {t}
                      </p>
                    ))}
                  </div>
                  <div className="flex-1 space-y-2 p-4">
                    <div className="rounded-xl p-4 text-white" style={{ background: color }}>
                      <p className="text-[19px] font-extrabold">Buenos días</p>
                      <p className="text-[12px] opacity-85">3 clientes esperan respuesta</p>
                    </div>
                    <div className="rounded-xl border border-danger/40 bg-danger-tint p-3">
                      <p className="text-[13px] font-bold">María Solís</p>
                      <p className="text-[11.5px] font-semibold text-danger-text">● Responder · 25 min</p>
                    </div>
                    <div className="rounded-xl border border-border p-3">
                      <p className="text-[13px] font-bold">Andrés Mora</p>
                      <p className="text-[11.5px] text-text-3">{pl.etapas[1] ?? "Seguimiento"} · mañana 10:00</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {paso === 3 && (
          <section aria-labelledby="t3" className="grid gap-10 lg:grid-cols-2">
            <div className="space-y-5">
              <h1 id="t3" className="text-[30px] font-extrabold tracking-tight sm:text-[38px]">
                Conecte su WhatsApp
              </h1>
              <p className="text-[16px] text-text-2">
                Los mensajes de sus clientes llegan aquí y usted contesta con todo su equipo. Su número sigue siendo el mismo.
              </p>
              <ol className="space-y-3 text-[15px]">
                {[
                  "Toque «Conectar WhatsApp» y siga los pasos con su cuenta de Meta.",
                  "Elija el número de su negocio y confírmelo con el código que le llega.",
                  "Listo: el primer mensaje que reciba aparecerá en su Bandeja.",
                ].map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[13px] font-extrabold text-brand-text">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
              <a
                href="/settings/whatsapp"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-success px-6 text-[16px] font-bold text-white hover:opacity-90"
              >
                <MessageCircle className="h-5 w-5" aria-hidden /> Conectar WhatsApp
              </a>
              <p className="text-[13px] text-text-3">Puede hacerlo después en Ajustes → WhatsApp. Al volver aquí, sigue donde iba.</p>
            </div>
            <section aria-labelledby="listo" className="space-y-3 rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-tint">
                  <Check className="h-5 w-5 text-success-text" aria-hidden />
                </span>
                <h2 id="listo" className="text-[19px] font-extrabold">
                  Su CRM ya está listo
                </h2>
              </div>
              <p className="text-[14px] text-text-2">
                Esto le dejamos configurado para <b className="text-foreground">{pl.nombre}</b>:
              </p>
              <dl className="divide-y divide-border text-[14px]">
                {[
                  ["Etapas", pl.etapas.join(" → ")],
                  ["Sus clientes", pl.clientes],
                  ...(pl.catalogo ? [[pl.catalogo, `${pl.serviciosCatalogo} de ejemplo, con precio`]] : []),
                  ["En la ficha", pl.camposDestacados.join(", ") || "Lo básico"],
                  ["Alerta de respuesta", textoAlerta(pl.alerta)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5">
                    <dt className="text-text-3">{k}</dt>
                    <dd className="text-right font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-[13px] text-text-3">Todo se cambia en Ajustes → Mi negocio.</p>
            </section>
          </section>
        )}

        {error && (
          <p role="alert" className="mx-auto mt-6 max-w-3xl rounded-xl bg-danger-tint px-4 py-3 text-[14px] font-semibold text-danger-text">
            {error}
          </p>
        )}

        <div className="mx-auto mt-10 flex max-w-5xl items-center justify-between gap-4 border-t border-border pt-6">
          {paso > 1 ? (
            <button type="button" onClick={() => setPaso(paso - 1)} className="px-1 py-3 text-[15px] font-semibold text-text-2 hover:text-foreground">
              ← Atrás
            </button>
          ) : (
            <span className="text-[14px] text-text-3">
              Eligió <b className="text-foreground">{pl.nombre}</b>
            </span>
          )}
          <div className="flex items-center gap-4">
            {paso === 3 && (
              <button type="button" onClick={() => void terminar()} disabled={trabajando} className="py-3 text-[15px] font-semibold text-text-2 hover:text-foreground">
                Conectar después
              </button>
            )}
            <button
              type="button"
              disabled={trabajando}
              onClick={() => void (paso === 1 ? paso1() : paso === 2 ? paso2() : terminar())}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-7 text-[16px] font-bold text-background disabled:opacity-60"
            >
              {trabajando ? "Guardando…" : paso === 3 ? "Entrar a mi CRM" : "Seguir"}
              {!trabajando && <ArrowRight className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
