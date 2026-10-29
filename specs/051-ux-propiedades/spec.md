# 051 — UX de Propiedades (fork Knock Knock)

Carril ligero. Origen: diagnóstico de diseño (2026-10-24), punto 3, y revisión UX P2-10 / P3-13.

## Lista de propiedades
- Título con línea de hallazgo: «8 disponibles · 2 reservadas · 3 con interesados» (`resumenPropiedades`).
- Vista **Cuadrícula / Lista** (lista densa: miniatura, título, zona y medidas, estado, interesados, precio alineado a la derecha). La elección se recuerda por navegador (localStorage, con try/catch).
- **Orden**: más recientes, precio mayor→menor, menor→mayor (`ordenarPropiedades`). Sin tipo de cambio no se mezclan monedas: US$ primero, luego ₡; sin precio al final.
- Tarjetas de igual altura; rejilla `auto-fill` (4 columnas a 1440 px); esqueleto mientras carga.
- En el celular «Filtros» queda en ícono y el orden vive dentro del panel de filtros.

## Ficha
- En el celular el orden es foto → precio → **interesados** → datos (antes los interesados quedaban al final del formulario).
- Datos, Descripción e Interno se pliegan en el celular a título + resumen; siempre abiertos en escritorio. Datos y Descripción arrancan abiertos si están vacíos; **Interno arranca plegado** (se puede enseñar la ficha sin destapar vendedor, comisión ni notas).
- Sin fotos, el recuadro entero es «Agregar fotos» y acepta arrastrar y soltar.
- «Cambiar» vendedor con diana de 44 px en táctil.

## Verificación
`tests/unit/051-ux-propiedades.test.ts` · `scripts/e2e-050-atajos.mjs` (bloque 051).
