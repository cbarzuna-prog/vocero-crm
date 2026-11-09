# 063 (fork) — Rediseño con las referencias del dueño

Referencias (2026-11-06/07, «no copiar, solo referencia»): tablero de Kommo,
pipeline y ficha de trato de Bitrix24, pipeline y ficha de trato de HubSpot.
Borradores aprobados en el lienzo «Knock Knock CRM — direcciones de diseño»
(fila «Borrador»). Decisión del dueño (2026-11-09): «Compradores» y «Dueños» (este último pasó a «Captación externa» en 064).

## Nombres

- Con el inventario encendido (`PROPIEDADES`), el menú dice **Compradores**
  (el pipeline) y **Dueños** (captación; subtítulo «Captación de propiedades»).
  Sin el fork, upstream sigue diciendo «Pipeline». Las rutas no cambian.

## Compradores (tablero)

- Encabezado de cada etapa en **flecha de color** (Bitrix): paleta pálida por
  orden entre las abiertas, ganada verde, perdida gris (`src/lib/embudo.ts`).
- Al pie, además del total, el **valor ponderado** por la probabilidad típica de
  la etapa (HubSpot): Nuevo 5 %, Contactado 10 %, Calificado 20 %, Visita
  agendada 30 %, Visita realizada 40 %, Oferta 60 %, Reservado 80 %; una etapa
  con otro nombre sube parejo por su lugar.
- Barra bajo el título: tratos abiertos y cuántos esperan atención, **buscador**
  (nombre sin tildes, teléfono si se escribe un número, código o título de la
  propiedad) y **«Solo en rojo»**.
- Tarjeta: la **propiedad** que le interesa con su miniatura, y **«Sin siguiente
  paso»** cuando no hay tarea agendada (el «No upcoming» de HubSpot).
- Dueños: los mismos encabezados en flecha.

## Ficha del contacto

- Arriba: nombre grande, semáforo, una línea de qué busca, teléfono, origen o
  referidor, y **botones redondos** (HubSpot): WhatsApp/Escribir, Llamar, Correo,
  Tarea, Editar, Archivar.
- **Barra de etapas** de lado a lado (Bitrix): pasadas en azul, actual en
  naranja con sus días, las que faltan en gris; un clic mueve el trato y
  «Perdido» pide el motivo.
- Tres columnas: ficha y notas · **resumen de la IA** (a pedido, guardado en
  `kk_resumen_contacto`, migración `0031`), aviso del **siguiente paso** (del
  semáforo) y **una sola línea de actividad** por día (mensajes y eventos) ·
  tareas, propiedades, «Del sitio web» y «Colabora en». En el celular: resumen y
  siguiente paso primero, luego tareas, luego la ficha.

## Hoy

- **Franja de bienvenida** (Kommo) en azul de marca: saludo según la hora, fecha,
  «Todas/Mías», «+ Tarea» naranja y cuatro cifras grandes: esperan atención,
  vencidas, para hoy (y visitas), sin siguiente paso.

Pruebas: `tests/unit/063-embudo.test.ts`, `scripts/e2e-063-rediseno.mjs`.
