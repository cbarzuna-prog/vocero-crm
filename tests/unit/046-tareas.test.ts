import { describe, expect, it } from "vitest";
import { appNavGroups } from "@/lib/nav";
import {
  compareTasks,
  crearTareaSchema,
  editarTareaSchema,
  isLate,
  nextBusinessDays,
  type TaskDto,
} from "@/lib/tareas";
import { parsePropiedadesFlag } from "@/server/propiedades/flag";
import { parseTareasFlag } from "@/server/tareas/flag";
import { todayBounds } from "@/server/tareas/queries";
import { dueInstant } from "@/server/tareas/service";

/** 046 — Tareas y «Hoy»: banderas, menú, fechas del negocio y orden. */

const task = (over: Partial<TaskDto>): TaskDto => ({
  id: "tsk_1",
  title: "Llamar",
  type: "llamada",
  dueAt: "2026-10-23T16:00:00.000Z",
  allDay: false,
  doneAt: null,
  contact: { id: "ct_1", name: "Pedro" },
  property: null,
  assignedUserId: null,
  assignedUserName: null,
  ...over,
});

describe("banderas TAREAS y PROPIEDADES", () => {
  it("encienden con los mismos valores que AGENDA y apagan con cualquier otro", () => {
    for (const v of ["on", "1", "true", "si", "sí", "yes", " ON "]) {
      expect(parseTareasFlag(v)).toBe(true);
      expect(parsePropiedadesFlag(v)).toBe(true);
    }
    for (const v of [undefined, "", "off", "0", "no", "tal vez"]) {
      expect(parseTareasFlag(v)).toBe(false);
      expect(parsePropiedadesFlag(v)).toBe(false);
    }
  });
});

describe("menú", () => {
  it("apagadas, el menú es exactamente el de upstream", () => {
    const trabajo = appNavGroups({ role: "owner" })[0]!.items.map((i) => i.label);
    expect(trabajo).toEqual(["Bandeja", "Pipeline", "Contactos"]);
  });

  it("con TAREAS, «Hoy» va primero y lleva su contador", () => {
    const items = appNavGroups({ role: "owner", tareas: true })[0]!.items;
    expect(items[0]).toMatchObject({ href: "/hoy", label: "Hoy", tareasBadge: true });
  });

  it("con PROPIEDADES, va después de Contactos y antes de Citas", () => {
    const trabajo = appNavGroups({ role: "owner", propiedades: true, agenda: true })[0]!.items.map(
      (i) => i.label
    );
    expect(trabajo).toEqual(["Bandeja", "Pipeline", "Contactos", "Propiedades", "Citas"]);
  });
});

describe("fechas en la zona del negocio", () => {
  const tz = "America/Costa_Rica"; // UTC-6, sin horario de verano

  it("«hoy» es el día del negocio aunque en UTC ya sea mañana", () => {
    // 23:30 en Costa Rica = 05:30 UTC del día siguiente.
    const now = new Date("2026-10-24T05:30:00Z");
    const { today, start, end } = todayBounds(now, tz);
    expect(today).toBe("2026-10-23");
    expect(start.toISOString()).toBe("2026-10-23T06:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-24T06:00:00.000Z");
  });

  it("día + hora del negocio se guardan como el instante UTC correcto", () => {
    expect(dueInstant("2026-10-24", "10:00", tz).toISOString()).toBe("2026-10-24T16:00:00.000Z");
  });

  it("sin hora (todo el día) cae al mediodía, nunca en el día vecino", () => {
    expect(dueInstant("2026-10-24", null, tz).toISOString()).toBe("2026-10-24T18:00:00.000Z");
  });

  it("una fecha inexistente se rechaza", () => {
    expect(() => dueInstant("2026-02-31x", "10:00", tz)).toThrow();
  });
});

describe("orden y estado", () => {
  it("las de todo el día van antes que las de hora; luego por hora", () => {
    const a = task({ id: "a", dueAt: "2026-10-23T20:00:00.000Z" });
    const b = task({ id: "b", dueAt: "2026-10-23T18:00:00.000Z", allDay: true });
    const c = task({ id: "c", dueAt: "2026-10-23T15:00:00.000Z" });
    expect([a, b, c].sort(compareTasks).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("una de hoy con hora pasada está atrasada; una de todo el día, no", () => {
    const now = new Date("2026-10-23T17:00:00Z");
    expect(isLate(task({ dueAt: "2026-10-23T16:00:00.000Z" }), now)).toBe(true);
    expect(isLate(task({ dueAt: "2026-10-23T16:00:00.000Z", allDay: true }), now)).toBe(false);
    expect(isLate(task({ dueAt: "2026-10-23T16:00:00.000Z", doneAt: "x" }), now)).toBe(false);
  });

  it("la siguiente sugerida salta el fin de semana", () => {
    expect(nextBusinessDays("2026-10-23")).toBe("2026-10-27"); // viernes → martes
    expect(nextBusinessDays("2026-10-20")).toBe("2026-10-22"); // martes → jueves
  });
});

describe("contratos de entrada", () => {
  it("crear exige contacto, título y día; la hora es opcional", () => {
    expect(crearTareaSchema.safeParse({ contactId: "ct_1", title: "x", day: "2026-10-24" }).success).toBe(true);
    expect(crearTareaSchema.safeParse({ contactId: "ct_1", title: "  ", day: "2026-10-24" }).success).toBe(false);
    expect(crearTareaSchema.safeParse({ contactId: "ct_1", title: "x", day: "24/10/2026" }).success).toBe(false);
    expect(
      crearTareaSchema.safeParse({ contactId: "ct_1", title: "x", day: "2026-10-24", time: "25:00" }).success
    ).toBe(false);
  });

  it("editar la hora sin el día se rechaza", () => {
    expect(editarTareaSchema.safeParse({ time: "10:00" }).success).toBe(false);
    expect(editarTareaSchema.safeParse({ day: "2026-10-24", time: "10:00" }).success).toBe(true);
    expect(editarTareaSchema.safeParse({ done: true }).success).toBe(true);
  });
});

describe("049 — Ajustes → Mi cuenta → Seguridad", () => {
  it("solo aparece cuando el layout lo pide, y en su propia sección", async () => {
    const { settingsSections } = await import("@/lib/nav");
    expect(settingsSections({}).map((s) => s.title)).toEqual(["Canales", "Agente", "Negocio"]);
    const con = settingsSections({ seguridad: true });
    expect(con.at(-1)).toEqual({ title: "Mi cuenta", links: [{ href: "/settings/seguridad", label: "Seguridad" }] });
  });
});
