# 062 (fork) — Semáforo de atención por etapa

Pedido del dueño (2026-11-06): que un lead sin atención se ponga en rojo, como
en las pantallas de cocina, con un proceso y un tiempo por etapa basados en
buenas prácticas.

**Investigación** (2026-11-06): el primer contacto rinde ~80 % a los 5 min,
~60 % a los 15, ~35 % a la hora y ~10 % pasado un día (MIT vía HubSpot); el
78 % de compradores se queda con el primer agente que responde (NAR); el agente
promedio tarda ~15 h (WAV Group); ~44 % de los leads llega fuera de horario;
Pipedrive pinta de rojo el trato que pasa sus días permitidos por etapa.

## Reglas

El reloj corre en **minutos de oficina** (por defecto L–S 8:00–18:00, zona del
negocio). En orden:

1. **Mensaje sin responder** (el cliente escribió y nadie, ni el agente, le
   contestó): ámbar 15 min, rojo 1 h, en cualquier etapa.
2. **Tarea abierta a futuro**: al día; la tarjeta dice cuál es el siguiente paso.
3. **Tarea vencida**: el reloj de la etapa corre desde su vencimiento.
4. Si no, el reloj de la etapa corre desde el **último contacto real**: mensaje
   enviado, cambio de etapa, tarea hecha o alta.

Ganados y perdidos no tienen reloj.

## Tiempos sugeridos (reconocidos por el nombre de la etapa; «día» = día de oficina)

| Etapa | Qué hacer | Ámbar | Rojo |
|---|---|---|---|
| Nuevo | Llamar; si no contesta, WhatsApp con 3 o 4 propiedades | 5 min | 15 min |
| Contactado / En conversación | Calificar: presupuesto, zona, plazo, pago | 1 día | 2 días |
| Calificado / Interesado | Enviar propiedades y proponer visita | 1 día | 2 días |
| Visita agendada | Confirmar el día antes | 2 días | 3 días |
| Visita realizada | Llamar después de la visita | 5 h | 1 día |
| Oferta/Negociación | Seguir la oferta hasta cerrar | 1 día | 2 días |
| Reservado | Acompañar el trámite | 2 días | 4 días |
| Otra | Dar seguimiento | 1 día | 2 días |

Captaciones: Contacto 1 h/4 h · Valoración 3/5 días · Propuesta 2/5 días ·
Exclusiva firmada 5/10 días · Publicada 14/21 días.

Todo se cambia en **Ajustes → Tiempos de atención** (horario, mensaje sin
responder, y por etapa la acción y los dos umbrales).

## Dónde se ve

Pipeline (tarjeta completa ámbar/roja con la acción y la espera; también en la
vista del celular), Captaciones, Contactos (la fila) y «Hoy» («Esperan
atención», lo rojo primero, sin repetir las tareas vencidas).

## Datos

`kk_config_atencion` (una fila por organización, JSON) — migración `0030`.
Cálculo en `src/server/atencion/service.ts`, reglas puras en `src/lib/atencion.ts`.

Pruebas: `tests/unit/062-atencion.test.ts`, `scripts/e2e-062-atencion.mjs`.
