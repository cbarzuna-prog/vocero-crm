import { describe, expect, it } from "vitest";
import {
  comisionEstimadaCents,
  diasHasta,
  estadoParaEtapa,
  estadoVence,
  moverCaptacionSchema,
  nuevaCaptacionSchema,
  restarDias,
  sumarMeses,
  textoComision,
  totalComisiones,
  type CaptacionTarjeta,
} from "@/lib/captaciones";
import { appNavGroups } from "@/lib/nav";

describe("048 — fechas de la exclusiva", () => {
  it("seis meses después, con fin de mes y cambio de año", () => {
    expect(sumarMeses("2026-10-30", 6)).toBe("2027-04-30");
    expect(sumarMeses("2026-08-31", 6)).toBe("2027-02-28");
    expect(sumarMeses("2027-08-31", 6)).toBe("2028-02-29");
    expect(sumarMeses("2026-01-15", 12)).toBe("2027-01-15");
  });
  it("aviso 15 días antes", () => {
    expect(restarDias("2027-04-30", 15)).toBe("2027-04-15");
    expect(restarDias("2027-01-05", 15)).toBe("2026-12-21");
  });
  it("vencida, pronto (30 días) o vigente", () => {
    expect(diasHasta("2026-11-09", "2026-10-30")).toBe(10);
    expect(estadoVence("2026-10-29", "2026-10-30")).toBe("vencida");
    expect(estadoVence("2026-11-29", "2026-10-30")).toBe("pronto");
    expect(estadoVence("2027-04-30", "2026-10-30")).toBe("vigente");
  });
});

describe("048 — comisión", () => {
  it("venta: el porcentaje sobre el precio", () => {
    expect(comisionEstimadaCents({ operation: "venta", priceCents: 45_000_000, comisionBp: 500 })).toBe(2_250_000);
    expect(textoComision({ operation: "venta", comisionBp: 450 })).toBe("4,5 %");
  });
  it("alquiler: un mes de renta, sin importar el porcentaje", () => {
    expect(comisionEstimadaCents({ operation: "alquiler", priceCents: 150_000, comisionBp: 500 })).toBe(150_000);
    expect(textoComision({ operation: "alquiler", comisionBp: null })).toBe("1 mes de renta");
  });
  it("sin precio no hay estimado; las monedas no se suman", () => {
    expect(comisionEstimadaCents({ operation: "venta", priceCents: null, comisionBp: 500 })).toBeNull();
    const base = { operation: "venta", comisionBp: 500 } as const;
    const t = totalComisiones([
      { ...base, priceCents: 10_000_000, currency: "USD" },
      { ...base, priceCents: 20_000_000, currency: "CRC" },
      { ...base, priceCents: null, currency: "USD" },
    ] as unknown as CaptacionTarjeta[]);
    expect(t).toEqual({ USD: 500_000, CRC: 1_000_000, sinDato: 1 });
  });
});

describe("048 — estado de la propiedad según la etapa", () => {
  it("publicada entra al inventario; no captada se retira; volver atrás regresa a captación", () => {
    expect(estadoParaEtapa("publicada", "captacion")).toBe("disponible");
    expect(estadoParaEtapa("publicada", "reservada")).toBe("reservada");
    expect(estadoParaEtapa("perdida", "captacion")).toBe("retirada");
    expect(estadoParaEtapa("propuesta", "retirada")).toBe("captacion");
  });
});

describe("048 — contratos", () => {
  it("nueva captación exige dueño (contacto o nombre y teléfono)", () => {
    const base = { operation: "venta", type: "casa", provincia: "San José" };
    expect(nuevaCaptacionSchema.safeParse(base).success).toBe(false);
    expect(nuevaCaptacionSchema.safeParse({ ...base, nombre: "Ana" }).success).toBe(false);
    expect(nuevaCaptacionSchema.safeParse({ ...base, nombre: "Ana", telefono: "88881234" }).success).toBe(true);
    expect(nuevaCaptacionSchema.safeParse({ ...base, contactId: "ct_1" }).success).toBe(true);
  });
  it("perderla exige motivo; el vencimiento va después de la firma", () => {
    expect(moverCaptacionSchema.safeParse({ etapa: "perdida" }).success).toBe(false);
    expect(moverCaptacionSchema.safeParse({ etapa: "perdida", motivo: "no_responde" }).success).toBe(true);
    expect(moverCaptacionSchema.safeParse({ etapa: "firmada", firmadaEl: "2026-10-30", exclusivaVence: "2026-10-01" }).success).toBe(false);
  });
});

describe("048 — menú", () => {
  it("Captaciones va junto al Pipeline, solo con propiedades", () => {
    const items = (p: boolean) => appNavGroups({ propiedades: p })[0]!.items.map((i) => i.label);
    expect(items(true).slice(0, 3)).toEqual(["Bandeja", "Pipeline", "Captaciones"]);
    expect(items(false)).not.toContain("Captaciones");
  });
});
