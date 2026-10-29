import { afterEach, describe, expect, it } from "vitest";
import { contrasenaSchema, editarMiembroSchema } from "@/lib/equipo";
import { equipoEnabled } from "@/server/equipo/flag";

describe("054 — gestión del equipo", () => {
  const prev = { t: process.env.TAREAS, p: process.env.PROPIEDADES };
  afterEach(() => {
    process.env.TAREAS = prev.t;
    process.env.PROPIEDADES = prev.p;
  });

  it("viaja con los módulos del fork: con ambos apagados no existe", () => {
    process.env.TAREAS = "";
    process.env.PROPIEDADES = "";
    expect(equipoEnabled()).toBe(false);
    process.env.PROPIEDADES = "on";
    expect(equipoEnabled()).toBe(true);
  });

  it("editar exige al menos un cambio, un correo válido y un rol conocido", () => {
    expect(editarMiembroSchema.safeParse({}).success).toBe(false);
    expect(editarMiembroSchema.safeParse({ email: "no-es-correo" }).success).toBe(false);
    expect(editarMiembroSchema.safeParse({ role: "admin" }).success).toBe(false);
    const ok = editarMiembroSchema.safeParse({ email: "  Socia@Example.com " });
    expect(ok.success && ok.data.email).toBe("socia@example.com");
  });

  it("la contraseña temporal pide 8+ caracteres y por defecto no toca los dos pasos", () => {
    expect(contrasenaSchema.safeParse({ password: "corta" }).success).toBe(false);
    const ok = contrasenaSchema.safeParse({ password: "suficiente" });
    expect(ok.success && ok.data.quitarDosPasos).toBe(false);
  });
});
