# 046 — Propiedades, interés por propiedad y tareas con vista «Hoy»

**Feature Branch**: `feat/046-propiedades-y-tareas`

**Created**: 2026-10-23

**Status**: Especificada antes de escribir código. Pendiente de aprobación del
dueño (Carlos) antes del plan.

**Input**: primera feature del fork `cbarzuna-prog/vocero-crm` para Knock Knock
(corretaje inmobiliario en Costa Rica, dos personas a medio tiempo). Decisión
del dueño (chat 2026-10-23): **el CRM es la única fuente de verdad de las
propiedades** (opción C); HouseMatch Studio queda aparcado y sus ideas entran
después como features del CRM.

**Carril**: ciclo completo (Principio VI). Toca el modelo de datos (tablas
nuevas, migración aditiva `0023`). No toca ningún contrato publicado: `/api/bot/*`,
el despacho y SSE no cambian de forma en esta spec (ver «Fuera de alcance»).

## Problema

Vocero organiza conversaciones y un trato por contacto, pero en corretaje el
objeto central es **la propiedad**:

1. No hay dónde registrar el inventario (precio, zona, características, quién
   vende, comisión, exclusividad).
2. No se puede ver **qué comprador está interesado en qué propiedad** ni en qué
   punto va con cada una (le enviamos la ficha, la visitó, ofertó, la descartó).
3. No existen **tareas ni seguimientos**. Un equipo a medio tiempo no pierde
   tratos por falta de funciones: los pierde por olvidar la llamada del jueves.
   Hoy lo único con fecha es una cita de la Agenda.

## Historias (en orden de prioridad)

**H1 — Registrar y encontrar propiedades (P1).** Desde el menú «Propiedades»
doy de alta una propiedad, la veo en una lista con foto, precio y zona, la
filtro (operación, tipo, estado, zona, rango de precio) y abro su ficha.

*Acepta si*: creo una casa en venta en Escazú a USD 450,000 con 3 fotos;
aparece en la lista; al filtrar «Alquiler» desaparece; al filtrar «Escazú» y
«300k–500k» reaparece; su ficha muestra todos los campos y la galería.

**H2 — Saber quién vende (P1).** Una propiedad puede tener un vendedor, que es
un contacto del CRM (el mismo que escribe por WhatsApp). Desde la ficha del
contacto veo las propiedades que vende.

*Acepta si*: asigno a «Laura Mora» como vendedora; en el panel de contacto de
Laura en la Bandeja aparece la propiedad; al abrirla llego a su ficha.

**H3 — Vincular compradores a propiedades (P1).** Desde la conversación o el
drawer del lead, vinculo al comprador con una o varias propiedades y marco su
estado con cada una: `interesado → enviada → visitada → ofertó → descartada`
(más `ganada` cuando se cierra con esa propiedad). Desde la ficha de la
propiedad veo a todos sus interesados y en qué estado va cada uno.

*Acepta si*: vinculo a Pedro con dos propiedades; en la casa de Escazú aparece
Pedro en «visitada» y en el apartamento en «enviada»; descartar una pide motivo
opcional; el historial de cambios de estado queda con fecha.

**H4 — Tareas de seguimiento (P1).** En cualquier contacto (y opcionalmente
ligada a una propiedad) creo una tarea con tipo (llamada, WhatsApp, visita,
otro), fecha y hora límite, y la marco como hecha. Al completarla el CRM me
ofrece crear la siguiente.

*Acepta si*: creo «Llamar a Pedro para segunda visita» mañana 10:00 tipo
llamada; aparece en el contacto y en «Hoy» mañana; al marcarla hecha se ofrece
la siguiente; si la hago con un clic, queda hecha sin pasos extra.

**H5 — Vista «Hoy» como pantalla de inicio (P1).** Una pantalla que responde
«¿qué hago hoy?»: tareas **vencidas** (en rojo, primero), tareas **de hoy**, y
**tratos abiertos sin próxima tarea** («sin siguiente paso»). Cada renglón
lleva a la conversación con un clic. Con la bandera encendida, es la página a
la que se llega al entrar.

*Acepta si*: con una tarea vencida, una de hoy y un lead abierto sin tareas,
«Hoy» muestra los tres en ese orden; completar la de hoy la saca de la lista
sin recargar; el contador de vencidas aparece en el menú.

## Decisiones

**D1 — Detrás de banderas, como todo módulo opcional (ADR-001/002).**
`PROPIEDADES=on` enciende H1–H3; `TAREAS=on` enciende H4–H5. Apagadas, sus
pantallas y APIs responden 404 y la migración se aplica igual. Son dos banderas
porque las tareas sirven a cualquier negocio (SACC las necesitará sin
propiedades) y así el fork sigue siendo fusionable con `upstream`.

