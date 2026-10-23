# 046 — Modelo de datos

Migración aditiva `0023_propiedades_y_tareas`. Solo crea tablas: no altera
ninguna columna existente, así que una instancia con las banderas apagadas
queda exactamente igual (tablas vacías e inertes, mismo criterio que 015).

Todas las tablas: `id text PK` con `newId()` (prefijos nuevos en
`src/lib/db/ids.ts`), `organization_id NOT NULL` → `organization` (cascade),
índice que empieza por `organization_id`, y toda consulta por `scoped()`.
Tiempos en UTC (invariante del proyecto).

## Prefijos nuevos

| Clave | Prefijo |
|---|---|
| `property` | `prop` |
| `propertyPhoto` | `pph` |
| `propertyInterest` | `pint` |
| `propertyInterestEvent` | `pie` |
| `task` | `tsk` |

## `property`

| Columna | Tipo | Notas |
|---|---|---|
| `code` | text NOT NULL | Código interno legible, `KK-0001`. Único por org. Se genera al crear (siguiente número de la org); editable |
| `title` | text NOT NULL | «Casa en Valle del Sol». Default sugerido: tipo + zona |
| `operation` | enum `venta` · `alquiler` | NOT NULL |
| `type` | enum `casa` · `apartamento` · `lote` · `local` · `oficina` · `bodega` · `finca` | NOT NULL |
| `status` | enum `captacion` · `disponible` · `reservada` · `vendida` · `alquilada` · `retirada` | NOT NULL default `disponible`. `captacion` = aún sin contrato firmado |
| `price_cents` | bigint | NULL = sin precio todavía. **bigint**: USD 1M = 100 000 000 centavos cabe en integer, pero CRC 500M no |
| `currency` | enum `USD` · `CRC` | NOT NULL default `USD` (D2) |
| `provincia` · `canton` · `distrito` | text | Contra catálogo `src/lib/cr-zonas.ts`; `provincia` NOT NULL |
| `zona` | text | Libre: condominio, barrio |
| `lat` · `lng` | double precision | Opcionales |
| `m2_construccion` · `m2_terreno` | integer | |
| `habitaciones` · `banos_x2` · `parqueos` | smallint | Los baños admiten medios: se guardan ×2 para no usar decimales (2.5 baños = 5) |
| `descripcion_publica` | text | Lo compartible con el comprador (D9) |
| `notas_internas` | text | Nunca en vistas para el comprador |
| `seller_contact_id` | text → `contact` (set null) | Vendedor (H2) |
| `comision_bp` | integer | Comisión en puntos básicos: 5 % = 500 |
| `exclusiva` | boolean NOT NULL default false | |
| `captada_at` | date | Fecha de captación |
| `url_externa` | text | Anuncio en portal |
| `cover_photo_id` | — | No se guarda: es la foto en `position = 0` |
| `created_by` | text → `user` (set null) | |
| `created_at` · `updated_at` | timestamp | |
| `archived_at` | timestamp | Borrado suave; una propiedad con interesados no se borra físico |

Índices: `(organization_id, code)` UNIQUE · `(organization_id, status, operation)` ·
`(organization_id, canton)` · `(organization_id, seller_contact_id)`.

## `property_photo`

| Columna | Tipo | Notas |
|---|---|---|
| `property_id` | → `property` (cascade) | |
| `media_asset_id` | → `media_asset` (cascade) | Reusa el almacén (`guardarMedia`), `kind = image` |
| `position` | integer NOT NULL | 0 = portada |

Índice `(organization_id, property_id, position)`. Tope de 20 por propiedad,
validado en el servidor.

## `property_interest`

| Columna | Tipo | Notas |
|---|---|---|
| `contact_id` | → `contact` (cascade) | El comprador |
| `property_id` | → `property` (cascade) | |
| `status` | enum `interesado` · `enviada` · `visitada` · `oferto` · `ganada` · `descartada` | Estado ACTUAL; lo escribe solo la puerta única |
| `note` | text | |
| `created_at` · `updated_at` | timestamp | |

UNIQUE `(organization_id, contact_id, property_id)`. Índices por
`(organization_id, property_id)` y `(organization_id, contact_id)`.

## `property_interest_event` (append-only)

Mismo patrón que `lead_stage_event`: **la única puerta que escribe aquí y en
`property_interest.status` es `src/server/propiedades/interes.ts`**, con un test
de vigilancia que falla si aparece otra escritura.

| Columna | Tipo | Notas |
|---|---|---|
| `interest_id` | → `property_interest` (cascade) | |
| `contact_id` · `property_id` | denormalizados | Para agregados sin join |
| `from_status` | enum, NULL | NULL = creación |
| `to_status` | enum NOT NULL | |
| `discard_reason` | enum `precio` · `zona` · `tamano` · `estado_propiedad` · `eligio_otra` · `otro`, NULL | Opcional (H3) |
| `actor_user_id` | → `user` (set null) | |
| `occurred_at` | timestamp NOT NULL | |

Índices `(organization_id, occurred_at)` · `(interest_id, occurred_at)`.

## `task`

| Columna | Tipo | Notas |
|---|---|---|
| `contact_id` | → `contact` (cascade) NOT NULL | D6 |
| `property_id` | → `property` (set null) | Opcional |
| `title` | text NOT NULL | |
| `type` | enum `llamada` · `whatsapp` · `visita` · `otro` | default `llamada` |
| `due_at` | timestamp NOT NULL | UTC; la UI la muestra en la zona del negocio |
| `all_day` | boolean NOT NULL default false | «Hoy, sin hora» |
| `done_at` | timestamp | NULL = pendiente |
| `assigned_user_id` | → `user` (set null) | default quien la crea |
| `created_by` | → `user` (set null) | |
| `created_at` · `updated_at` | timestamp | |

Índices: `(organization_id, done_at, due_at)` (la consulta de «Hoy») ·
`(organization_id, contact_id)` · `(organization_id, assigned_user_id, done_at, due_at)`.

## Consultas derivadas (sin tabla)

- **«Sin siguiente paso»** (D7): leads cuya etapa es `kind = open`, de
  conversaciones no `is_test`, sin ninguna `task` con `done_at IS NULL` para su
  contacto. Ordenados por `lead.last_activity_at` ascendente (el más olvidado
  primero).
- **Vencidas / Hoy**: `done_at IS NULL AND due_at < inicio_de_hoy` /
  `entre inicio y fin de hoy`, con «hoy» en la zona del negocio
  (`src/server/analytics/period.ts` ya resuelve la zona).
