import { describe, expect, it } from "vitest";
import {
  buscarCanton,
  editarPerfilSchema,
  montoACentavos,
  perfilDesdeFicha,
  rangoPresupuesto,
} from "@/lib/perfil-cliente";

describe("055 — montos que escribe el agente", () => {
  it.each([
    ["400 mil", 40_000_000],
    ["400k", 40_000_000],
    ["$400,000", 40_000_000],
    ["400.000 dólares", 40_000_000],
    ["400000 USD", 40_000_000],
    ["1.2 millones", 120_000_000],
    ["1,5 millones de dólares", 150_000_000],
    ["₡185 millones", 18_500_000_000],
    [450000, 45_000_000],
  ])("%s → %d centavos", (entrada, cents) => {
    expect(montoACentavos(entrada)).toBe(cents);
  });
  it("lo que no es un monto → null, sin lanzar", () => {
    expect(montoACentavos("no sabe")).toBeNull();
    expect(montoACentavos({})).toBeNull();
  });
});

describe("055 — cantones", () => {
  it("encuentra el cantón sin tildes y dentro de una frase", () => {
    expect(buscarCanton("escazu")).toEqual(expect.objectContaining({ provincia: "San José", canton: "Escazú" }));
    expect(buscarCanton("Santa Ana, cerca de Lindora")).toEqual(expect.objectContaining({ canton: "Santa Ana" }));
    expect(buscarCanton("Lindora")).toBeNull();
  });
});

describe("055 — la ficha del agente → ficha inmobiliaria", () => {
  it("traduce las claves acordadas", () => {
    const p = perfilDesdeFicha({
      correo: "Escríbame a Ana.Mora@Gmail.com",
      vive_en: "Escazú, San Rafael",
      idioma: "inglés",
      tipo_cliente: "comprador e inversionista",
      operacion: "comprar",
      tipo_propiedad: ["casa", "apartamento"],
      zonas: "Santa Ana, escazu y Lindora",
      presupuesto_min: "300 mil dólares",
      presupuesto_max: "450k USD",
      habitaciones: "3 cuartos",
      para_cuando: "en unos 2 meses",
      forma_pago: "crédito preaprobado con el BAC",
    });
    expect(p).toEqual({
      email: "ana.mora@gmail.com",
      viveDetalle: "Escazú, San Rafael",
      viveProvincia: "San José",
      viveCanton: "Escazú",
      idioma: "en",
      tiposCliente: ["comprador", "inversionista"],
      operacion: "venta",
      tiposPropiedad: ["casa", "apartamento"],
      zonas: ["Santa Ana", "Escazú", "Lindora"],
      presupuestoMinCents: 30_000_000,
      presupuestoMaxCents: 45_000_000,
      moneda: "USD",
      habitaciones: 3,
      plazo: "1_3_meses",
      pago: "preaprobado",
    });
  });
  it("colones, «presupuesto» solo como máximo, y claves con tildes o espacios", () => {
    expect(perfilDesdeFicha({ "Presupuesto": "185 millones de colones", "Para cuándo": "ya" })).toEqual({
      presupuestoMaxCents: 18_500_000_000,
      moneda: "CRC",
      plazo: "inmediato",
    });
  });
  it("ignora lo que no entiende y no inventa", () => {
    expect(perfilDesdeFicha({ correo: "no tiene", habitaciones: "muchas", forma_pago: "ya veremos", interes: "alto" })).toEqual({});
  });
  it("un mínimo mayor que el máximo se acomoda", () => {
    const p = perfilDesdeFicha({ presupuesto_min: "500 mil", presupuesto_max: "300 mil" });
    expect([p.presupuestoMinCents, p.presupuestoMaxCents]).toEqual([30_000_000, 50_000_000]);
  });
});

describe("055 — edición manual", () => {
  it("valida correo y presupuesto, y '' borra", () => {
    expect(editarPerfilSchema.safeParse({ email: "malo" }).success).toBe(false);
    expect(editarPerfilSchema.safeParse({ presupuestoMinCents: 5, presupuestoMaxCents: 1 }).success).toBe(false);
    const ok = editarPerfilSchema.safeParse({ email: "", viveDetalle: "  " });
    expect(ok.success && ok.data).toEqual({ email: null, viveDetalle: null });
  });
  it("rango legible", () => {
    expect(rangoPresupuesto({ presupuestoMinCents: 30_000_000, presupuestoMaxCents: 45_000_000, moneda: "USD" })).toBe("US$300,000 – US$450,000");
    expect(rangoPresupuesto({ presupuestoMinCents: null, presupuestoMaxCents: 18_500_000_000, moneda: "CRC" })).toBe("hasta ₡185,000,000");
  });
});
