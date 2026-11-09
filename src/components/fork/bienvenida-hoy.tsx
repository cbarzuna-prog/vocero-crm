"use client";

import { Plus } from "lucide-react";
import type { AtencionDto } from "@/lib/atencion";
import { textoEspera } from "@/lib/atencion";
import { cn } from "@/lib/utils";

type Filtro = "mias" | "todas";

/** «Buenos días» / «Buenas tardes» / «Buenas noches» según la hora del negocio. */
export function saludo(hora: number): string {
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

function Cifra({ titulo, valor, detalle, tono }: { titulo: string; valor: number; detalle: string; tono?: "rojo" }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3">
      <p className="text-[13px] text-[#cfe0e8]">{titulo}</p>
      <p className={cn("mt-0.5 text-[30px] font-extrabold leading-tight tabular-nums tracking-tight sm:text-[34px]", tono === "rojo" && valor > 0 && "text-[#ffb3ad]")}>{valor}</p>
      <p className="truncate text-[12px] text-[#a9c6d3]">{detalle}</p>
    </div>
  );
}

/**
 * 063 (fork) — La franja de bienvenida de «Hoy» (estilo Kommo): el saludo, la
 * fecha y el día en cuatro números grandes, con el filtro y «+ Tarea» a mano.
 */
export function BienvenidaHoy({
  nombre,
  fecha,
  hora,
  atencion,
  vencidas,
  diasVencida = 0,
  paraHoy,
  visitasHoy,
  sinSiguiente,
  filtro,
  onFiltro,
  onNueva,
}: {
  nombre: string | null;
  fecha: string;
  hora: number;
  atencion: AtencionDto | null;
  vencidas: number;
  diasVencida?: number;
  paraHoy: number;
  visitasHoy: number;
  sinSiguiente: number;
  filtro: Filtro;
  onFiltro: (f: Filtro) => void;
  onNueva: () => void;
}) {
  const esperan = (atencion?.pendientes ?? []).filter((p) => p.motivo !== "tarea_vencida");
  const masVieja = esperan[0];
  return (
    <section aria-label="Resumen del día" className="rounded-[20px] bg-[#083f59] px-5 py-5 text-white sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium text-[#a9c6d3]">{fecha}</p>
          <h1 className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">
            {saludo(hora)}
            {nombre ? `, ${nombre.split(" ")[0]}` : ""}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-[10px] bg-white/[0.12] p-[3px]" role="radiogroup" aria-label="Qué tareas ver">
            {(["todas", "mias"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filtro === f}
                onClick={() => onFiltro(f)}
                className={cn("min-h-9 rounded-lg px-3.5 text-[13px] font-semibold transition-colors", filtro === f ? "bg-white text-[#083f59]" : "text-[#d9e7ee] hover:text-white")}
              >
                {f === "todas" ? "Todas" : "Mías"}
              </button>
            ))}
          </div>
          <button type="button" onClick={onNueva} className="flex min-h-9 items-center gap-1 rounded-[10px] bg-[#fd5d08] px-4 text-[14px] font-semibold text-white hover:bg-[#e85305]">
            <Plus className="h-4 w-4" aria-hidden /> Tarea
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        <Cifra
          titulo="Esperan atención"
          valor={esperan.length}
          tono="rojo"
          detalle={masVieja ? `la más antigua, ${textoEspera(masVieja.minutos, atencion?.horario)}` : "nadie esperando"}
        />
        <Cifra titulo="Vencidas" valor={vencidas} tono="rojo" detalle={vencidas ? `la más antigua, de hace ${diasVencida} ${diasVencida === 1 ? "día" : "días"}` : "nada atrasado"} />
        <Cifra titulo="Para hoy" valor={paraHoy} detalle={visitasHoy ? `${visitasHoy} ${visitasHoy === 1 ? "visita" : "visitas"}` : "sin visitas"} />
        <Cifra titulo="Sin siguiente paso" valor={sinSiguiente} detalle="tratos sin tarea agendada" />
      </div>
    </section>
  );
}
