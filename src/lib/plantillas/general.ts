import type { Plantilla } from "./tipos";

/**
 * 068 — «Otro (general)»: la red de seguridad. Lo mínimo que sirve a
 * cualquier negocio (base común de las tres investigaciones cruzadas).
 */
export const GENERAL: Plantilla = {
  clave: "general",
  nombre: "Otro (general)",
  descripcion: "Un CRM general que usted adapta",
  version: 1,
  vocabulario: { cliente: "cliente", clientes: "Clientes", embudo: "Tratos" },
  etapas: [
    { clave: "nuevo", nombre: "Nuevo", tipo: "open", criterio: "Escribió o lo registramos; todavía no hablamos", accion: "Responder y entender qué necesita", ambarMin: 5, rojoMin: 60 },
    { clave: "contactado", nombre: "Contactado", tipo: "open", criterio: "Ya sabemos qué necesita", requisitos: ["interes"], accion: "Enviar una propuesta con precio" },
    { clave: "propuesta", nombre: "Propuesta", tipo: "open", criterio: "Recibió una propuesta y sabemos cuándo decide", requisitos: ["interes", "fecha_esperada"], accion: "Dar seguimiento a la propuesta" },
    { clave: "ganado", nombre: "Ganado", tipo: "won" },
    { clave: "perdido", nombre: "Perdido", tipo: "lost" },
  ],
  campos: [
    { clave: "interes", etiqueta: "Qué necesita", tipo: "texto", momento: "inicio", destacado: true, ayuda: "Producto o servicio que le interesa" },
    { clave: "fecha_esperada", etiqueta: "Cuándo decide", tipo: "fecha", momento: "venta", destacado: true },
    { clave: "canal_preferido", etiqueta: "Prefiere que le contacten por", tipo: "lista", opciones: ["WhatsApp", "Llamada", "Correo"], momento: "opcional" },
    { clave: "idioma", etiqueta: "Idioma", tipo: "lista", opciones: ["Español", "Inglés"], momento: "opcional" },
  ],
  registros: [],
  motivosPerdida: ["Dejó de responder", "Precio", "Eligió a otro", "Ya no lo necesita"],
  recordatorios: [{ clave: "seguimiento", descripcion: "Recordar el siguiente paso en su fecha", encendido: true }],
  metricas: ["Tratos ganados", "Valor ganado", "Clientes por origen"],
  modulos: [],
};
