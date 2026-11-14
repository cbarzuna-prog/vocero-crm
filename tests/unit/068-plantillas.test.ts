import { describe, expect, it } from "vitest";
import { BRUMA } from "@/lib/plantillas/bruma";
import { plantillaPorClave, plantillasOfrecidas, PLANTILLAS } from "@/lib/plantillas/catalogo";
import { GENERAL } from "@/lib/plantillas/general";
import { camposExtraibles, esquemaValor, revisarPlantilla, valorLleno } from "@/lib/plantillas/reglas";
import type { Plantilla } from "@/lib/plantillas/tipos";
import { parseFlag } from "@/server/plantillas/flag";

const conCampo = (campo: Plantilla["campos"][number]): Plantilla => ({ ...GENERAL, campos: [...GENERAL.campos, campo] });
const reglas = (p: Plantilla) => revisarPlantilla(p).map((x) => x.regla);

describe("068 — las plantillas que se entregan cumplen las reglas", () => {
  it.each(PLANTILLAS.map((p) => [p.clave, p] as const))("%s pasa todas las reglas", (_clave, p) => {
    expect(revisarPlantilla(p)).toEqual([]);
  });
  it("Bruma es demo y solo se ofrece con PLANTILLAS_DEMO", () => {
    expect(BRUMA.demo).toBe(true);
    expect(plantillasOfrecidas(false).map((p) => p.clave)).toEqual(["general"]);
    expect(plantillasOfrecidas(true).map((p) => p.clave)).toContain("bruma");
    expect(plantillaPorClave("bruma")?.nombre).toMatch(/Bruma/);
    expect(plantillaPorClave("nada")).toBeNull();
  });
  it("ninguna pide más que nombre y contacto para guardar (no existe «obligatorio»)", () => {
    for (const p of PLANTILLAS) for (const c of p.campos) expect(c).not.toHaveProperty("obligatorio");
  });
});

describe("068 — reglas que ninguna plantilla puede romper (spec §3)", () => {
  it("rechaza datos de salud aunque no se marquen", () => {
    expect(reglas(conCampo({ clave: "alergias", etiqueta: "Alergias", tipo: "texto", momento: "venta" }))).toContain(
      "Datos de salud no van en la ficha comercial (Ley 8968, art. 9)"
    );
    expect(reglas(conCampo({ clave: "x", etiqueta: "Notas", tipo: "texto", momento: "venta", salud: true })).length).toBeGreaterThan(0);
  });
  it("una cédula debe ser sensible y no pedirse por chat", () => {
    expect(reglas(conCampo({ clave: "cedula", etiqueta: "Cédula", tipo: "texto", momento: "venta" }))).toContain(
      "Un identificador (cédula, tarjeta, cuenta) debe marcarse sensible"
    );
    expect(reglas(conCampo({ clave: "cedula", etiqueta: "Cédula", tipo: "texto", momento: "venta", sensible: true }))).toContain(
      "Un dato sensible no se pide por chat (política de WhatsApp Business)"
    );
    expect(reglas(conCampo({ clave: "cedula", etiqueta: "Cédula", tipo: "texto", momento: "venta", sensible: true, pedirPorChat: false }))).toEqual([]);
  });
  it("no redefine los datos base ni repite claves", () => {
    expect(reglas(conCampo({ clave: "telefono", etiqueta: "Tel", tipo: "texto", momento: "inicio" }))).toContain("Es un dato base de la ficha: no se redefine");
    expect(reglas(conCampo({ ...GENERAL.campos[0]! }))).toContain("Clave repetida");
  });
  it("los criterios de etapa apuntan a campos o registros que existen", () => {
    const mala: Plantilla = { ...GENERAL, etapas: GENERAL.etapas.map((e) => (e.clave === "contactado" ? { ...e, requisitos: ["no_existe", "registro:cita"] } : e)) };
    const r = reglas(mala);
    expect(r).toContain("El criterio mira «no_existe», que no existe");
    expect(r).toContain("El criterio mira «registro:cita», que no existe");
  });
  it("exige etapas abiertas, una ganada y una perdida", () => {
    expect(reglas({ ...GENERAL, etapas: GENERAL.etapas.filter((e) => e.tipo !== "won") })).toContain("Necesita exactamente una etapa ganada");
  });
  it("una lista sin opciones no pasa", () => {
    expect(reglas(conCampo({ clave: "x", etiqueta: "X", tipo: "lista", momento: "venta" }))).toContain("Una lista necesita opciones");
  });
});

describe("068 — lo que la IA puede leer y cómo se validan los valores", () => {
  it("la IA nunca recibe campos sensibles ni los que no se piden por chat", () => {
    const p = conCampo({ clave: "cedula", etiqueta: "Cédula", tipo: "texto", momento: "venta", sensible: true, pedirPorChat: false });
    expect(camposExtraibles(p).map((c) => c.clave)).not.toContain("cedula");
    expect(camposExtraibles(BRUMA).map((c) => c.clave)).toContain("servicio_interes");
  });
  it("valida cada tipo de valor", () => {
    const servicio = BRUMA.campos.find((c) => c.clave === "servicio_interes")!;
    expect(esquemaValor(servicio).safeParse("Corte").success).toBe(true);
    expect(esquemaValor(servicio).safeParse("Tatuaje").success).toBe(false);
    expect(esquemaValor({ tipo: "importe" }).safeParse({ cents: 700000, moneda: "CRC" }).success).toBe(true);
    expect(esquemaValor({ tipo: "importe" }).safeParse({ cents: -1, moneda: "CRC" }).success).toBe(false);
    expect(esquemaValor({ tipo: "fecha" }).safeParse("2026-12-01").success).toBe(true);
    expect(esquemaValor({ tipo: "fecha" }).safeParse("mañana").success).toBe(false);
    expect(esquemaValor({ tipo: "lista_multiple", opciones: ["A", "B"] }).safeParse(["A"]).success).toBe(true);
    expect(esquemaValor({ tipo: "si_no" }).safeParse("sí").success).toBe(false);
  });
  it("un requisito cuenta como cumplido solo si tiene valor", () => {
    expect(valorLleno(null)).toBe(false);
    expect(valorLleno("  ")).toBe(false);
    expect(valorLleno([])).toBe(false);
    expect(valorLleno("Corte")).toBe(true);
    expect(valorLleno(false)).toBe(true);
  });
  it("la bandera reconoce los valores de siempre", () => {
    expect(parseFlag("on")).toBe(true);
    expect(parseFlag("sí")).toBe(true);
    expect(parseFlag(undefined)).toBe(false);
    expect(parseFlag("off")).toBe(false);
  });
});
