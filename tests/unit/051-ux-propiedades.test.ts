import { describe, expect, it } from "vitest";
import { ordenarPropiedades, resumenPropiedades } from "@/lib/propiedades";

const it_ = (id: string, priceCents: number | null, currency: "USD" | "CRC") => ({ id, priceCents, currency });

describe("051 — orden de la lista de propiedades", () => {
  const items = [it_("a", 300, "USD"), it_("b", null, "USD"), it_("c", 100, "CRC"), it_("d", 500, "USD"), it_("e", 900, "CRC")];

  it("«recientes» respeta el orden del servidor", () => {
    expect(ordenarPropiedades(items, "recientes").map((x) => x.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("por precio no mezcla monedas: US$ primero, luego ₡, sin precio al final", () => {
    expect(ordenarPropiedades(items, "precio_desc").map((x) => x.id)).toEqual(["d", "a", "e", "c", "b"]);
    expect(ordenarPropiedades(items, "precio_asc").map((x) => x.id)).toEqual(["a", "d", "c", "e", "b"]);
  });
  it("no muta la lista original", () => {
    const copia = [...items];
    ordenarPropiedades(items, "precio_desc");
    expect(items).toEqual(copia);
  });
});

describe("051 — resumen bajo el título", () => {
  it("cuenta por estado, con plural, y los que tienen interesados", () => {
    expect(
      resumenPropiedades([
        { status: "disponible", interesados: 2 },
        { status: "disponible", interesados: 0 },
        { status: "reservada", interesados: 1 },
        { status: "captacion", interesados: 0 },
      ])
    ).toBe("1 en captación · 2 disponibles · 1 reservada · 2 con interesados");
  });
  it("vacío sin propiedades", () => {
    expect(resumenPropiedades([])).toBe("");
  });
});
