# 053 — Textos de Vocero en usted (fork Knock Knock)

Carril ligero. Decisión del dueño (2026-10-23, D10 de 046): el CRM le habla al
usuario de **usted**. Los módulos del fork ya nacieron así; quedaban en tú las
pantallas heredadas (Bandeja, Pipeline, Contactos, Ajustes, Agente,
Laboratorio, guía de inicio, registro).

## Decisión: diccionario aplicado al compilar, no ediciones en upstream

Editar ~70 archivos de Vocero chocaría en cada `git merge upstream`. En su
lugar:

- `fork/textos-usted/diccionario.json`: por archivo de upstream, pares
  `[texto en tú, texto en usted]` (frases enteras, copiadas exactas).
- `fork/textos-usted/aplicar.cjs`: loader de webpack (`enforce: "pre"`) que
  reemplaza los pares antes de compilar. Única costura: `next.config.ts`.
- Los archivos de upstream quedan idénticos en git → el merge no choca.
- `tests/unit/053-textos-usted.test.ts`: cada frase sigue existiendo en su
  archivo (si Vocero la cambia, la prueba dice cuál), el resultado sigue
  siendo TypeScript válido, y ningún par toca archivos del fork ni prompts del LLM.

Alternativa descartada: reescribir el DOM en el navegador (MutationObserver):
parpadeo, no cubre lo que se renderiza en el servidor y pelea con React.

## Alcance

Todo lo que lee el usuario del CRM. Fuera: prompts del LLM y del
Laboratorio, lo que se le envía al cliente final por WhatsApp, logs,
`doctor`, seeds y mocks. Reglas de conversión: `fork/textos-usted/INSTRUCCIONES.md`.

## Límites conocidos

- Las pruebas de upstream (`tests/unit`, `scripts/e2e-selftest.mjs`) leen el
  archivo fuente o la app compilada: las que afirman una frase en tú siguen
  pasando en Vitest (no pasa por el loader) y pueden fallar en el e2e de
  upstream contra la app del fork. Es esperado.
- `next dev --turbopack` no usa loaders de webpack: el script `dev` usa webpack.
