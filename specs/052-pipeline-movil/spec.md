# 052 — Pipeline en el celular (fork Knock Knock)

Carril ligero. Origen: revisión UX P3-12 («Pipeline en el celular: columnas con scroll horizontal»).

- Bajo `md` (768 px) y con `TAREAS` o `PROPIEDADES` encendidos, el pipeline se ve **una etapa a la vez**: pestañas con nombre y cuántos tratos tiene cada etapa, total de la etapa en la moneda del negocio (y cuántos sin monto o en otra moneda), renglones de 60 px con contacto, actividad, monto (toque = editar) y conversación.
- Tocar un trato abre **el mismo cajón** del tablero: mover de etapa, monto y prioridad siguen entrando por la misma puerta (perder exige motivo).
- La etapa elegida se recuerda por navegador (localStorage con try/catch).
- El tablero de escritorio no cambia. Con las banderas apagadas, el pipeline es el de upstream (`movil=false`).
- Costura en upstream: una prop `movil` en `pipeline-client.tsx`, la página pasa la bandera, y las etapas del cajón crecen a 44 px solo en pantallas táctiles.

Código: `src/components/fork/pipeline-movil.tsx`. Verificación: `tests/unit/052-pipeline-movil.test.ts`, `scripts/e2e-050-atajos.mjs` (bloque 052).
