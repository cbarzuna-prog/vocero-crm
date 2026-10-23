/**
 * 046 — Provincias y cantones de Costa Rica (7 y 84), para el autocompletado
 * de la ubicación de una propiedad (D3).
 *
 * Estático a propósito: cambia una vez por década (el último cantón nuevo,
 * Puerto Jiménez, es de 2022). Los distritos (~490) NO están aquí: se capturan
 * como texto libre en v1, para no versionar un catálogo grande sin verificarlo
 * contra la fuente oficial (INEC / División Territorial Administrativa).
 * NEEDS CLARIFICATION: si hacen falta filtros por distrito, cargar el catálogo
 * oficial completo en una spec aparte.
 */

export const CR_CANTONES = {
  "San José": [
    "San José",
    "Escazú",
    "Desamparados",
    "Puriscal",
    "Tarrazú",
    "Aserrí",
    "Mora",
    "Goicoechea",
    "Santa Ana",
    "Alajuelita",
    "Vázquez de Coronado",
    "Acosta",
    "Tibás",
    "Moravia",
    "Montes de Oca",
    "Turrubares",
    "Dota",
    "Curridabat",
    "Pérez Zeledón",
    "León Cortés Castro",
  ],
  Alajuela: [
    "Alajuela",
    "San Ramón",
    "Grecia",
    "San Mateo",
    "Atenas",
    "Naranjo",
    "Palmares",
    "Poás",
    "Orotina",
    "San Carlos",
    "Zarcero",
    "Sarchí",
    "Upala",
    "Los Chiles",
    "Guatuso",
    "Río Cuarto",
  ],
  Cartago: ["Cartago", "Paraíso", "La Unión", "Jiménez", "Turrialba", "Alvarado", "Oreamuno", "El Guarco"],
  Heredia: [
    "Heredia",
    "Barva",
    "Santo Domingo",
    "Santa Bárbara",
    "San Rafael",
    "San Isidro",
    "Belén",
    "Flores",
    "San Pablo",
    "Sarapiquí",
  ],
  Guanacaste: [
    "Liberia",
    "Nicoya",
    "Santa Cruz",
    "Bagaces",
    "Carrillo",
    "Cañas",
    "Abangares",
    "Tilarán",
    "Nandayure",
    "La Cruz",
    "Hojancha",
  ],
  Puntarenas: [
    "Puntarenas",
    "Esparza",
    "Buenos Aires",
    "Montes de Oro",
    "Osa",
    "Quepos",
    "Golfito",
    "Coto Brus",
    "Parrita",
    "Corredores",
    "Garabito",
    "Monteverde",
    "Puerto Jiménez",
  ],
  Limón: ["Limón", "Pococí", "Siquirres", "Talamanca", "Matina", "Guácimo"],
} as const satisfies Record<string, readonly string[]>;

export type Provincia = keyof typeof CR_CANTONES;
export const CR_PROVINCIAS = Object.keys(CR_CANTONES) as Provincia[];

export function isProvincia(v: unknown): v is Provincia {
  return typeof v === "string" && v in CR_CANTONES;
}

/** ¿Es ese cantón de esa provincia? */
export function cantonDe(provincia: string, canton: string): boolean {
  return isProvincia(provincia) && (CR_CANTONES[provincia] as readonly string[]).includes(canton);
}
