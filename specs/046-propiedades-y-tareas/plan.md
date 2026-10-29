# 046 — Plan de implementación

**Branch**: `feat/046-propiedades-y-tareas` · **Fecha**: 2026-10-23 ·
**Spec**: [spec.md](spec.md) · **Modelo**: [data-model.md](data-model.md) ·
**Tareas**: [tasks.md](tasks.md)

## Resumen

Dos módulos opcionales nuevos sobre Vocero 2.1.0, cada uno tras su bandera:
**Propiedades** (inventario, vendedor, interés comprador↔propiedad con
historial) y **Tareas** (seguimientos y pantalla «Hoy»). Cero cambios de
contrato publicado; una migración aditiva; código nuevo en carpetas propias
para seguir fusionando `upstream`.

## Contexto técnico

- **Stack**: el de upstream sin dependencias nuevas — Next.js 15 App Router,
  React 19, Drizzle + Postgres 16, Zod, Tailwind con los tokens de
  `globals.css`, lucide-react. Subida de fotos por el almacén existente
  (`src/lib/storage/medios.ts`: disco o bucket, ya resuelto por upstream).
- **Banderas**: `PROPIEDADES` y `TAREAS`, mismo patrón que `AGENDA`
  (`src/server/agenda/flag.ts`): lectura directa de `process.env`, valores
  `on/1/true/si`, superficie apagada = 404. Declaradas en `src/lib/env.ts` y
  `.env.example`.
- **Tiempo real**: al crear/completar tareas y cambiar interés se emite al bus
  SSE existente (`src/server/events/bus.ts`) un evento interno nuevo; solo lo
  consume nuestra UI (no es contrato publicado: el bus es in-process y los
  cerebros no lo leen). *Verificar en implementación que ningún consumidor
  externo enumere los tipos de evento; si lo hay, se sube a contrato.*
- **Escala**: decenas a cientos de propiedades, miles de tareas. Sin
  paginación compleja: listas con tope y filtros en el servidor.
- **Pantallas**: responsivas, 380px a escritorio (confirmado: PC y celular).

## Constitución — chequeo

| Principio | Cumple | Cómo |
|---|---|---|
| I Seguridad | ✔ | Sin secretos nuevos. Notas internas / comisión / vendedor nunca salen en vistas para comprador |
| II Soberanía | ✔ | Sin terceros. Fotos en el almacén propio |
| III Multi-tenancy | ✔ | `organization_id` + `scoped()` en las 5 tablas |
| IV Idempotencia | ✔ | Estados de interés por puerta única; tareas sin efectos externos |
| V / IX Hecho = verificado en vivo | ✔ | Guiones E2E nuevos (`tests/e2e/046-*.md`) + extensión de `scripts/e2e-selftest.mjs` |
| VI Specs antes de código | ✔ | Ciclo completo: spec → plan → tasks antes de código |
| VIII Foco vertical | ⚠ desviación declarada | Propiedades es dominio inmobiliario, no «conversaciones de WhatsApp». Es deliberado en este fork (negocio de Knock Knock). Mitigado: todo tras bandera, apagado por defecto, sin tocar el núcleo. Las tareas sí encajan (convertir conversaciones) y podrían proponerse a upstream |

## Estructura

```text
src/
  lib/
    cr-zonas.ts                 # catálogo provincias → cantones → distritos (estático)
    propiedades.ts              # enums, etiquetas, formato de precio, Zod compartido
    tareas.ts                   # enums, etiquetas, agrupación Vencidas/Hoy
  server/
    propiedades/
      flag.ts                   # propiedadesEnabled()
      queries.ts                # listar/filtrar, ficha, por vendedor, por comprador
      service.ts                # crear/editar/archivar, código KK-0001
      fotos.ts                  # subir, ordenar, borrar (tope 20)
      interes.ts                # PUERTA ÚNICA de property_interest(+_event)
    tareas/
      flag.ts                   # tareasEnabled()
      queries.ts                # hoy, vencidas, por contacto, sin siguiente paso
      service.ts                # crear/completar/reabrir/reasignar
  app/
    (app)/propiedades/page.tsx           # lista + filtros
    (app)/propiedades/[id]/page.tsx      # ficha
    (app)/hoy/page.tsx                   # «Hoy»
    api/propiedades/...                  # CRUD, fotos, interesados
    api/tareas/...                       # CRUD, completar
    api/contacts/[id]/propiedades        # interés + vendidas por contacto
  components/
    propiedades/   (lista, filtros, ficha, formulario rápido, galería, interesados, vincular)
    hoy/           (lista agrupada, renglón de tarea, «sin siguiente paso»)
    tareas/        (diálogo nueva tarea, «siguiente tarea», lista en contacto)
```

**Costuras en archivos de upstream (las únicas):**

| Archivo | Cambio |
|---|---|
| `src/lib/db/schema.ts` | 5 tablas nuevas al final, bajo un encabezado `046` |
| `src/lib/db/ids.ts` | 5 prefijos |
| `src/lib/env.ts` · `.env.example` | 2 banderas |
| `src/lib/nav.ts` | «Hoy» (primero, con contador de vencidas) y «Propiedades», según banderas |
| `src/app/page.tsx` | con `TAREAS` encendida, la raíz redirige a `/hoy` en vez de `/inbox` (la guía de inicio sigue mandando primero) |
| `src/components/inbox/contact-panel.tsx` | dos secciones montadas por bandera: «Tareas» y «Propiedades» (vende / le interesan) |
| `src/components/pipeline/lead-drawer.tsx` | las mismas dos secciones |

## Decisiones de diseño UX

- **«Hoy» móvil primero**: lista de una columna; cada renglón = casilla para
  completar (un toque), título, contacto, tipo con ícono, hora. Tocar el
  renglón abre la conversación. Completar → toast con «Crear siguiente»
  (abre el diálogo prellenado con el mismo contacto y tipo, fecha +2 días hábiles).
- **Contador en el menú**: vencidas en rojo; si no hay, las de hoy en neutro.
- **Formulario rápido de propiedad** (D8): 5 campos en una hoja; «Guardar y
  completar después» crea y abre la ficha.
- **Ficha de propiedad**: galería arriba, precio grande, chips de estado; en
  escritorio, dos columnas (datos | interesados + tareas). Lo interno (vendedor,
  comisión, notas) va en una sección visualmente separada con candado, para que
  quien comparta pantalla con un comprador sepa qué no enseñar.
- **Vincular comprador**: desde el panel de contacto, buscador de propiedades
  con autocompletar por código, título o zona. Estado como selector de pasos.

## Riesgos

- **Conflictos con upstream** en `contact-panel.tsx` y `lead-drawer.tsx`: son
  los archivos que más cambia Kevin. Mitigación: insertar un solo componente
  montado por bandera, sin reescribir lo existente.
- **Catálogo de zonas de CR**: ~480 distritos. Se versiona como dato estático;
  verificar contra la fuente oficial (INEC/TSE) al escribirlo.
