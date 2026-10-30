import { describe, expect, it } from "vitest";
import { FILTRO_VACIO, filtrarContactos, origenDe, type ContactoFila } from "@/lib/contactos";

const fila = (o: Partial<ContactoFila>): ContactoFila => ({
  id: "c1", name: "Ana", phone: null, notes: null, aiPaused: false, archivedAt: null, createdAt: "2026-10-01T12:00:00Z",
  source: { value: "desconocida", source: "deducida" }, priority: null, lead: null, conversationId: null, noLeidos: 0,
  ultimaActividad: "2026-10-01T12:00:00Z", email: null, tiposCliente: [], operacion: null, zonas: [], presupuestoMinCents: null,
  presupuestoMaxCents: null, moneda: "USD", propiedades: [], tareas: { pendientes: 0, vencidas: 0 }, referidor: null, desdeWeb: false,
  ...o,
});

describe("059 — origen de un contacto", () => {
  it("lo que llegó por el sitio dice «Sitio web», no «Contenido orgánico»", () => {
    expect(origenDe(fila({ desdeWeb: true, source: { value: "organico", source: "capturada" } }))).toBe("Sitio web");
    expect(origenDe(fila({ desdeWeb: true }))).toBe("Sitio web");
  });
  it("lo que alguien capturó distinto a mano se respeta", () => {
    expect(origenDe(fila({ desdeWeb: true, source: { value: "conocido", source: "capturada" } }))).toBe("Conocido");
  });
  it("sin dato no inventa nada; un anuncio deducido sí se muestra", () => {
    expect(origenDe(fila({}))).toBeNull();
    expect(origenDe(fila({ source: { value: "anuncio", source: "deducida" } }))).toBe("Anuncio");
  });
  it("el filtro «Sitio web» deja solo a los que llegaron por el sitio", () => {
    const xs = [fila({ id: "a", desdeWeb: true }), fila({ id: "b" })];
    expect(filtrarContactos(xs, { ...FILTRO_VACIO, origen: "web" }).map((c) => c.id)).toEqual(["a"]);
  });
});
