"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Handshake } from "lucide-react";
import type { ReferidorFila } from "@/lib/contactos";
import { EmptyState } from "@/components/ui/empty-state";
import { cuando } from "./contactos-client";

/**
 * 058 (fork) — Los referidores del sitio y lo que trajo cada uno. Los crea
 * solo el primer lead que llega por su enlace (`?ref=CÓDIGO`); el nombre
 * lleva a sus contactos ya filtrados.
 */
export function ReferidosClient() {
  const [filas, setFilas] = useState<ReferidorFila[] | null>(null);
  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/referidos").catch(() => null);
      setFilas(r?.ok ? ((await r.json()) as { referidos: ReferidorFila[] }).referidos : []);
    })();
  }, []);

  const total = filas?.reduce((a, r) => ({ leads: a.leads + r.leads, cierres: a.cierres + r.cierres }), { leads: 0, cierres: 0 });

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-4 py-3 sm:px-6 sm:py-4">
        <h1 className="text-[22px] font-bold tracking-tight">Referidos</h1>
        <p className="text-[13px] text-text-2 tabular-nums">
          {filas === null
            ? " "
            : `${filas.length} ${filas.length === 1 ? "referidor" : "referidores"} · ${total!.leads} leads · ${total!.cierres} ${total!.cierres === 1 ? "cierre" : "cierres"}`}
        </p>
      </header>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filas === null ? (
          <div className="h-40 animate-pulse rounded-lg border bg-card" aria-busy="true" />
        ) : filas.length === 0 ? (
          <EmptyState
            icon={Handshake}
            className="h-full"
            title="Sin referidos todavía"
            description="Cuando alguien llegue a su sitio por el enlace de un referidor y deje sus datos, el referidor aparece aquí con todo lo que trajo."
          />
        ) : (
          <div className="mx-auto max-w-5xl overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-[14px]">
              <thead className="bg-subtle text-left text-[12px] font-semibold text-text-2">
                <tr>
                  <th className="px-4 py-2.5">Referidor</th>
                  <th className="px-3 py-2.5 text-right">Leads</th>
                  <th className="px-3 py-2.5 text-right">En juego</th>
                  <th className="px-3 py-2.5 text-right">Visitaron</th>
                  <th className="px-3 py-2.5 text-right">Cierres</th>
                  <th className="px-4 py-2.5">Último lead</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filas.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/contacts?referidor=${r.id}`} className="font-[620] hover:underline">
                        {r.nombre}
                      </Link>
                      <span className="block text-[13px] text-text-3">{[r.codigo, r.email, r.telefono].filter(Boolean).join(" · ") || "—"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.leads}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.activos}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.visitas}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{r.cierres > 0 ? <span className="text-success-text">{r.cierres}</span> : 0}</td>
                    <td className="px-4 py-2.5 text-[13px] text-text-2">{r.ultimoLead ? cuando(r.ultimoLead) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
