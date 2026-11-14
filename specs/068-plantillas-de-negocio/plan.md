# 068 — Plan técnico

Sigue a `spec.md` (§9: primera prueba con «Estudio Bruma» + General, en el
sandbox con datos inventados).

## Principios de la implementación

- **Todo detrás de `PLANTILLAS`** (`src/server/plantillas/flag.ts`, patrón
  ADR-001). Con la bandera apagada: ninguna ruta nueva responde (404), ninguna
  pantalla cambia y la migración se aplica igual.
- **Código del fork en carpetas propias:** `src/lib/plantillas/`,
  `src/server/plantillas/`, `src/components/fork/plantillas/`. Las costuras en
  archivos de upstream se reducen a una línea donde se pueda.
- **Toda consulta pasa por `scoped()`.** Ninguna conversación `is_test` genera
  sugerencias.
- **Textos en usted.**

## Modelo de datos (migración `0032`, re-ejecutable)

| Tabla | Contenido |
|---|---|
| `kk_config_negocio` | Una fila por organización: `plantilla`, `subtipo`, `version`, `config` (JSON: la copia editable de la plantilla), `aplicada_at`, `setup_paso` (para retomar el setup). |
| `kk_etapa_criterio` | `stage_id` (FK a `pipeline_stage`), `criterio` (texto), `campos` (lista de claves), `accion`. |
| `kk_ficha_valor` | `organization_id`, `contact_id`, `campo`, `valor` (JSON), `fuente` (`manual`, `ia`, `web`, `importado`), `por` (usuario), `updated_at`. Llave única por contacto y campo. |
| `kk_registro` | Registros vinculados genéricos: `tipo` (`cita`, `pedido`…), `contact_id`, `titulo`, `estado`, `fecha`, `importe_cents`, `moneda`, `datos` (JSON), con marcas de tiempo. |
| `kk_sugerencia` | `contact_id`, `campo` (o `__etapa`), `valor` (JSON), `evidencia` (texto e id del mensaje), `estado` (`pendiente`, `aceptada`, `descartada`), `creada_at`. |
| `kk_extraccion` | `contact_id`, `ultimo_mensaje_id`: para no volver a extraer de lo ya leído. |

Bienes raíces (más adelante) sigue usando `contact_perfil` a través de un
adaptador; no se toca en esta fase.

## Piezas

1. **Tipos y reglas** — `src/lib/plantillas/tipos.ts` (`Plantilla`, `Campo`,
   `Etapa`, `TipoRegistro`) y `reglas.ts` (esquema Zod más las reglas de §3:
   ningún campo de salud fuera del módulo clínico, ningún campo sensible que se
   pida por chat, criterios que apuntan a campos existentes, solo nombre y
   contacto obligatorios).
2. **Plantillas** — `src/lib/plantillas/general.ts`, `bruma.ts` y un índice
   `catalogo.ts`. Bruma es `demo: true`: solo aparece si la instancia es el
   sandbox o si `PLANTILLAS_DEMO=on`.
3. **Aplicar** — `src/server/plantillas/aplicar.ts`: `aplicarPlantilla(org,
   clave)`, idempotente. Reemplaza las etapas solo si el negocio todavía no
   tiene tratos; si ya los tiene, agrega las que faltan y no borra ninguna.
   Escribe la configuración de atención (062) y la fila de `kk_config_negocio`.
4. **Configuración en uso** — `src/server/plantillas/config.ts`:
   `configNegocio(org)`, que devuelve la configuración (o `null` sin
   plantilla). Desde ahí salen el vocabulario del menú, los campos de la ficha
   y los tipos de registro.
5. **Setup** — página `/bienvenida`. Paso 1: tipo de negocio. Paso 2: nombre,
   logo y color (reusa la marca de upstream). Paso 3: WhatsApp (enlaza al
   asistente existente, o «Conectar después»). Con `PLANTILLAS` encendida y sin
   plantilla, «Hoy» y la guía de inicio llevan a `/bienvenida`.
6. **Ficha dinámica** — `components/fork/plantillas/campos-ficha.tsx`: grupos
   «Al primer contacto», «Durante la venta» y «Más datos» (plegado); edición en
   línea por tipo de campo; campos condicionales. `registros-ficha.tsx`:
   tarjetas de los registros vinculados con «Nuevo» (por ejemplo, «Nueva
   cita»). Costura en `contacto-pagina.tsx`: una tarjeta.
7. **Criterio de etapa** — en `BarraEtapas` (fork) y en el panel de la Bandeja:
   lista de verificación de la etapa siguiente y botón «¿Pasar a…?» cuando se
   cumple.
8. **Sugerencias de la IA** — `src/server/plantillas/extraer.ts`: al abrir la
   ficha o el chat, si hay mensajes entrantes posteriores a `kk_extraccion`,
   llama a `chatJson` con los campos permitidos (sin los sensibles ni los que
   no se piden por chat) y guarda sugerencias con evidencia. Extracción robusta:
   valida con Zod cada valor contra el tipo del campo y descarta lo inválido.
   Sin IA o con error, no hace nada. Rama nueva en `ai-mock` con la marca
   `[[EXTRAER_FICHA]]`. UI: `sugerencias.tsx` (Aceptar y Descartar) en la ficha
   y en el panel de la Bandeja.
9. **Ajustes → Mi negocio** — v1: renombrar el vocabulario, editar el criterio y
   la acción de cada etapa, mostrar o esconder campos de la plantilla, y editar
   el catálogo de servicios.
10. **Datos inventados para el sandbox** — `scripts/sembrar-demo-bruma.mjs`:
    crea, por la API de la app, unos 25 clientes con conversaciones simuladas
    (wa-mock), citas, servicios y tratos en varias etapas. El instalador gana la
    opción `ENTORNO=sandbox DATOS=demo`: base vacía (sin copiar el real) +
    `PLANTILLAS=on` + `PLANTILLAS_DEMO=on`.

## Pruebas

- **Unitarias:** `tests/unit/068-plantillas.test.ts`. Cubren las reglas, que
  General y Bruma pasan el esquema, que una plantilla con un campo de salud o
  una cédula pedida por chat se rechaza, la idempotencia de aplicar (en pruebas
  de servicio con la base de datos de pruebas), la validación de los valores
  extraídos y los criterios de etapa.
- **De punta a punta:** `scripts/e2e-068-plantillas.mjs`, con dev + mocks:
  1. Setup completo con Bruma, y lo que se configuró.
  2. La ficha muestra los campos de Bruma y se crea una cita.
  3. Un mensaje del wa-mock produce una sugerencia, que se acepta desde la
     Bandeja.
  4. El criterio sugiere el cambio de etapa.
  5. Sin IA no hay sugerencias y nada se rompe.
  6. Con General: ficha mínima.
  7. Con `PLANTILLAS` apagada, las rutas nuevas dan 404 y la ficha queda igual
     (garantía para Knock Knock).
- **Gate:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test` y las
  pruebas de punta a punta de 046, 057, 062, 063, 065 y 067 siguen en verde.

## Riesgos

- **Que la IA sugiera mal.** Mitigación: nunca escribe sola, siempre muestra la
  evidencia, y se mide qué porcentaje de sugerencias se acepta.
- **Que el motor complique la ficha de Knock Knock.** Mitigación: bandera
  apagada en el real y la prueba de punta a punta 7.
- **Tamaño.** Se construye por fases, cada una con su commit y sus pruebas en
  verde (ver `tasks.md`).
