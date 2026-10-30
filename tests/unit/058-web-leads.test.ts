import { describe, expect, it } from "vitest";
import { notaWeb, telefonoWeb, tipoDe, tituloTarea, webIdDeUrl, webLeadSchema } from "@/lib/web-leads";

describe("058 — contrato del webhook del sitio", () => {
  it("acepta tal cual lo que el sitio ya manda desde submit-property-crm", () => {
    const hoy = {
      id: "4647e376-a1ef-4a50-b4e3-1a1bb048f66f",
      name: "Ana Mora",
      phone: "+506 8888 1234",
      email: "ana@example.com",
      message: "Me interesa",
      property: { id: "2fee8023-6c92-4bce-a8f9-5c686659a74d", url: "https://knockknockcr.com/property/2fee8023-6c92-4bce-a8f9-5c686659a74d", title: "Lote en La Guácima" },
      pageUrl: "https://knockknockcr.com/property/2fee8023-6c92-4bce-a8f9-5c686659a74d",
    };
    const r = webLeadSchema.safeParse(hoy);
    expect(r.success).toBe(true);
    expect(r.success && tipoDe(r.data)).toBe("propiedad");
  });
  it("tolera nulos, vacíos y campos de más", () => {
    const r = webLeadSchema.safeParse({ id: "x1", name: "  ", email: null, phone: "88881234", extra: 1, preferences: { zones: "Escazú, Santa Ana", budgetMax: "450000" } });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBeUndefined();
      expect(r.data.preferences?.zones).toEqual(["Escazú", "Santa Ana"]);
      expect(r.data.preferences?.budgetMax).toBe(450000);
    }
  });
  it("tipo de formulario: alias del sitio y deducción", () => {
    expect(tipoDe({ source: "request_info" })).toBe("info");
    expect(tipoDe({ kind: "specific_request" })).toBe("solicitud");
    expect(tipoDe({ kind: "seller" })).toBe("vendedor");
    expect(tipoDe({})).toBe("contacto");
  });
});

describe("058 — teléfono", () => {
  it.each([
    ["8888 1234", "50688881234"],
    ["+506 8888-1234", "50688881234"],
    ["50688881234", "50688881234"],
    ["+1 (305) 555-0101", "13055550101"],
    ["0044 20 7946 0958", "442079460958"],
    ["1234", null],
    ["", null],
  ])("%s → %s", (entrada, esperado) => {
    expect(telefonoWeb(entrada)).toBe(esperado);
  });
});

describe("058 — textos", () => {
  it("título de la tarea", () => {
    expect(tituloTarea("propiedad", { code: "KK-0001", title: "Lote en La Guácima" })).toBe("Responder solicitud web — KK-0001 · Lote en La Guácima");
    expect(tituloTarea("vendedor", null)).toBe("Contactar vendedor (sitio web)");
  });
  it("nota con propiedad, referidor y mensaje", () => {
    const n = notaWeb("propiedad", { id: "1", message: "Hola" }, "KK-0001 · Lote", "Juan · JP1", "29/10/2026 21:00");
    expect(n).toContain("Referido por: Juan · JP1");
    expect(n).toContain("Mensaje: Hola");
  });
  it("id de la propiedad en la URL del sitio", () => {
    expect(webIdDeUrl("https://knockknockcr.com/property/2FEE8023-6c92-4bce-a8f9-5c686659a74d")).toBe("2fee8023-6c92-4bce-a8f9-5c686659a74d");
    expect(webIdDeUrl("https://knockknockcr.com/")).toBeNull();
  });
});
