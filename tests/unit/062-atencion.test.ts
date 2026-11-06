import { describe, expect, it } from "vitest";
import {
  completarConfig,
  configAtencionSchema,
  estadoAtencion,
  HORARIO_DEFECTO,
  MENSAJE_DEFECTO,
  minutosHabiles,
  ordenarPendientes,
  textoEspera,
  tiempoPorNombre,
  type EntradaAtencion,
} from "@/lib/atencion";

const TZ = "America/Costa_Rica"; // UTC-6, sin horario de verano
const cr = (s: string) => new Date(`${s}-06:00`); // hora local de Costa Rica
const cfg = { horario: HORARIO_DEFECTO, mensaje: MENSAJE_DEFECTO };

describe("062 — minutos de oficina (L–S 8:00–18:00)", () => {
  it("dentro del mismo día", () => {
    expect(minutosHabiles(cr("2026-11-06T09:00:00"), cr("2026-11-06T09:40:00"), HORARIO_DEFECTO, TZ)).toBe(40);
  });
  it("lo que llega de noche empieza a contar a las 8:00", () => {
    // Jueves 23:00 → viernes 8:30 = 30 min.
    expect(minutosHabiles(cr("2026-11-05T23:00:00"), cr("2026-11-06T08:30:00"), HORARIO_DEFECTO, TZ)).toBe(30);
  });
  it("el domingo no cuenta", () => {
    // Sábado 17:00 → lunes 9:00 = 60 (sáb) + 60 (lun).
    expect(minutosHabiles(cr("2026-11-07T17:00:00"), cr("2026-11-09T09:00:00"), HORARIO_DEFECTO, TZ)).toBe(120);
  });
  it("varios días completos", () => {
    expect(minutosHabiles(cr("2026-11-02T08:00:00"), cr("2026-11-04T08:00:00"), HORARIO_DEFECTO, TZ)).toBe(1200);
  });
  it("al revés o igual: cero", () => {
    expect(minutosHabiles(cr("2026-11-06T10:00:00"), cr("2026-11-06T09:00:00"), HORARIO_DEFECTO, TZ)).toBe(0);
  });
});

describe("062 — tiempos sugeridos por el nombre de la etapa (las de Knock Knock)", () => {
  it.each([
    ["Nuevo lead", 5, 15],
    ["Contactado", 600, 1200],
    ["Calificado", 600, 1200],
    ["Visita agendada", 1200, 1800],
    ["Visita realizada", 300, 600],
    ["Oferta/Negociación", 600, 1200],
    ["Reservado", 1200, 2400],
    ["Otra etapa rara", 600, 1200],
  ])("%s → ámbar %i / rojo %i min", (nombre, ambar, rojo) => {
    const t = tiempoPorNombre(nombre);
    expect([t.ambarMin, t.rojoMin]).toEqual([ambar, rojo]);
  });
});

describe("062 — estado de un trato", () => {
  const base: EntradaAtencion = {
    abierta: true,
    tiempo: tiempoPorNombre("Nuevo lead"),
    ultimoEntrante: null,
    ultimoSaliente: null,
    ultimoContacto: cr("2026-11-06T09:00:00"),
    proximaTarea: null,
  };
  const a = (e: Partial<EntradaAtencion>, ahora: string) => estadoAtencion({ ...base, ...e }, cfg, cr(ahora), TZ);

  it("nuevo lead: ámbar a los 5 min, rojo a los 15", () => {
    expect(a({}, "2026-11-06T09:03:00")?.nivel).toBe("ok");
    expect(a({}, "2026-11-06T09:07:00")?.nivel).toBe("ambar");
    expect(a({}, "2026-11-06T09:20:00")).toMatchObject({ nivel: "rojo", motivo: "etapa", minutos: 20 });
  });
  it("mensaje sin responder manda sobre la etapa (15 min / 1 h)", () => {
    const e = { tiempo: tiempoPorNombre("Calificado"), ultimoEntrante: cr("2026-11-06T10:00:00"), ultimoSaliente: cr("2026-11-06T09:00:00") };
    expect(a(e, "2026-11-06T10:20:00")).toMatchObject({ nivel: "ambar", motivo: "mensaje", accion: "Responder su mensaje" });
    expect(a(e, "2026-11-06T11:05:00")?.nivel).toBe("rojo");
  });
  it("responder (o que responda el agente) apaga el rojo", () => {
    expect(a({ ultimoEntrante: cr("2026-11-06T09:00:00"), ultimoSaliente: cr("2026-11-06T09:30:00"), tiempo: tiempoPorNombre("Calificado") }, "2026-11-06T11:00:00")?.nivel).toBe("ok");
  });
  it("con una tarea a futuro está al día y dice cuál", () => {
    expect(a({ proximaTarea: { titulo: "Visita KK-0019", vence: cr("2026-11-07T10:00:00") } }, "2026-11-06T17:00:00")).toMatchObject({ nivel: "ok", motivo: "agendado", accion: "Visita KK-0019" });
  });
  it("una tarea vencida corre el reloj desde su vencimiento", () => {
    expect(a({ proximaTarea: { titulo: "Llamar", vence: cr("2026-11-06T09:00:00") } }, "2026-11-06T09:30:00")).toMatchObject({ nivel: "rojo", motivo: "tarea_vencida", accion: "Llamar" });
  });
  it("ganados y perdidos no tienen reloj", () => {
    expect(a({ abierta: false }, "2026-11-20T09:00:00")).toBeNull();
  });
  it("un lead de la noche no amanece rojo", () => {
    expect(a({ ultimoContacto: cr("2026-11-05T22:00:00") }, "2026-11-06T08:03:00")?.nivel).toBe("ok");
  });
});

describe("062 — orden, textos y contrato", () => {
  it("rojo primero, luego ámbar; el que más espera arriba; sin los al día", () => {
    const xs = ordenarPendientes([
      { nivel: "ambar" as const, minutos: 50 },
      { nivel: "rojo" as const, minutos: 20 },
      { nivel: "ok" as const, minutos: 0 },
      { nivel: "rojo" as const, minutos: 90 },
    ]);
    expect(xs.map((x) => `${x.nivel}${x.minutos}`)).toEqual(["rojo90", "rojo20", "ambar50"]);
  });
  it("espera en palabras (días de oficina)", () => {
    expect(textoEspera(12)).toBe("12 min");
    expect(textoEspera(200)).toBe("3 h 20 min");
    expect(textoEspera(1320)).toBe("2 d 2 h");
  });
  it("el rojo va después del ámbar y el cierre después de la apertura", () => {
    const ok = { horario: HORARIO_DEFECTO, mensaje: MENSAJE_DEFECTO, etapas: {}, captaciones: {} };
    expect(configAtencionSchema.safeParse(ok).success).toBe(true);
    expect(configAtencionSchema.safeParse({ ...ok, mensaje: { ambarMin: 60, rojoMin: 15 } }).success).toBe(false);
    expect(configAtencionSchema.safeParse({ ...ok, horario: { dias: [1], desde: "18:00", hasta: "08:00" } }).success).toBe(false);
  });
  it("sin nada guardado: valores sugeridos y captaciones completas", () => {
    const c = completarConfig(null);
    expect(c.horario).toEqual(HORARIO_DEFECTO);
    expect(Object.keys(c.captaciones)).toEqual(["contacto", "valoracion", "propuesta", "firmada", "publicada"]);
  });
});
