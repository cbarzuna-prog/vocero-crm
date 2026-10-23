/** 046 — Enums de propiedades, sin dependencias: los usan el esquema, la API y la UI. */

export const PROPERTY_OPERATIONS = ["venta", "alquiler"] as const;
export const PROPERTY_TYPES = [
  "casa",
  "apartamento",
  "lote",
  "local",
  "oficina",
  "bodega",
  "finca",
] as const;
export const PROPERTY_STATUSES = [
  "captacion",
  "disponible",
  "reservada",
  "vendida",
  "alquilada",
  "retirada",
] as const;
export const PROPERTY_CURRENCIES = ["USD", "CRC"] as const;
export const INTEREST_STATUSES = [
  "interesado",
  "enviada",
  "visitada",
  "oferto",
  "ganada",
  "descartada",
] as const;
export const DISCARD_REASONS = [
  "precio",
  "zona",
  "tamano",
  "estado_propiedad",
  "eligio_otra",
  "otro",
] as const;
