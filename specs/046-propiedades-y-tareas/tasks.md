# 046 — Tareas

Orden por dependencia. `[P]` = paralelizable con la anterior. Cada fase cierra
con el gate `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.

## Fase 0 — Cimientos

- [ ] T001 Banderas `PROPIEDADES` y `TAREAS`: `src/server/propiedades/flag.ts`, `src/server/tareas/flag.ts`, declaración en `src/lib/env.ts` y guía en `.env.example`. Tests unitarios de parseo (mismo set que `parseAgendaFlag`)
- [ ] T002 Prefijos en `src/lib/db/ids.ts` (`prop`, `pph`, `pint`, `pie`, `tsk`)
- [ ] T003 Las 5 tablas en `src/lib/db/schema.ts` según [data-model.md](data-model.md) → `pnpm db:generate` → revisar a mano `drizzle/0023_propiedades_y_tareas.sql` (solo CREATE, nada de ALTER sobre tablas de upstream)
- [ ] T004 [P] Catálogo `src/lib/cr-zonas.ts` (provincia → cantón → distrito) verificado contra fuente oficial; test de integridad (7 provincias, 84 cantones)
- [ ] T005 [P] `src/lib/propiedades.ts` y `src/lib/tareas.ts`: enums, etiquetas en español, Zod compartido, formato de precio USD/CRC

## Fase 1 — Tareas y «Hoy» (H4, H5) — primero porque sirve desde el día uno sin inventario

- [ ] T010 `src/server/tareas/service.ts`: crear, completar, reabrir, editar, reasignar; todo por `scoped()`
- [ ] T011 `src/server/tareas/queries.ts`: vencidas, hoy (zona del negocio), por contacto, «sin siguiente paso» (D7, excluye `is_test`)
- [ ] T012 API `src/app/api/tareas/route.ts` (GET con `?vista=hoy|contacto`, POST) y `[id]/route.ts` (PATCH, completar); 404 con bandera apagada
- [ ] T013 Evento SSE interno `task.changed`; verificar que ningún consumidor externo enumera tipos de evento
- [ ] T014 UI `src/components/tareas/`: diálogo nueva tarea (título + fecha mínimo), lista por contacto, toast «Crear siguiente»
- [ ] T015 Pantalla `src/app/(app)/hoy/page.tsx` + `src/components/hoy/`: Vencidas → Hoy → Sin siguiente paso, filtro Mías/Todas, completar con un toque, móvil primero
- [ ] T016 Costuras: «Hoy» primero en `src/lib/nav.ts` con contador; raíz → `/hoy` en `src/app/page.tsx` (la guía de inicio sigue primero); sección Tareas en `contact-panel.tsx` y `lead-drawer.tsx`
- [ ] T017 Unit: agrupación por zona horaria (borde de medianoche), «sin siguiente paso»

## Fase 2 — Propiedades (H1, H2)

- [ ] T020 `src/server/propiedades/service.ts`: crear (alta rápida D8), editar, archivar; código `KK-0001` secuencial por org sin colisión bajo concurrencia
- [ ] T021 `src/server/propiedades/queries.ts`: lista con filtros (operación, tipo, estado, cantón, rango de precio por moneda), ficha, por vendedor
- [ ] T022 `src/server/propiedades/fotos.ts`: subir vía `guardarMedia`, reordenar, borrar; tope 20; solo imágenes
- [ ] T023 API `src/app/api/propiedades/**` y `src/app/api/contacts/[id]/propiedades`
- [ ] T024 UI lista + filtros (`/propiedades`), formulario rápido en hoja, ficha (`/propiedades/[id]`) con galería y sección interna con candado
- [ ] T025 Costura: «Propiedades» en `nav.ts`; sección «Vende» en `contact-panel.tsx` y `lead-drawer.tsx`

## Fase 3 — Interés comprador↔propiedad (H3)

- [ ] T030 `src/server/propiedades/interes.ts`: PUERTA ÚNICA (crear vínculo, cambiar estado, descartar con motivo) escribiendo `property_interest` + `property_interest_event` en una transacción
- [ ] T031 Test de vigilancia: falla si otro archivo escribe en esas dos tablas (mismo enfoque que el de `stage-history.ts`)
- [ ] T032 UI: vincular desde contacto/lead (buscador por código, título, zona), selector de pasos, interesados en la ficha de la propiedad
- [ ] T033 Tareas ligadas a propiedad: selector opcional en el diálogo

## Fase 4 — Verificación de comportamiento (Principios V y IX)

- [ ] T040 Guiones `tests/e2e/046-tareas.md` y `tests/e2e/046-propiedades.md` con los criterios de aceptación H1–H5 de la spec
- [ ] T041 Extender `scripts/e2e-selftest.mjs` para conducirlos contra la app con mocks; verde con banderas encendidas
- [ ] T042 Correr la suite con banderas APAGADAS: superficies en 404, menú y raíz como upstream, suites existentes en verde
- [ ] T043 Prueba visual a 380px y escritorio de «Hoy», lista y ficha (Playwright, capturas)
- [ ] T044 Actualizar `specs/README.md`, `CHANGELOG.md` y la tabla de banderas de `AGENTS.md`
