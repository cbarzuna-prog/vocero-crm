import { describe, expect, it } from "vitest";
import { ponderado, probabilidadEtapa, visualEtapa } from "@/lib/embudo";
import { filtrarCompradores } from "@/components/fork/embudo";
import { saludo } from "@/components/fork/bienvenida-hoy";

describe("063 — probabilidad por etapa (valor ponderado)", () => {
  it.each([
    ["Nuevo lead", 5],
    ["Contactado", 10],
    ["Calificado", 20],
    ["Visita agendada", 30],
    ["Visita realizada", 40],
    ["Oferta/Negociación", 60],
    ["Reservado", 80],
  ])("%s → %i %%", (name, pct) => {
    expect(probabilidadEtapa({ name, kind: "open" }, 0, 7)).toBe(pct);
  });
  it("ganada 100 %, perdida 0 %; una etapa rara sube parejo por su lugar", () => {
    expect(probabilidadEtapa({ name: "Cerrado", kind: "won" }, 0, 1)).toBe(100);
    expect(probabilidadEtapa({ name: "Perdido", kind: "lost" }, 0, 1)).toBe(0);
    expect(probabilidadEtapa({ name: "Etapa X", kind: "open" }, 0, 4)).toBe(5);
    expect(probabilidadEtapa({ name: "Etapa Y", kind: "open" }, 3, 4)).toBe(80);
  });
  it("ponderado = total × probabilidad", () => {
    expect(ponderado(45_000_000, 5)).toBe(2_250_000);
  });
});

describe("063 — color de etapa", () => {
  it("las abiertas rotan la paleta; ganada verde y perdida gris", () => {
    expect(visualEtapa("open", 0)).not.toEqual(visualEtapa("open", 1));
    expect(visualEtapa("open", 0)).toEqual(visualEtapa("open", 8));
    expect(visualEtapa("won", 3).texto).toBe("#065f46");
    expect(visualEtapa("lost", 3).fondo).toBe("#ebebf0");
  });
});

describe("063 — buscador y «Solo en rojo»", () => {
  const leads = [
    { id: "a", stageId: "s", amountCents: null, contact: { name: "Laura Méndez", phone: "50688112233" } },
    { id: "b", stageId: "s", amountCents: null, contact: { name: "Pedro Rojas", phone: "50677001122" } },
  ];
  const datos = {
    horario: { dias: [1], desde: "08:00", hasta: "18:00" },
    leads: { a: { nivel: "rojo" as const, accion: "", desde: null, minutos: 90, motivo: "etapa" as const } },
    captaciones: {},
    pendientes: [],
    propiedades: { b: { code: "KK-0007", title: "Lote en La Guácima", coverUrl: null } },
  };
  it("busca por nombre sin tildes, por teléfono y por código de propiedad", () => {
    expect(filtrarCompradores(leads, datos, { q: "mendez", soloRojo: false }).map((l) => l.id)).toEqual(["a"]);
    expect(filtrarCompradores(leads, datos, { q: "7700", soloRojo: false }).map((l) => l.id)).toEqual(["b"]);
    expect(filtrarCompradores(leads, datos, { q: "kk-0007", soloRojo: false }).map((l) => l.id)).toEqual(["b"]);
  });
  it("«Solo en rojo» deja los rojos", () => {
    expect(filtrarCompradores(leads, datos, { q: "", soloRojo: true }).map((l) => l.id)).toEqual(["a"]);
  });
});

describe("063 — saludo", () => {
  it("días, tardes, noches", () => {
    expect(saludo(8)).toBe("Buenos días");
    expect(saludo(14)).toBe("Buenas tardes");
    expect(saludo(20)).toBe("Buenas noches");
  });
});
