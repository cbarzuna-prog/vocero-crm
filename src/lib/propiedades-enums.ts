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

/** 048 — Etapas del tablero de Captaciones (pipeline de vendedores). */
export const CAPTACION_ETAPAS = ["contacto", "valoracion", "propuesta", "firmada", "publicada", "perdida"] as const;
export const MOTIVOS_NO_CAPTADA = ["precio_irreal", "firmo_con_otro", "decidio_no_vender", "no_responde", "otro"] as const;

/** 060 — Papel de cada persona en una propiedad: la trajo, la vende, o ambas. */
export const ROLES_COLABORACION = ["capta", "vende", "ambos"] as const;
