# 046 — Tareas

Orden por dependencia. `[P]` = paralelizable con la anterior. Cada fase cierra
con el gate `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.

## Fase 0 — Cimientos

- [x] T001 Banderas `PROPIEDADES` y `TAREAS`: `src/server/propiedades/flag.ts`, `src/server/tareas/flag.ts`, declaración en `src/lib/env.ts` y guía en `.env.example`. Tests unitarios de parseo (mismo set que `parseAgendaFlag`)
- [x] T002 Prefijos en `src/lib/db/ids.ts` (`prop`, `pph`, `pint`, `pie`, `tsk`)
- [x] T003 Las 5 tablas en `src/lib/db/schema.ts` según [data-model.md](data-model.md) → `pnpm db:generate` → revisar a mano `drizzle/0023_propiedades_y_tareas.sql` (solo CREATE, nada de ALTER sobre tablas de upstream)
- [x] T004 [P] Catálogo `src/lib/cr-zonas.ts` (provincia → cantón; distrito texto libre, ver D3); test de integridad (7 provincias, 84 cantones)
- [x] T005 [P] `src/lib/propiedades.ts` y `src/lib/tareas.ts`: enums, etiquetas en español, Zod compartido, formato de precio USD/CRC

## Fase 1 — Tareas y «Hoy» (H4, H5) — primero porque sirve desde el día uno sin inventario

- [x] T010 `src/server/tareas/service.ts`: crear, completar, reabrir, editar, reasignar; todo por `scoped()`
- [x] T011 `src/server/tareas/queries.ts`: vencidas, hoy (zona del negocio), por contacto, «sin siguiente paso» (D7, excluye `is_test`)
- [x] T012 API `src/app/api/tareas/route.ts` (GET con `?vista=hoy|contacto`, POST) y `[id]/route.ts` (PATCH, completar); 404 con bandera apagada
- [x] T013 Evento SSE interno `task.changed`; verificar que ningún consumidor externo enumera tipos de evento
- [x] T014 UI `src/components/tareas/`: diálogo nueva tarea (título + fecha mínimo), lista por contacto, toast «Crear siguiente»
- [x] T015 Pantalla `src/app/(app)/hoy/page.tsx` + `src/components/hoy/`: Vencidas → Hoy → Sin siguiente paso, filtro Mías/Todas, completar con un toque, móvil primero
- [x] T016 Costuras: «Hoy» primero en `src/lib/nav.ts` con contador; raíz → `/hoy` en `src/app/page.tsx` (la guía de inicio sigue primero); sección Tareas en `contact-panel.tsx` y `lead-drawer.tsx`
- [x] T017 Unit: agrupación por zona horaria (borde de medianoche), «sin siguiente paso»

## Fase 2 — Propiedades (H1, H2)

- [x] T020 `src/server/propiedades/service.ts`: crear (alta rápida D8), editar, archivar; código `KK-0001` secuencial por org sin colisión bajo concurrencia
- [x] T021 `src/server/propiedades/queries.ts`: lista con filtros (operación, tipo, estado, cantón, rango de precio por moneda), ficha, por vendedor
- [x] T022 `src/server/propiedades/fotos.ts`: subir vía `guardarMedia`, reordenar, borrar; tope 20; solo imágenes
- [x] T023 API `src/app/api/propiedades/**` y `src/app/api/contacts/[id]/propiedades`
- [x] T024 UI lista + filtros (`/propiedades`), formulario rápido en hoja, ficha (`/propiedades/[id]`) con galería y sección interna con candado
- [x] T025 Costura: «Propiedades» en `nav.ts`; sección «Vende» en `contact-panel.tsx` y `lead-drawer.tsx`

## Fase 3 — Interés comprador↔propiedad (H3)

- [x] T030 `src/server/propiedades/interes.ts`: PUERTA ÚNICA (crear vínculo, cambiar estado, descartar con motivo) escribiendo `property_interest` + `property_interest_event` en una transacción
- [x] T031 Test de vigilancia: falla si otro archivo escribe en esas dos tablas (mismo enfoque que el de `stage-history.ts`)
- [x] T032 UI: vincular desde contacto/lead (buscador por código, título, zona), selector de pasos, interesados en la ficha de la propiedad
- [x] T033 Tareas ligadas a propiedad: selector opcional en el diálogo

## Fase 4 — Verificación de comportamiento (Principios V y IX)

- [x] T040 Guiones `tests/e2e/046-tareas.md` y `tests/e2e/046-propiedades.md` con los criterios de aceptación H1–H5 de la spec
- [x] T041 Guiones propios `scripts/e2e-046-tareas.mjs` y `scripts/e2e-046-propiedades.mjs` (no se tocó `e2e-selftest.mjs` de upstream para no chocar al fusionar) que los conducen contra la app con mocks; verde con banderas encendidas
- [x] T042 Correr la suite con banderas APAGADAS: superficies en 404, menú y raíz como upstream, suites existentes en verde
- [x] T043 Prueba visual a 380px y escritorio de «Hoy», lista y ficha (Playwright, capturas)
- [x] T044 Actualizar `specs/README.md`, `CHANGELOG.md` y la tabla de banderas de `AGENTS.md`
