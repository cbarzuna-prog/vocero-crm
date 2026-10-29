# 057 — Contactos para trabajar la cartera y página del contacto (fork Knock Knock)

Origen: revisión de UX (2026-10-29), lote 2. Con `TAREAS` o `PROPIEDADES`
(`forkActivo()`); apagados, Contactos es el de upstream y `/api/contactos*`
y `/contacts/[id]` dan 404.

## Lista (`/contacts`)

- Título con resumen: «N contactos · M con tareas vencidas · K sin leer».
- Tabla en escritorio (contacto · etapa y días en ella · qué busca ·
  propiedades · tareas · última actividad · acciones) y tarjetas en el
  celular.
- Buscar por nombre, teléfono, correo, notas, zona o código de propiedad.
- Filtros: etapa, origen, tipo de cliente, propiedad de interés, con tareas
  vencidas, archivados. Orden: última actividad, más nuevos, nombre,
  prioridad, más días en su etapa (recordado por navegador).
- Selección múltiple: mover de etapa (por la ruta del pipeline, una por una,
  para que quede en la bitácora; sin etapas «perdido», que piden motivo) y
  archivar/restaurar con «Deshacer» (8 s).
- Acciones con texto de ayuda: Llamar, abrir conversación o «Escribir
  primero» (plantilla), menú con Editar y Archivar. Días en la etapa en
  ámbar desde 14; «Sin tarea» en ámbar; vencidas en rojo.

## Página del contacto (`/contacts/[id]`)

Encabezado con teléfono, correo, origen, alta, etapa y días, prioridad; a un
toque: WhatsApp (o Escribir primero), Llamar, Correo, Editar, Archivar.
Cuerpo: ficha del cliente, propiedades, notas | tareas, conversación (últimos
15 mensajes, ✦/robot si los escribió el agente), historia (alta, primer
mensaje, etapas, propiedades, tareas creadas y hechas). En el celular, las
tareas primero. Desde la ficha en la Bandeja y el Pipeline: «Ver página
completa».

## Notas

- Excluye los contactos del Laboratorio (solo conversaciones de prueba).
- Consultas por tabla unidas en memoria (`server/contactos/queries.ts`).
- Costuras en upstream: `app/(app)/contacts/page.tsx` elige la lista.

Verificación: `tests/unit/057-contactos.test.ts`, `scripts/e2e-057-contactos.mjs`.
