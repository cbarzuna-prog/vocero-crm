"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  formatPrecio,
  type DiscardReason,
  type InterestStatus,
  type PropiedadesDeContactoDto,
} from "@/lib/propiedades";
import { cn } from "@/lib/utils";
import { EnviarFicha } from "./enviar-ficha";
import { Buscador, buscarPropiedades, Cover, InteresEstado } from "./shared";

/**
 * 046 — Sección «Propiedades» del panel de contacto y del trato (H2, H3):
 * lo que esta persona vende y lo que le interesa, con su estado.
 *
 * Igual que las tareas: se monta siempre y desaparece sola si la instancia no
 * tiene `PROPIEDADES` (la API responde 404).
 */
export function PropiedadesContacto({ contact }: { contact: { id: string; name: string } }) {
  const [data, setData] = useState<PropiedadesDeContactoDto | null>(null);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/contacts/${contact.id}/propiedades`).catch(() => null);
    setData(res?.ok ? ((await res.json()) as PropiedadesDeContactoDto) : null);
  }, [contact.id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  if (!data) return null;

  async function vincular(propertyId: string) {
    await fetch("/api/interes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contactId: contact.id, propertyId }),
    }).catch(() => null);
    await refetch();
  }

  async function cambiar(interestId: string, status: InterestStatus, discardReason?: DiscardReason | null) {
    await fetch(`/api/interes/${interestId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, discardReason: discardReason ?? null }),
    }).catch(() => null);
    await refetch();
  }

  return (
    <section className="border-b p-4">
      <p className="kicker mb-2">Propiedades</p>

      {data.vende.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[13px] font-semibold text-text-2">Vende</p>
          <ul className="space-y-1.5">
            {data.vende.map((p) => (
              <li key={p.id}>
                <Link href={`/propiedades/${p.id}`} className="flex items-center gap-2.5 rounded-md border bg-card p-1.5 hover:bg-accent">
                  <span className="h-10 w-12 shrink-0 overflow-hidden rounded">
                    <Cover url={p.coverUrl} alt="" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-[620]">{p.title}</span>
                    <span className="block truncate text-[13px] text-text-3">
                      {p.code} · {formatPrecio(p.priceCents, p.currency) ?? "sin precio"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mb-1.5 text-[13px] font-semibold text-text-2">Le interesan</p>
      {data.interes.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {data.interes.map((i) => (
            <li key={i.interestId} className={cn("rounded-md border bg-card p-1.5", i.status === "descartada" && "opacity-60")}>
              <Link href={`/propiedades/${i.property.id}`} className="flex items-center gap-2.5 rounded hover:bg-accent">
                <span className="h-10 w-12 shrink-0 overflow-hidden rounded">
                  <Cover url={i.property.coverUrl} alt="" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-[620]">{i.property.title}</span>
                  <span className="block truncate text-[13px] text-text-3">
                    {i.property.code} · {formatPrecio(i.property.priceCents, i.property.currency) ?? "sin precio"}
                  </span>
                </span>
              </Link>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 pl-1">
                <InteresEstado
                  status={i.status}
                  label={`Estado con ${i.property.code}`}
                  onChange={(s, r) => void cambiar(i.interestId, s, r)}
                />
                {i.status !== "descartada" && i.status !== "ganada" && (
                  <EnviarFicha compacto propertyId={i.property.id} contact={contact} onSent={() => void refetch()} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Buscador placeholder="Vincular una propiedad…" fetchOptions={buscarPropiedades} onPick={(o) => void vincular(o.id)} />
    </section>
  );
}
