import { describe, expect, it } from "vitest";
import { diasDesde, FILTRO_VACIO, filtrarContactos, ordenarContactos, type ContactoFila } from "@/lib/contactos";
import { cuando } from "@/components/fork/contactos-client";

const base: ContactoFila = {
  id: "c1", name: "Ana Mora", phone: "50688881234", notes: null, aiPaused: false, archivedAt: null,
  createdAt: "2026-10-01T12:00:00Z", source: { value: "referido", source: "capturada" }, priority: null,
  lead: { id: "l1", stageId: "s1", stageName: "Nuevo", stageKind: "open", desde: "2026-10-20T12:00:00Z" },
  conversationId: null, noLeidos: 0, ultimaActividad: "2026-10-28T12:00:00Z", email: "ana@x.com",
  tiposCliente: ["comprador"], operacion: "venta", zonas: ["Escazú"], presupuestoMinCents: null,
  presupuestoMaxCents: null, moneda: "USD", propiedades: ["KK-0001"], tareas: { pendientes: 1, vencidas: 0 },
};
const fila = (p: Partial<ContactoFila>): ContactoFila => ({ ...base, ...p });

const lista = [
  base,
  fila({ id: "c2", name: "Bruno Solís", phone: "13055550101", tiposCliente: ["vendedor"], zonas: ["Santa Ana"], propiedades: [], tareas: { pendientes: 2, vencidas: 1 }, priority: "alta", ultimaActividad: "2026-10-29T08:00:00Z", source: { value: "anuncio", source: "deducida" }, lead: { id: "l2", stageId: "s2", stageName: "Interesado", stageKind: "open", desde: "2026-09-01T00:00:00Z" } }),
  fila({ id: "c3", name: "Carla Mena", archivedAt: "2026-10-10T00:00:00Z", createdAt: "2026-10-27T00:00:00Z" }),
];

describe("057 — filtrar contactos", () => {
  it("sin filtros: los no archivados", () => {
    expect(filtrarContactos(lista, FILTRO_VACIO).map((c) => c.id)).toEqual(["c1", "c2"]);
  });
  it("busca por nombre sin tildes, teléfono, zona y código de propiedad", () => {
    const q = (q: string) => filtrarContactos(lista, { ...FILTRO_VACIO, q }).map((c) => c.id);
    expect(q("solis")).toEqual(["c2"]);
    expect(q("305 555")).toEqual(["c2"]);
    expect(q("escazu")).toEqual(["c1"]);
    expect(q("kk-0001")).toEqual(["c1"]);
  });
  it("por etapa, origen, tipo, propiedad, vencidas y archivados", () => {
    const f = (p: Partial<typeof FILTRO_VACIO>) => filtrarContactos(lista, { ...FILTRO_VACIO, ...p }).map((c) => c.id);
    expect(f({ etapa: "s2" })).toEqual(["c2"]);
    expect(f({ origen: "anuncio" })).toEqual(["c2"]);
    expect(f({ tipo: "comprador" })).toEqual(["c1"]);
    expect(f({ propiedad: "KK-0001" })).toEqual(["c1"]);
    expect(f({ soloVencidas: true })).toEqual(["c2"]);
    expect(f({ archivados: true })).toEqual(["c3"]);
  });
});

describe("057 — ordenar contactos", () => {
  const o = (orden: Parameters<typeof ordenarContactos>[1]) => ordenarContactos(lista.slice(0, 2), orden).map((c) => c.id);
  it("actividad, nombre, prioridad y días en la etapa", () => {
    expect(o("actividad")).toEqual(["c2", "c1"]);
    expect(o("nombre")).toEqual(["c1", "c2"]);
    expect(o("prioridad")).toEqual(["c2", "c1"]);
    expect(o("dias_etapa")).toEqual(["c2", "c1"]);
  });
});

describe("057 — fechas", () => {
  const ahora = new Date("2026-10-29T18:00:00Z");
  it("días desde", () => {
    expect(diasDesde("2026-10-20T18:00:00Z", ahora.getTime())).toBe(9);
    expect(diasDesde("2026-10-30T00:00:00Z", ahora.getTime())).toBe(0);
  });
  it("cuándo: hace N d y fecha corta", () => {
    expect(cuando("2026-10-24T18:00:00Z", ahora)).toBe("hace 5 d");
    expect(cuando("2026-08-01T18:00:00Z", ahora)).toMatch(/ago/);
  });
});
