/** 055 (fork) — Enums de la ficha inmobiliaria, sin dependencias. */

export const TIPOS_CLIENTE = ["comprador", "vendedor", "inquilino", "arrendador", "inversionista"] as const;
export const IDIOMAS = ["es", "en", "otro"] as const;
export const OPERACIONES_BUSCADAS = ["venta", "alquiler", "ambas"] as const;
export const PLAZOS = ["inmediato", "1_3_meses", "3_6_meses", "mas_6_meses", "explorando"] as const;
export const FORMAS_PAGO = ["contado", "credito", "preaprobado"] as const;
