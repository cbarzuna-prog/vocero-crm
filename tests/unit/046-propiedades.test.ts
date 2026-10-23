import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CR_CANTONES, CR_PROVINCIAS, cantonDe } from "@/lib/cr-zonas";
import {
  banosFromX2,
  banosToX2,
  cambiarInteresSchema,
  crearPropiedadSchema,
  defaultTitle,
  editarPropiedadSchema,
  filtroPropiedadesSchema,
  formatPrecio,
} from "@/lib/propiedades";
import { sniffImage } from "@/server/propiedades/fotos";

/** 046 — Propiedades: catálogo, contratos, formato, fotos y la puerta única del interés. */

describe("catálogo de Costa Rica", () => {
  it("7 provincias y 84 cantones, sin repetidos dentro de una provincia", () => {
    expect(CR_PROVINCIAS).toHaveLength(7);
    const total = Object.values(CR_CANTONES).reduce((n, l) => n + l.length, 0);
    expect(total).toBe(84);
    for (const lista of Object.values(CR_CANTONES)) expect(new Set(lista).size).toBe(lista.length);
  });

  it("valida el par provincia/cantón", () => {
    expect(cantonDe("San José", "Escazú")).toBe(true);
    expect(cantonDe("San José", "Atenas")).toBe(false);
    expect(cantonDe("Alajuela", "Atenas")).toBe(true);
    expect(cantonDe("Narnia", "Escazú")).toBe(false);
  });
});

describe("alta rápida", () => {
  const ok = { operation: "venta", type: "casa", provincia: "San José", canton: "Santa Ana" };

  it("basta con operación, tipo y provincia; la moneda default es USD", () => {
    const r = crearPropiedadSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.currency).toBe("USD");
  });

  it("rechaza un cantón de otra provincia y una provincia inventada", () => {
    expect(crearPropiedadSchema.safeParse({ ...ok, canton: "Liberia" }).success).toBe(false);
    expect(crearPropiedadSchema.safeParse({ ...ok, provincia: "Narnia", canton: null }).success).toBe(false);
  });

  it("solo USD o CRC", () => {
    expect(crearPropiedadSchema.safeParse({ ...ok, currency: "EUR" }).success).toBe(false);
    expect(crearPropiedadSchema.safeParse({ ...ok, currency: "CRC" }).success).toBe(true);
  });

  it("título por defecto: tipo + lugar", () => {
    expect(defaultTitle("casa", "Santa Ana")).toBe("Casa en Santa Ana");
    expect(defaultTitle("lote", null)).toBe("Lote");
  });
});

describe("ficha", () => {
  it("baños en medios; comisión en puntos básicos", () => {
    expect(editarPropiedadSchema.safeParse({ banos: 2.5 }).success).toBe(true);
    expect(editarPropiedadSchema.safeParse({ banos: 2.3 }).success).toBe(false);
    expect(editarPropiedadSchema.safeParse({ comisionBp: 500 }).success).toBe(true);
    expect(editarPropiedadSchema.safeParse({ comisionBp: 10_001 }).success).toBe(false);
    expect(banosToX2(2.5)).toBe(5);
    expect(banosFromX2(5)).toBe(2.5);
    expect(banosToX2(null)).toBeNull();
  });

  it("la URL del anuncio tiene que ser una URL", () => {
    expect(editarPropiedadSchema.safeParse({ urlExterna: "encuentra24" }).success).toBe(false);
    expect(editarPropiedadSchema.safeParse({ urlExterna: "https://www.encuentra24.com/x" }).success).toBe(true);
  });

  it("precio sin decimales y con el símbolo de su moneda", () => {
    expect(formatPrecio(45_000_000, "USD")).toBe("$450,000");
    expect(formatPrecio(18_500_000_000, "CRC")).toBe("₡185,000,000");
    expect(formatPrecio(null, "USD")).toBeNull();
  });
});

describe("filtros", () => {
  it("por defecto muestra las activas", () => {
    const r = filtroPropiedadesSchema.parse({});
    expect(r.status).toBe("activas");
  });
  it("acepta un estado, «activas» o «todas»", () => {
    expect(filtroPropiedadesSchema.safeParse({ status: "vendida" }).success).toBe(true);
    expect(filtroPropiedadesSchema.safeParse({ status: "todas" }).success).toBe(true);
    expect(filtroPropiedadesSchema.safeParse({ status: "regalada" }).success).toBe(false);
  });
});

describe("interés", () => {
  it("el motivo de descarte solo va con «descartada»", () => {
    expect(cambiarInteresSchema.safeParse({ status: "descartada", discardReason: "precio" }).success).toBe(true);
    expect(cambiarInteresSchema.safeParse({ status: "visitada", discardReason: "precio" }).success).toBe(false);
    expect(cambiarInteresSchema.safeParse({}).success).toBe(false);
  });
});

describe("fotos", () => {
  it("el tipo se decide por los bytes, no por el nombre", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffImage(webp)).toBe("image/webp");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });
});

/**
 * Guardarraíl: el estado de un comprador con una propiedad y su historial se
 * escriben juntos, y solo en `src/server/propiedades/interes.ts`. Si este test
 * se pone rojo, no lo relajes: enruta tu cambio por `vincular()` / `cambiar()`.
 */
describe("guardarraíl: una sola puerta escribe el interés", () => {
  const SRC = path.resolve(import.meta.dirname, "..", "..", "src");
  const PUERTA = path.join("server", "propiedades", "interes.ts");

  function archivos(dir: string): string[] {
    return readdirSync(dir).flatMap((e) => {
      const full = path.join(dir, e);
      return statSync(full).isDirectory() ? archivos(full) : /\.(ts|tsx)$/.test(e) ? [full] : [];
    });
  }

  it("ningún otro archivo inserta, actualiza o borra property_interest(_event)", () => {
    const re = /\.(insert|update|delete)\(\s*schema\.propertyInterest(Event)?\s*\)/;
    const infractores = archivos(SRC)
      .filter((f) => !f.endsWith(PUERTA))
      .filter((f) => re.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(SRC, f));
    expect(infractores).toEqual([]);
  });

  it("la puerta sí escribe ambas tablas", () => {
    const code = readFileSync(path.join(SRC, PUERTA), "utf8");
    expect(code).toMatch(/insert\(schema\.propertyInterest\)/);
    expect(code).toMatch(/insert\(schema\.propertyInterestEvent\)/);
  });
});
