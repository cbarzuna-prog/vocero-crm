# 046 — Tareas y «Hoy» (guion E2E)

Automatizado en `scripts/e2e-046-tareas.mjs` (`pnpm test:e2e:tareas`).

**Con `TAREAS=on`** (app viva, BD migrada):

1. Un contacto nuevo con trato abierto y sin tareas aparece en «Sin siguiente paso».
2. Crear tareas: una de ayer (vencida), una de hoy con hora, una de hoy sin hora y una a 3 días → 201.
3. Contacto inexistente o título vacío → 422.
4. «Hoy»: la de ayer en Vencidas; las dos de hoy en Para hoy, la de todo el día primero; la futura no aparece.
5. Los contactos con tareas salen de «Sin siguiente paso».
6. El contador del menú ve vencidas y de hoy; completar baja el contador y saca la tarea de la lista; reabrir la devuelve.
7. Por contacto: lista sus pendientes.
8. Mover de día conserva la hora de pared del negocio.
9. Borrar → 204; borrar otra vez → 404.
10. La raíz entra a `/hoy` (o a la guía de inicio si falta un paso); `/hoy` carga.

**Con la bandera apagada** (`E2E_FLAG_OFF=1`): `GET`/`POST /api/tareas` y `/hoy` → 404; la raíz no lleva a `/hoy`.

**Visual** (manual con Playwright, 380px y 1280px): «Hoy» en una columna en el teléfono; la hoja de nueva tarea sale desde abajo; el contador del menú en rojo con vencidas y neutro con solo tareas de hoy.
