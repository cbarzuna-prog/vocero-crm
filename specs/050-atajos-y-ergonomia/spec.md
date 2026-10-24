# 050 — Atajos de trabajo diario y ergonomía

**Feature Branch**: `feat/046-propiedades-y-tareas` (fork Knock Knock)

**Created**: 2026-10-24

**Status**: Especificada e implementada el mismo día a partir de la revisión
UX/UI (`revision-ux-ui.md`) y el diagnóstico de diseño (`diagnostico-diseno.md`)
del proyecto, a pedido del dueño. Gates y self-tests en verde.

**Carril**: ligero. Sin migración y sin contrato publicado: usa las rutas de
046 y una ruta interna nueva, `POST /api/propiedades/[id]/enviar`, que envía
por el mismo camino de la Bandeja (ventana de 24 h, sandbox, canal).

## Problema

Lo que más estorba a un corredor no es estético: son los pasos de más.
Reprogramar una tarea no existía, llamar exigía entrar al contacto, mandar una
propiedad a un comprador eran tres pantallas, y en el celular todo estaba
detrás del menú ☰ con botones de 32 px.

## Comportamiento

- **H1 — Reprogramar y editar.** Cada tarea tiene un menú: «Mañana», «En 3
  días», «Próxima semana» (conservan la hora), «Editar» y «Borrar». Completar,
  reprogramar y borrar se deshacen 8 s desde el aviso de abajo; nada pide
  confirmación del navegador.
- **H2 — La acción de la tarea, en la tarea.** Una llamada trae «Llamar»
  (`tel:`); un WhatsApp abre la conversación. Si la tarea es de una propiedad,
  se ve su foto.
- **H3 — Enviar ficha.** En la ficha (por interesado) y en el panel del
  contacto (por propiedad): manda la descripción compartible y hasta 3 fotos
  por WhatsApp, y el comprador pasa a «Ficha enviada» sin retroceder si ya iba
  más adelante. Sin conversación o con la ventana de 24 h cerrada lo dice y no
  envía nada. Nunca sale lo interno (vendedor, comisión, notas).
- **H4 — Crear rápido.** «Crear» en la barra lateral y «+» en el celular:
  contacto, tarea (con propiedad opcional) o propiedad.
- **H5 — Barra inferior en el celular:** Hoy · Bandeja · «+» · Propiedades ·
  Más (con contadores). El «+» va en la barra, no flotando sobre el contenido.
- **H6 — «Hoy»** con título principal y el hallazgo del día debajo («4
  vencidas, la más antigua de hace 3 días»), y en escritorio dos columnas
  (tareas | sin siguiente paso, con las 6 primeras y «Ver los N»).

## Ergonomía (de los diagnósticos)

- Gris terciario a #5e6a83 (4.5:1 sobre todas las superficies claras; medía
  3.2:1) y etiquetas de sección en tipo oración de 12 px en vez de mayúsculas
  espaciadas de 10.5 px: un cambio de estilos que alcanza también a las
  pantallas de upstream.
- En pantallas táctiles, botones y campos de 44 px (y texto de 16 px en los
  campos, que además evita el zoom de iOS).
- Texto de los módulos del fork con piso de 13 px; cifras tabulares en precios.

## Fuera de alcance

- **Marca Knock Knock** (logo, color, barra lateral clara): espera el logo y el
  color del dueño; se hace por Ajustes → Marca y tokens.
- Vista de lista densa de Propiedades y Pipeline en el celular (diagnóstico §3).

Self-tests: `scripts/e2e-050-atajos.mjs` (navegador real, celular; con
`E2E_WA_MOCK=1` y el mock de WhatsApp en `pnpm dev`, también el envío real).
