"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";

/**
 * 067 (fork) — «Datos de contacto» dentro de la ficha: teléfono, correo,
 * origen, quién lo refirió y desde cuándo es cliente. Repite lo del
 * encabezado a propósito (decisión del dueño, 10/11/2026): la ficha es
 * donde se busca todo junto. Lo que falta se dice y se puede agregar.
 */
export type DatosContactoProps = {
  phone: string | null;
  email: string | null;
  origen: string | null;
  referidor: string | null;
  tipos: string | null;
  creado: string;
  ultimaActividad: string;
  onEditar: () => void;
};

/** «+506 8877 6655» para Costa Rica; el resto, con su «+» y sin tocar. */
export function telefonoLegible(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("506")) return `+506 ${d.slice(3, 7)} ${d.slice(7)}`;
  return `+${d}`;
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" });

function Copiar({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copiar ${etiqueta}`}
      title={`Copiar ${etiqueta}`}
      onClick={() => {
        void navigator.clipboard?.writeText(valor).then(() => {
          setHecho(true);
          window.setTimeout(() => setHecho(false), 1500);
        });
      }}
      className="shrink-0 rounded p-1 text-text-3 hover:bg-accent hover:text-foreground [@media(pointer:coarse)]:p-2.5"
    >
      {hecho ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="py-2 text-[13.5px]">
      <dt className="text-[12px] text-text-3">{etiqueta}</dt>
      <dd className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 break-all">{children}</dd>
    </div>
  );
}

export function DatosContacto(p: DatosContactoProps) {
  const falta = (que: string) => (
    <button type="button" onClick={p.onEditar} className="text-left text-text-3 hover:text-foreground hover:underline">
      Sin {que} — agréguelo
    </button>
  );
  const wa = p.phone?.replace(/\D/g, "");
  return (
    <section aria-label="Datos de contacto" className="p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="kicker">Datos de contacto</p>
        <button
          type="button"
          onClick={p.onEditar}
          className="rounded px-1.5 py-1 text-[13px] font-semibold text-text-2 hover:bg-accent [@media(pointer:coarse)]:min-h-11"
        >
          Editar
        </button>
      </div>
      <dl className="divide-y divide-border">
        <Fila etiqueta="Teléfono">
          {p.phone ? (
            <>
              <a href={`tel:+${wa}`} className="font-semibold tabular-nums hover:underline">
                {telefonoLegible(p.phone)}
              </a>
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded px-1.5 py-0.5 text-[12px] font-semibold text-brand-text hover:bg-accent"
              >
                WhatsApp
              </a>
              <Copiar valor={`+${wa}`} etiqueta="el teléfono" />
            </>
          ) : (
            falta("teléfono")
          )}
        </Fila>
        <Fila etiqueta="Correo">
          {p.email ? (
            <>
              <a href={`mailto:${p.email}`} className="font-semibold hover:underline">
                {p.email}
              </a>
              <Copiar valor={p.email} etiqueta="el correo" />
            </>
          ) : (
            falta("correo")
          )}
        </Fila>
        {p.tipos && <Fila etiqueta="Es">{p.tipos}</Fila>}
        <Fila etiqueta="Origen">{p.origen ?? <span className="text-text-3">Sin dato</span>}</Fila>
        {p.referidor && <Fila etiqueta="Referido por">{p.referidor}</Fila>}
        <Fila etiqueta="Cliente desde">{fecha(p.creado)}</Fila>
        <Fila etiqueta="Última actividad">{fecha(p.ultimaActividad)}</Fila>
      </dl>
    </section>
  );
}
