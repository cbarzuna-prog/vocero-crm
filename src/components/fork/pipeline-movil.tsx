"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageSquareText, Trophy, XCircle } from "lucide-react";
import type { StageDto } from "@/lib/types";
import { formatMoneyCents, sumable } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ContactAvatar } from "@/components/avatar";
import { formatTime } from "@/components/inbox/helpers";
import { PriorityBadge } from "@/components/pipeline/priority-picker";
import type { BoardLead } from "@/components/pipeline/pipeline-client";

const ETAPA_KEY = "kk.pipeline.etapa";

/** Total de una etapa en la moneda del negocio, y lo que quedó fuera. */
export function totalEtapa(leads: readonly Pick<BoardLead, "amountCents" | "currency">[], moneda: string) {
  let totalCents = 0;
  let sinMonto = 0;
  let otraMoneda = 0;
  for (const l of leads) {
    if (l.amountCents === null) sinMonto++;
    else if (!sumable({ amountCents: l.amountCents, currency: l.currency }, moneda)) otraMoneda++;
    else totalCents += l.amountCents;
  }
  return { totalCents, sinMonto, otraMoneda, conMonto: leads.length - sinMonto - otraMoneda };
}

/**
 * 052 (fork) — El pipeline en el celular: una etapa a la vez, con pestañas,
 * en vez de un tablero de columnas de 256 px que obliga a deslizar de lado.
 * Tocar un trato abre el MISMO cajón del tablero (mover de etapa, monto,
 * prioridad), así que las reglas —perder exige motivo— siguen en un solo
 * sitio. El tablero de escritorio queda intacto.
 */
export function PipelineMovil({
  stages,
  leads,
  currency,
  onOpen,
  onEditAmount,
}: {
  stages: StageDto[];
  leads: BoardLead[];
  currency: string;
  onOpen: (lead: BoardLead) => void;
  onEditAmount: (lead: BoardLead) => void;
}) {
  const [etapaId, setEtapaId] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // La última etapa que miró (solo este navegador); si ya no existe, la primera.
  useEffect(() => {
    if (etapaId && stages.some((s) => s.id === etapaId)) return;
    let guardada: string | null = null;
    try {
      guardada = window.localStorage.getItem(ETAPA_KEY);
    } catch {
      /* sin almacenamiento */
    }
    setEtapaId(stages.find((s) => s.id === guardada)?.id ?? stages[0]?.id ?? null);
  }, [stages, etapaId]);

  // La pestaña activa siempre a la vista.
  useEffect(() => {
    tabsRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [etapaId]);

  function elegir(id: string) {
    setEtapaId(id);
    try {
      window.localStorage.setItem(ETAPA_KEY, id);
    } catch {
      /* la elección dura la visita */
    }
  }

  const etapa = stages.find((s) => s.id === etapaId) ?? null;
  const deEtapa = leads.filter((l) => l.stageId === etapaId).sort((a, b) => a.position - b.position);
  const t = totalEtapa(deEtapa, currency);

  return (
    <div className="flex h-full flex-col">
      <div
        ref={tabsRef}
        role="tablist"
        aria-label="Etapas"
        className="flex shrink-0 gap-1.5 overflow-x-auto border-b px-4 py-2 [scrollbar-width:none]"
      >
        {stages.map((s) => {
          const n = leads.filter((l) => l.stageId === s.id).length;
          const activa = s.id === etapaId;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => elegir(s.id)}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold transition-colors",
                activa ? "border-foreground bg-foreground text-background" : "border-border-strong text-text-2"
              )}
            >
              {s.kind === "won" && <Trophy className="h-3.5 w-3.5" aria-hidden />}
              {s.kind === "lost" && <XCircle className="h-3.5 w-3.5" aria-hidden />}
              {s.name}
              <span className={cn("tabular-nums", activa ? "opacity-80" : "text-text-3")}>{n}</span>
            </button>
          );
        })}
      </div>

      {etapa && (
        <div role="tabpanel" aria-label={etapa.name} className="flex-1 overflow-y-auto">
          <p className="px-4 pb-1 pt-3 text-[13px] text-text-2">
            {deEtapa.length === 0
              ? "Nadie en esta etapa"
              : `${deEtapa.length} ${deEtapa.length === 1 ? "trato" : "tratos"}`}
            {t.conMonto > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-foreground tabular-nums">{formatMoneyCents(t.totalCents, currency)}</span>
                {t.sinMonto > 0 && ` · ${t.sinMonto} sin monto`}
              </>
            )}
            {t.otraMoneda > 0 && <span className="text-warning-text"> · {t.otraMoneda} en otra moneda, fuera del total</span>}
          </p>

          {deEtapa.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-text-3">
              Cuando alguien llegue a «{etapa.name}», aparecerá aquí.
            </p>
          ) : (
            <ul className="divide-y border-y bg-card">
              {deEtapa.map((lead) => (
                <li key={lead.id} className="flex items-center gap-1 pr-2">
                  <button
                    type="button"
                    onClick={() => onOpen(lead)}
                    aria-label={`Abrir el trato de ${lead.contact.name}`}
                    className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left active:bg-row-hover"
                  >
                    <ContactAvatar name={lead.contact.name} seed={lead.contact.id} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] font-[620]">{lead.contact.name}</span>
                        {lead.priority && <PriorityBadge value={lead.priority} />}
                      </span>
                      <span className="block text-[13px] text-text-3">
                        {lead.lastActivityAt ? `Actividad: ${formatTime(lead.lastActivityAt)}` : "Sin actividad"}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditAmount(lead)}
                    className={cn(
                      "flex h-11 shrink-0 items-center rounded px-2 text-[14px] tabular-nums",
                      lead.amountCents === null ? "text-text-3" : "font-semibold"
                    )}
                    aria-label={lead.amountCents === null ? `Agregar monto a ${lead.contact.name}` : `Cambiar monto de ${lead.contact.name}`}
                  >
                    {lead.amountCents === null ? "+ monto" : formatMoneyCents(lead.amountCents, lead.currency ?? currency)}
                  </button>
                  {lead.conversationId && (
                    <Link
                      href={`/inbox?contact=${lead.contact.id}`}
                      aria-label={`Abrir la conversación con ${lead.contact.name}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-2 active:bg-accent"
                    >
                      <MessageSquareText className="h-5 w-5" strokeWidth={1.8} />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
