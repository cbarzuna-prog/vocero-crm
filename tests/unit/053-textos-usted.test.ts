import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { aplicar } = require("../../fork/textos-usted/aplicar.cjs") as {
  aplicar: (s: string, p: [string, string][]) => string;
};

const dic = JSON.parse(readFileSync("fork/textos-usted/diccionario.json", "utf8")) as Record<string, [string, string][]>;
const FORK = /src\/(components\/(fork|tareas|hoy|propiedades|seguridad)|server\/(tareas|propiedades))\//;
const PROMPTS = /src\/(server\/(ai|lab)|lib\/ai)\//;

describe("053 — textos en usted (diccionario sobre upstream)", () => {
  it("aplicar reemplaza todas las apariciones y nada más", () => {
    expect(aplicar("Escribe tu nombre. Escribe tu nombre.", [["Escribe tu nombre", "Escriba su nombre"]])).toBe(
      "Escriba su nombre. Escriba su nombre."
    );
    expect(aplicar("sin cambios", [])).toBe("sin cambios");
  });

  for (const [rel, pares] of Object.entries(dic)) {
    describe(rel, () => {
      it("es un archivo de upstream que existe, no del fork ni un prompt del LLM", () => {
        expect(existsSync(rel)).toBe(true);
        expect(FORK.test(rel)).toBe(false);
        expect(PROMPTS.test(rel)).toBe(false);
      });
      const src = existsSync(rel) ? readFileSync(rel, "utf8") : "";
      it("cada frase sigue en el archivo (si falla: Vocero cambió el texto, actualice el par)", () => {
        const huerfanos = pares.filter(([de]) => !src.includes(de)).map(([de]) => de);
        expect(huerfanos).toEqual([]);
      });
      it("el archivo transformado sigue siendo TypeScript válido", () => {
        const out = ts.transpileModule(aplicar(src, pares), {
          fileName: rel,
          reportDiagnostics: true,
          compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022 },
        });
        expect((out.diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))).toEqual([]);
      });
    });
  }
});
