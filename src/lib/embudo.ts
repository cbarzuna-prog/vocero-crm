/**
 * 063 (fork) — Cómo se ve cada etapa del embudo: su color (flecha del
 * encabezado, como Bitrix) y su probabilidad de cierre para el valor
 * ponderado (como HubSpot). Puro.
 */

export type EtapaVisual = { fondo: string; texto: string };

/** Paleta pálida con texto oscuro del mismo tono (contraste ≥ 4.5:1). */
const PALETA: EtapaVisual[] = [
  { fondo: "#dbeafe", texto: "#1e40af" }, // azul
  { fondo: "#ccfbf1", texto: "#0f766e" }, // verde azulado
  { fondo: "#e0e7ff", texto: "#3730a3" }, // índigo
  { fondo: "#fef3c7", texto: "#92400e" }, // ámbar
  { fondo: "#ffedd5", texto: "#9a3412" }, // naranja
  { fondo: "#f3e8ff", texto: "#6b21a8" }, // morado
  { fondo: "#dcfce7", texto: "#166534" }, // verde
  { fondo: "#fce7f3", texto: "#9d174d" }, // rosa
];
const GANADA: EtapaVisual = { fondo: "#d1fae5", texto: "#065f46" };
const PERDIDA: EtapaVisual = { fondo: "#ebebf0", texto: "#424245" };

/** El color de una etapa por su lugar entre las abiertas (las que no cierran el trato). */
export function visualEtapa(kind: "open" | "won" | "lost", indiceAbierta: number): EtapaVisual {
  if (kind === "won") return GANADA;
  if (kind === "lost") return PERDIDA;
  return PALETA[indiceAbierta % PALETA.length]!;
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Probabilidad típica de cierre por etapa inmobiliaria (en %). */
const POR_NOMBRE: { claves: string[]; pct: number }[] = [
  { claves: ["nuevo"], pct: 5 },
  { claves: ["contactado", "conversacion"], pct: 10 },
  { claves: ["calificado", "interesado"], pct: 20 },
  { claves: ["visita agendada", "agendada"], pct: 30 },
  { claves: ["visita realizada", "realizada", "visitad"], pct: 40 },
  { claves: ["oferta", "negociacion"], pct: 60 },
  { claves: ["reservado", "reserva"], pct: 80 },
];

/**
 * La probabilidad de una etapa: por su nombre; si no se reconoce, por su lugar
 * (sube parejo de 5 % a 80 % entre las abiertas). Ganada 100 %, perdida 0 %.
 */
export function probabilidadEtapa(etapa: { name: string; kind: "open" | "won" | "lost" }, indiceAbierta: number, totalAbiertas: number): number {
  if (etapa.kind === "won") return 100;
  if (etapa.kind === "lost") return 0;
  const n = sinTildes(etapa.name);
  const candidatos = POR_NOMBRE.flatMap((x) => x.claves.map((c) => ({ c, pct: x.pct }))).sort((a, b) => b.c.length - a.c.length);
  const hit = candidatos.find((x) => n.includes(x.c));
  if (hit) return hit.pct;
  if (totalAbiertas <= 1) return 5;
  return Math.round(5 + (75 * indiceAbierta) / (totalAbiertas - 1));
}

/** Valor ponderado: el monto por la probabilidad, redondeado al centavo. */
export const ponderado = (totalCents: number, pct: number) => Math.round((totalCents * pct) / 100);
