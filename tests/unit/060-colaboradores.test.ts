import { describe, expect, it } from "vitest";
import { guardarParticipantesSchema, partesIguales, porcentajeABp, repartir, resumenParticipantes, textoPorcentaje } from "@/lib/colaboracion";
import { TIPO_CLIENTE_LABELS } from "@/lib/perfil-cliente";

describe("060 — reparto de la comisión", () => {
  it("70/30 sobre una comisión de $22,500", () => {
    const r = repartir(2_250_000, [{ porcentajeBp: 7000 }, { porcentajeBp: 3000 }]);
    expect(r.montos).toEqual([1_575_000, 675_000]);
    expect(r.agenciaBp).toBe(0);
    expect(r.agenciaCents).toBe(0);
  });
  it("lo no repartido queda para la agencia, y la suma siempre cuadra", () => {
    const r = repartir(1_000_001, [{ porcentajeBp: 3333 }, { porcentajeBp: 3333 }]);
    expect(r.agenciaBp).toBe(3334);
    expect((r.montos as number[]).reduce((a, b) => a + b, 0) + r.agenciaCents!).toBe(1_000_001);
  });
  it("sin comisión estimada no inventa montos", () => {
    expect(repartir(null, [{ porcentajeBp: 5000 }])).toEqual({ montos: [null], agenciaBp: 5000, agenciaCents: null });
  });
  it("partes iguales suman exactamente 100 %", () => {
    expect(partesIguales(3)).toEqual([3334, 3333, 3333]);
    expect(partesIguales(2)).toEqual([5000, 5000]);
    expect(partesIguales(3).reduce((a, b) => a + b, 0)).toBe(10_000);
  });
  it("lee porcentajes con coma o punto", () => {
    expect(porcentajeABp("33,33")).toBe(3333);
    expect(porcentajeABp("30")).toBe(3000);
    expect(porcentajeABp("101")).toBeNull();
    expect(porcentajeABp("abc")).toBeNull();
    expect(textoPorcentaje(3333)).toBe("33,33 %");
  });
  it("resumen corto para la tarjeta", () => {
    expect(resumenParticipantes([{ nombre: "Ana Mora", porcentajeBp: 3000 }, { nombre: "Luis", porcentajeBp: 7000 }])).toBe("Ana 30 % · Luis 70 %");
  });
});

describe("060 — contrato", () => {
  const p = (x: object) => guardarParticipantesSchema.safeParse({ participantes: [x] }).success;
  it("cada persona es del equipo o colaborador, no ambas ni ninguna", () => {
    expect(p({ userId: "u1", rol: "capta", porcentajeBp: 3000 })).toBe(true);
    expect(p({ contactId: "c1", rol: "vende", porcentajeBp: 3000 })).toBe(true);
    expect(p({ userId: "u1", contactId: "c1", rol: "capta", porcentajeBp: 3000 })).toBe(false);
    expect(p({ rol: "capta", porcentajeBp: 3000 })).toBe(false);
  });
  it("no pasa de 100 % ni repite personas", () => {
    expect(guardarParticipantesSchema.safeParse({ participantes: [{ contactId: "a", rol: "capta", porcentajeBp: 7000 }, { contactId: "b", rol: "vende", porcentajeBp: 3001 }] }).success).toBe(false);
    expect(guardarParticipantesSchema.safeParse({ participantes: [{ contactId: "a", rol: "capta", porcentajeBp: 3000 }, { contactId: "a", rol: "vende", porcentajeBp: 3000 }] }).success).toBe(false);
  });
  it("«Colaborador» existe como tipo de contacto", () => {
    expect(TIPO_CLIENTE_LABELS.colaborador).toBe("Colaborador (co-corredor)");
  });
});