**D2 — La moneda va por propiedad.** En Costa Rica las propiedades se cotizan
en USD aunque el negocio opere en CRC. Cada propiedad guarda `price_cents` +
`currency` (USD o CRC; default USD). La lista no suma monedas distintas.

**D3 — Zona en tres niveles fijos de Costa Rica**: provincia, cantón y
distrito como texto con autocompletado sobre un catálogo estático
(`src/lib/cr-zonas.ts`), más un campo libre «zona / condominio» (p. ej.
«Valle del Sol»). Sin mapas ni geocodificación en v1: coordenadas opcionales.

**D4 — Fotos en el disco local (`MEDIA_DIR`)**, reutilizando `media_asset` y
`src/lib/storage`. Sin S3 (constitución II). Máximo 20 fotos por propiedad,
reordenables; la primera es la portada.

**D5 — El vínculo comprador↔propiedad es por contacto**, no por lead: el lead
sigue siendo uno por contacto (no se toca `lead_contact_uq` en esta spec). Un
comprador puede estar vinculado a N propiedades, cada una con su estado. Los
cambios de estado se registran append-only (mismo patrón que
`lead_stage_event`), para poder medir después «cuántas visitas hasta ofertar».

**D6 — Las tareas siempre cuelgan de un contacto**; propiedad opcional.
Llevan `assigned_user_id` (default: quien la crea). Con dos personas parece
innecesario, pero agregarlo después obliga a un backfill; agregarlo hoy cuesta
una columna. Filtro «Mías / Todas» en «Hoy».

**D7 — «Sin siguiente paso» se calcula, no se guarda.** Un lead abierto (etapa
`open`) sin ninguna tarea pendiente aparece ahí. No hay recordatorios
automáticos ni notificaciones push en v1; el contador del menú es el aviso.

**D8 — Alta rápida por encima de completa.** El formulario de propiedad pide
solo operación, tipo, precio, moneda y zona para guardar; el resto se llena
después. Una tarea se crea con título + fecha (tipo default «llamada»).

## Datos (resumen; el detalle va en `data-model.md` del plan)

| Tabla | Para qué | Campos clave |
|---|---|---|
| `property` | Inventario | código interno, título, operación (venta/alquiler), tipo (casa, apartamento, lote, local, oficina, bodega, finca), estado (disponible, reservada, vendida, alquilada, retirada), precio + moneda, provincia/cantón/distrito, zona libre, m² construcción, m² terreno, habitaciones, baños, parqueos, descripción, `seller_contact_id`, comisión %, exclusiva (sí/no), fecha de captación, URL externa (anuncio en portal) |
| `property_photo` | Galería | `property_id`, `media_asset_id`, posición |
| `property_interest` | Comprador↔propiedad | `contact_id`, `property_id`, estado actual, nota; único por par |
| `property_interest_event` | Historial append-only | de/a estado, motivo de descarte, actor, fecha |
| `task` | Seguimientos | `contact_id`, `property_id?`, título, tipo, `due_at`, `done_at`, `assigned_user_id`, `created_by` |

Todas con `organization_id NOT NULL` y consultas por `scoped()` (constitución III).

## Fuera de alcance (y por qué)

- **Importar inventario con scraper de portales** (lo que hacía HouseMatch).
  La constitución de upstream (VIII) excluye el scraping y además los portales
  lo prohíben en sus términos. **Alternativa**: importación por CSV de
  propiedades, siguiendo el patrón de la 027. Spec siguiente.
- **Dos pipelines (compradores y vendedores).** Requiere una tabla `pipeline`
  por encima de `pipeline_stage` y toca analytics; merece su propia spec.
  Mientras tanto se usa el campo `source`/ficha del contacto para distinguir.
- **Puntaje de coincidencia comprador↔propiedad** y el asistente de
  descubrimiento (ideas de HouseMatch). Necesitan primero que existan las
  preferencias del comprador; van en una spec posterior.
- **Exponer propiedades al cerebro de IA** (`/api/bot/properties`). Es un
  contrato publicado nuevo; se especifica aparte cuando haya agente conectado.
- **Portal público de propiedades** para compradores. Es otro producto; podrá
  leer de este CRM más adelante.
- **Notificaciones push / email de tareas.** Sin terceros en el núcleo.

## Riesgos y supuestos (Principio VII)

- **Supuesto**: los dos usuarios trabajan desde el teléfono buena parte del
  tiempo. Todas las pantallas nuevas MUST funcionar a 380px de ancho; «Hoy» se
  diseña móvil primero. *Confirmar con Carlos.*
- **Supuesto**: USD y CRC bastan como monedas. *Confirmar.*
- **Riesgo**: divergencia con `upstream`. Mitigación: código nuevo en carpetas
  propias (`src/server/propiedades/`, `src/server/tareas/`,
  `src/components/propiedades/`, `src/components/hoy/`); los archivos de
  upstream solo se tocan en las costuras (schema, nav, panel de contacto,
  drawer del lead).
