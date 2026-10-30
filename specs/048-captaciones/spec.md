# 048 (fork) — Captaciones: el pipeline de vendedores

**Bandera**: `PROPIEDADES` (es parte del inventario; sin bandera nueva).
**Decisiones del dueño (2026-10-30)**:

- **Tablero de propiedades**, no un segundo pipeline de contactos. Cada tarjeta
  es la propiedad que se quiere captar, con su dueño. Quien vende para comprar
  sigue con un solo trato de comprador en el Pipeline (resuelve el choque con
  `lead_contact_uq` sin tocar el núcleo de Vocero ni Resultados).
- **Etapas**: Contacto → Valoración → Propuesta → Exclusiva firmada →
  Publicada, más «No se captó» (con motivo).
- **Exclusiva de 6 meses** por defecto; el CRM crea la tarea «Renovar
  exclusiva» 15 días antes del vencimiento.
- **Comisión**: en venta, porcentaje editable por propiedad (5 % por
  defecto); en alquiler, **un mes de renta**.

## Historias

1. **Nueva captación** (`/captaciones`, botón «Nueva captación»): dueño
   (contacto existente o nuevo con nombre y teléfono), operación, tipo,
   provincia/cantón/zona y lo que pide. Crea la propiedad en estado
   `captacion`, etapa Contacto, comisión 5 % si es venta, y marca al dueño como
   «vendedor» en su ficha.
2. **Mover de etapa**: arrastrando en escritorio o con «Mover a» (celular y
   teclado). Cada movimiento queda en `kk_captacion_evento` y reinicia los
   «días en la etapa».
   - **Exclusiva firmada** pide fecha de firma (hoy), vencimiento (+6 meses) y
     comisión; marca `exclusiva`, `captadaAt` y crea/actualiza la tarea
     «Renovar exclusiva — KK-…» para 15 días antes, asignada a quien la mueve,
     ligada al dueño y a la propiedad.
   - **Publicada** pasa la propiedad a `disponible` (entra al inventario).
   - **No se captó** pide motivo y pasa la propiedad a `retirada`.
   - Volver atrás desde Publicada o No se captó la regresa a `captacion`.
3. **Tarjeta**: código y título, dueño, lo que pide, comisión estimada,
   días en la etapa y el vencimiento de la exclusiva (ámbar a 30 días, rojo
   vencida). Total por columna de comisiones estimadas (USD y CRC aparte).
   Publicadas y no captadas se ven 60 días (luego viven en Propiedades);
   «No se captó» arranca plegada para que las cinco etapas quepan en una laptop.
4. **Ficha de la propiedad**: en «Interno», etapa de captación y vencimiento
   de la exclusiva; en alquiler la comisión se lee «1 mes de renta».

## Datos (migración aditiva `0028`)

- `property.captacion_etapa` (NULL = no está en el tablero: propiedades
  cargadas directo al inventario), `property.captacion_desde`,
  `property.exclusiva_vence`, `property.motivo_no_captada`.
- `kk_captacion_evento`: propiedad, de/a etapa, actor, fecha. Append-only.

## Fuera de alcance

- Crear captaciones solas desde el formulario «Quiero vender» del sitio (el
  formulario no trae provincia ni tipo; hoy crea la tarea «Contactar
  vendedor»). Siguiente paso natural.
- Reporte de captaciones en Resultados.
