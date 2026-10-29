"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 050 — «Enviar ficha»: manda por WhatsApp la descripción compartible y las
 * primeras fotos al comprador, y su estado pasa a «Ficha enviada». El
 * resultado se dice en la misma línea, sin diálogo.
 */
export function EnviarFicha({
  propertyId,
  contact,
  onSent,
  compacto = false,
}: {
  propertyId: string;
  contact: { id: string; name: string };
  onSent?: () => void;
  compacto?: boolean;
}) {
  const [estado, setEstado] = useState<{ tipo: "listo" | "error"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    setEstado(null);
    const res = await fetch(`/api/propiedades/${propertyId}/enviar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contactId: contact.id }),
    }).catch(() => null);
    setEnviando(false);
    const body = (await res?.json().catch(() => null)) as
      | { mensajes?: number; fotosFallidas?: number; error?: { message?: string } }
      | null;
    if (!res?.ok) {
      setEstado({ tipo: "error", texto: body?.error?.message ?? "No se pudo enviar. Intente de nuevo." });
      return;
    }
    const fotos = Math.max(0, (body?.mensajes ?? 1) - 1);
    setEstado({
      tipo: "listo",
      texto: `Enviada a ${contact.name}${fotos ? ` con ${fotos} ${fotos === 1 ? "foto" : "fotos"}` : ""}${body?.fotosFallidas ? ` (${body.fotosFallidas} no salieron)` : ""}.`,
    });
    onSent?.();
  }

  return (
    <div className={cn(!compacto && "w-full")}>
      <button
        type="button"
        onClick={() => void enviar()}
        disabled={enviando}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-brand-text hover:underline disabled:opacity-60 sm:min-h-8"
      >
        {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" strokeWidth={1.8} />}
        {enviando ? "Enviando…" : "Enviar ficha"}
      </button>
      {estado && (
        <p role="status" className={cn("mt-0.5 text-[13px]", estado.tipo === "error" ? "text-danger-text" : "text-success-text")}>
          {estado.texto}
        </p>
      )}
    </div>
  );
}
