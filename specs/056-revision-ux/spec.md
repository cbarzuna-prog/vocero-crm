# 056 — Arreglos de la revisión de UX y accesibilidad (fork Knock Knock)

Origen: revisión externa (2026-10-29) de Hoy, Bandeja, Pipeline, Contactos y
«Crear → Contacto». Carril ligero; este lote cubre lo marcado «arreglar
primero» y los arreglos rápidos. Lo grande queda en «Siguiente lote».

## Hecho

- **Diálogo accesible del fork** (`components/fork/dialogo.tsx`): portal a
  `<body>` (abierto desde la barra lateral quedaba atrapado en 190 px),
  `aria-modal` + `aria-labelledby`, foco al primer campo, Tab y Mayús+Tab no
  salen, Esc cierra, el foco vuelve a quien lo abrió. Lo usan Nuevo contacto,
  Nueva/Editar tarea y Nueva propiedad.
- **Nuevo contacto para Costa Rica** (`fork/nuevo-contacto-dialog.tsx`,
  reemplaza al de upstream en Contactos y en «Crear»): código de país con
  +506 por defecto (+1, +52, +34, otro), `type=tel` + `inputmode` +
  `autocomplete`, obligatorios con asterisco y `aria-required`, botón siempre
  activo con el error debajo del campo (`aria-invalid` + `aria-describedby`),
  ejemplos inmobiliarios, en usted.
- **Barra lateral con la marca de knockknockcr.com**: fondo `#083F59`, lo
  activo con marca naranja `#FD5D08` (en `globals.css`, bloque del fork). El
  acento del CRM (Ajustes → Marca) pasó de `#878787` a `#083F59`: los
  botones principales ya no parecen deshabilitados.
- **Pie de la barra**: sonido, tema y «Salir» en su propia fila de 36 px con
  tooltip; el nombre ya no se corta; `title` en el nombre del negocio.
- Bandeja vacía sin «Cargar datos de demostración» en la instancia del fork.
- Un solo tipo de letra: sin la serif itálica en la bandeja vacía.
- Pipeline: textos de 11 px a 12 px.

## Ya existía (la revisión no lo vio)

- Cambiar de etapa sin arrastrar: el cajón del trato tiene los botones de
  etapa; la tarjeta abre con Enter/Espacio.
- Total por columna del pipeline (pie de cada columna).
- Duplicados por teléfono: el alta responde «ese teléfono ya es de…».
- Las 6 tareas «Responder solicitud web — KK-0001» son de 6 contactos
  distintos que llegaron por el formulario web, no duplicados.

## Siguiente lote (propuesto)

Contactos (orden, filtros por origen/propiedad, selección múltiple,
«Deshacer» al archivar, tooltips), tarjeta del pipeline con código de
propiedad y días en la etapa, Hoy agrupado por propiedad, ficha de contacto
de página completa, y match con propiedades (047).

Verificación: `tests/unit/056-nuevo-contacto.test.ts`,
`scripts/e2e-056-revision.mjs`.
