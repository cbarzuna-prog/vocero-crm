import type { Plantilla } from "./tipos";

const SERVICIOS = ["Corte", "Barba", "Corte y barba", "Color", "Manicure", "Pedicure", "Limpieza facial"];
const PROFESIONALES = ["Cualquiera", "Andrea", "Luis", "Marcela"];

/**
 * 068 — «Estudio Bruma»: barbería y estética INVENTADA para probar que el
 * motor es genérico (decisión del dueño, 2026-11-14). Gira alrededor de la
 * cita, no de una negociación: asistencia, confirmación el día antes y
 * clientes que vuelven (investigación cruzada, salud y belleza). Sin datos de
 * salud: las preferencias estéticas no son historial clínico.
 */
export const BRUMA: Plantilla = {
  clave: "bruma",
  nombre: "Estudio Bruma (demo)",
  descripcion: "Barbería y estética inventada, para probar",
  demo: true,
  version: 1,
  vocabulario: { cliente: "cliente", clientes: "Clientes", embudo: "Reservas", catalogo: "Servicios" },
  etapas: [
    { clave: "consulta", nombre: "Consulta", tipo: "open", criterio: "Escribió preguntando; todavía no tiene cita", accion: "Responder con precios y horarios disponibles", ambarMin: 5, rojoMin: 60 },
    { clave: "cita_agendada", nombre: "Cita agendada", tipo: "open", criterio: "Eligió servicio y tiene una cita", requisitos: ["servicio_interes", "registro:cita"], accion: "Confirmar la cita el día antes" },
    { clave: "confirmada", nombre: "Confirmada", tipo: "open", criterio: "Confirmó que viene", requisitos: ["registro:cita:confirmada"], accion: "Recibirlo y, al terminar, ofrecer la próxima cita" },
    { clave: "atendido", nombre: "Atendido", tipo: "won" },
    { clave: "perdido", nombre: "Perdido", tipo: "lost" },
  ],
  campos: [
    { clave: "servicio_interes", etiqueta: "Servicio que busca", tipo: "lista", opciones: SERVICIOS, momento: "inicio", destacado: true },
    { clave: "profesional_preferido", etiqueta: "Profesional preferido", tipo: "lista", opciones: PROFESIONALES, momento: "inicio", destacado: true },
    { clave: "frecuencia", etiqueta: "Cada cuánto viene", tipo: "lista", opciones: ["Cada 2 semanas", "Cada mes", "Cada 2 meses", "De vez en cuando"], momento: "venta" },
    { clave: "horario_preferido", etiqueta: "Horario que le sirve", tipo: "lista", opciones: ["Mañana", "Tarde", "Noche", "Fin de semana"], momento: "venta" },
    { clave: "preferencias", etiqueta: "Cómo le gusta", tipo: "texto_largo", momento: "opcional", ayuda: "Estilo de corte, productos que prefiere, detalles para repetir una buena experiencia" },
    { clave: "mes_cumpleanos", etiqueta: "Mes de cumpleaños", tipo: "lista", opciones: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"], momento: "opcional" },
    { clave: "idioma", etiqueta: "Idioma", tipo: "lista", opciones: ["Español", "Inglés"], momento: "opcional" },
  ],
  registros: [
    {
      clave: "cita",
      singular: "Cita",
      plural: "Citas",
      usaFecha: true,
      usaImporte: true,
      estados: [
        { clave: "agendada", nombre: "Agendada" },
        { clave: "confirmada", nombre: "Confirmada" },
        { clave: "atendida", nombre: "Atendida", final: true },
        { clave: "no_llego", nombre: "No llegó", final: true },
        { clave: "cancelada", nombre: "Cancelada", final: true },
      ],
      campos: [
        { clave: "servicio", etiqueta: "Servicio", tipo: "lista", opciones: SERVICIOS },
        { clave: "profesional", etiqueta: "Profesional", tipo: "lista", opciones: PROFESIONALES },
        { clave: "nota", etiqueta: "Qué se hizo", tipo: "texto_largo", ayuda: "Por ejemplo, la fórmula del color, para repetirla" },
      ],
    },
  ],
  catalogo: [
    { nombre: "Corte", precioCents: 700_000, moneda: "CRC", duracionMin: 30 },
    { nombre: "Barba", precioCents: 500_000, moneda: "CRC", duracionMin: 20 },
    { nombre: "Corte y barba", precioCents: 1_000_000, moneda: "CRC", duracionMin: 45 },
    { nombre: "Color", precioCents: 2_500_000, moneda: "CRC", duracionMin: 90 },
    { nombre: "Manicure", precioCents: 800_000, moneda: "CRC", duracionMin: 45 },
    { nombre: "Pedicure", precioCents: 1_000_000, moneda: "CRC", duracionMin: 60 },
    { nombre: "Limpieza facial", precioCents: 1_800_000, moneda: "CRC", duracionMin: 60 },
  ],
  motivosPerdida: ["Precio", "No llegó a la cita", "El horario no le sirvió", "Eligió otro lugar", "Dejó de responder"],
  recordatorios: [
    { clave: "confirmar_cita", descripcion: "Confirmar la cita el día antes", encendido: true },
    { clave: "resena", descripcion: "Pedir una reseña después de atenderlo", encendido: false },
    { clave: "volver", descripcion: "Avisar cuando ya le toca volver, según su frecuencia", encendido: true },
  ],
  metricas: ["Porcentaje de asistencia", "Ticket promedio", "Clientes que vuelven"],
  modulos: ["catalogo", "citas"],
};
