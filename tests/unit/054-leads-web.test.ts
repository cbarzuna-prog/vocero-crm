import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  externalIdFor,
  normalizePhoneCr,
  notaDelFormulario,
  tituloTarea,
  webLeadSchema,
} from "@/lib/leads-web";
import { isValidWebLeadsToken, parseLeadsWebFlag } from "@/server/leads-web/flag";

/** 054 — Leads desde los formularios de la web: contrato y reglas puras. */

describe("teléfono de Costa Rica (D4)", () => {
  it("8 dígitos locales → con 506, igual que el wa_id de Meta", () => {
    expect(normalizePhoneCr("6481-3100")).toBe("50664813100");
    expect(normalizePhoneCr("+506 6481-3100")).toBe("50664813100");
    expect(normalizePhoneCr("00506 6481 3100")).toBe("50664813100");
    expect(normalizePhoneCr("(506) 64813100")).toBe("50664813100");
  });

  it("los internacionales se respetan", () => {
    expect(normalizePhoneCr("+1 (305) 555-0100")).toBe("13055550100");
  });

  it("lo que no parece teléfono se rechaza", () => {
    expect(normalizePhoneCr("1234")).toBeNull();
    expect(normalizePhoneCr("hola")).toBeNull();
    expect(normalizePhoneCr("1234567890123456")).toBeNull();
  });
});

describe("contrato de entrada (D3)", () => {
  const base = { name: "Ana Rojas", phone: "+506 6481-3100" };

  it("basta nombre y teléfono", () => {
    const r = webLeadSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBeNull();
      expect(r.data.property).toBeNull();
      expect(r.data.id).toBeNull();
    }
  });

  it("sin nombre o sin teléfono es inválido", () => {
    expect(webLeadSchema.safeParse({ phone: "88888888" }).success).toBe(false);
    expect(webLeadSchema.safeParse({ name: "Ana" }).success).toBe(false);
    expect(webLeadSchema.safeParse({ name: "  ", phone: "88888888" }).success).toBe(false);
  });

  it("rechaza un email mal escrito y acepta uno vacío", () => {
    expect(webLeadSchema.safeParse({ ...base, email: "ana@" }).success).toBe(false);
    expect(webLeadSchema.safeParse({ ...base, email: "" }).success).toBe(true);
  });

  it("ignora campos de más y acepta ids numéricos", () => {
    const r = webLeadSchema.safeParse({
      ...base,
      id: 42,
      created_at: "2026-10-26",
      property: { id: "4c8bfbf0-75bc", code: "KK-0001", extra: true },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.id).toBe("42");
      expect(r.data.property?.code).toBe("KK-0001");
    }
  });
});

describe("idempotencia (D8)", () => {
  const parse = (v: unknown) => webLeadSchema.parse(v);

  it("con id de la web, la llave es ese id", () => {
    expect(externalIdFor(parse({ id: "abc", name: "A", phone: "88888888" }), "50688888888")).toBe("web:abc");
  });

  it("sin id: el mismo envío da la misma llave; otro mensaje, otra", () => {
    const a = parse({ name: "A", phone: "88888888", message: "Hola", property: { code: "KK-1" } });
    const b = parse({ name: "Otro nombre", phone: "88888888", message: "Hola", property: { code: "KK-1" } });
    const c = parse({ name: "A", phone: "88888888", message: "Otra cosa", property: { code: "KK-1" } });
    expect(externalIdFor(a, "50688888888")).toBe(externalIdFor(b, "50688888888"));
    expect(externalIdFor(a, "50688888888")).not.toBe(externalIdFor(c, "50688888888"));
  });
});

describe("bandera y token (D1, D2)", () => {
  it("la bandera se enciende con los mismos valores que las demás", () => {
    expect(parseLeadsWebFlag("on")).toBe(true);
    expect(parseLeadsWebFlag("sí")).toBe(true);
    expect(parseLeadsWebFlag(undefined)).toBe(false);
    expect(parseLeadsWebFlag("off")).toBe(false);
  });

  it("token corto, vacío o de ejemplo nunca autoriza", () => {
    const bueno = "a".repeat(32);
    expect(isValidWebLeadsToken(bueno, bueno)).toBe(true);
    expect(isValidWebLeadsToken("x", bueno)).toBe(false);
    expect(isValidWebLeadsToken("", "")).toBe(false);
    expect(isValidWebLeadsToken("abc", "abc")).toBe(false);
    const ejemplo = "REEMPLAZA_con_openssl_rand_hex_32";
    expect(isValidWebLeadsToken(ejemplo, ejemplo)).toBe(false);
  });
});

describe("textos (usted)", () => {
  it("nota y título de la tarea", () => {
    expect(
      notaDelFormulario({ fecha: "26/10/2026 14:05", propiedad: "KK-0001 · Lote", mensaje: "¿Visita?", email: "a@b.co" })
    ).toBe("[Formulario web 26/10/2026 14:05] KK-0001 · Lote\n¿Visita?\nEmail: a@b.co");
    expect(tituloTarea(null)).toBe("Responder solicitud web");
    expect(tituloTarea("KK-0001 · Lote")).toBe("Responder solicitud web — KK-0001 · Lote");
  });
});

describe("vigilancia", () => {
  it("la ruta exige bandera y token antes de leer el cuerpo", () => {
    const src = readFileSync("src/app/api/webhooks/web/[webToken]/route.ts", "utf8");
    const post = src.slice(src.indexOf("export async function POST"));
    expect(post.indexOf("autorizado(")).toBeGreaterThan(-1);
    expect(post.indexOf("autorizado(")).toBeLessThan(post.indexOf("req.json()"));
  });
});
