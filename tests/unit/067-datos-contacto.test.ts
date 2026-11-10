import { describe, expect, it } from "vitest";
import { telefonoLegible } from "@/components/fork/datos-contacto";
import { telefonoWeb } from "@/lib/web-leads";

describe("067 — datos de contacto en la ficha", () => {
  it("muestra los números de Costa Rica en grupos de 4", () => {
    expect(telefonoLegible("50688776655")).toBe("+506 8877 6655");
  });
  it("deja los extranjeros con su + y sin agrupar", () => {
    expect(telefonoLegible("13055551234")).toBe("+13055551234");
  });
  it("al editar, 8 dígitos reciben el 506 y lo corto se rechaza", () => {
    expect(telefonoWeb("8877 6655")).toBe("50688776655");
    expect(telefonoWeb("123")).toBeNull();
  });
});
