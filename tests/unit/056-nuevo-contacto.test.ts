import { describe, expect, it } from "vitest";
import { errorTelefono, telefonoCompleto } from "@/components/fork/nuevo-contacto-dialog";

describe("056 — teléfono del nuevo contacto", () => {
  it("+506 por defecto: 8 dígitos → con código", () => {
    expect(telefonoCompleto("506", "8888-1234")).toBe("50688881234");
    expect(errorTelefono("506", "8888 1234")).toBeNull();
  });
  it("si ya trae el código (o un +), se respeta", () => {
    expect(telefonoCompleto("506", "506 8888 1234")).toBe("50688881234");
    expect(telefonoCompleto("506", "+1 305 555 0101")).toBe("13055550101");
  });
  it("un número que empieza como el código no se confunde (5060-1234)", () => {
    expect(telefonoCompleto("506", "5060 1234")).toBe("50650601234");
  });
  it("dice qué falta", () => {
    expect(errorTelefono("506", "")).toMatch(/Escriba el teléfono/);
    expect(errorTelefono("506", "8888 12")).toMatch(/8 dígitos/);
    expect(errorTelefono("1", "305 555 0101")).toBeNull();
    expect(errorTelefono("", "44 20 7946 0958")).toBeNull();
    expect(errorTelefono("", "1234")).toMatch(/código de país/);
  });
});
