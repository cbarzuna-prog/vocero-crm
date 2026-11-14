# 068 — Tareas

Cada fase termina con sus pruebas en verde y su commit.

## Fase 1 · Núcleo
- [x] T1 Bandera `PLANTILLAS` (+ `PLANTILLAS_DEMO`) en `src/server/plantillas/flag.ts`, documentada en `.env.example`.
- [x] T2 Tipos y reglas (`src/lib/plantillas/tipos.ts`, `reglas.ts`).
- [x] T3 Plantillas General y Estudio Bruma (demo) + `catalogo.ts`.
- [x] T4 Pruebas unitarias de las reglas y de ambas plantillas.

## Fase 2 · Datos y aplicación
- [x] T5 Esquema y migración `0032` (las seis tablas del plan).
- [x] T6 `aplicarPlantilla` (idempotente) y `configNegocio`.
- [x] T7 API: `GET/POST /api/plantillas` (catálogo y aplicar), `GET /api/negocio`.

## Fase 3 · Setup
- [x] T8 `/bienvenida`, en tres pasos, con retomar.
- [x] T9 Redirección desde «Hoy» y la guía de inicio cuando falta la plantilla; vocabulario del menú según la configuración.

## Fase 4 · Ficha
- [ ] T10 API de valores (`/api/contactos/[id]/ficha-valores`) validada contra la configuración.
- [ ] T11 Tarjeta de campos por momento, con edición en línea y campos condicionales.
- [ ] T12 Registros vinculados: API y tarjetas («Nueva cita», cambiar estado).

## Fase 5 · Etapas
- [ ] T13 Criterio de etapa en la barra de la ficha y en el panel de la Bandeja; sugerencia «¿Pasar a…?».

## Fase 6 · IA
- [ ] T14 `extraer.ts` y `kk_extraccion`, con la rama del ai-mock.
- [ ] T15 Sugerencias en la ficha y en el panel de la Bandeja (Aceptar y Descartar), con fuente «IA, confirmado por…».

## Fase 7 · Ajustes
- [ ] T16 Ajustes → Mi negocio (vocabulario, criterios y acciones, campos visibles, catálogo).

## Fase 8 · Sandbox
- [ ] T17 `scripts/sembrar-demo-bruma.mjs` (datos inventados).
- [ ] T18 Instalador: `ENTORNO=sandbox DATOS=demo`.

## Fase 9 · Cierre
- [ ] T19 `scripts/e2e-068-plantillas.mjs` (7 escenarios) y regresión de las pruebas de punta a punta del fork.
- [ ] T20 CHANGELOG, `package.json` (`test:e2e:plantillas`) y despliegue en el sandbox.
