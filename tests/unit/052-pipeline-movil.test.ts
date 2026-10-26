import { describe, expect, it } from "vitest";
import { totalEtapa } from "@/components/fork/pipeline-movil";

describe("052 — total de una etapa en el celular", () => {
  it("suma solo la moneda del negocio y cuenta lo que queda fuera", () => {
    const t = totalEtapa(
      [
        { amountCents: 100, currency: "USD" },
        { amountCents: 250, currency: null },
        { amountCents: null, currency: null },
        { amountCents: 999, currency: "CRC" },
      ],
      "USD"
    );
    expect(t).toEqual({ totalCents: 350, sinMonto: 1, otraMoneda: 1, conMonto: 2 });
  });
});
