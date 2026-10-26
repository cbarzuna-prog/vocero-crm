# 054 — Leads desde los formularios de knockknockcr.com

**Feature Branch**: `feat/054-leads-desde-la-web` (sale de `feat/046-propiedades-y-tareas`)

**Created**: 2026-10-26

**Status**: Implementada y verificada (2026-10-26): `pnpm typecheck`, `pnpm lint`,
`pnpm build`, `pnpm test` (1549 verdes) y `scripts/e2e-054-leads-web.mjs`
(21 checks verdes; con `E2E_FLAG_OFF=1`, 404). Especificada antes de escribir código. Pedido del dueño (Carlos,
chat 2026-10-26): «conectar con un webhook los formularios que están en cada
propiedad para que llegue el interesado al CRM».

**Carril**: ciclo ligero. Una tabla nueva (migración aditiva `0025`), una ruta
nueva tras bandera. No toca contratos publicados (`/api/bot/*`, despacho, SSE).

## Problema

La web pública (knockknockcr.com, hecha en Lovable) tiene un formulario en cada
ficha de propiedad: nombre, email, teléfono y mensaje. Hoy esos datos se quedan
en la base de la web (y en HubSpot): nadie del equipo los ve en el CRM, no
crean trato, no quedan vinculados a la propiedad y no generan un seguimiento.
Un lead de portal que no se contesta en minutos se enfría.

## Historias

**H1 — El interesado entra al CRM (P1).** Cuando alguien envía el formulario
de una propiedad, en segundos aparece en el CRM como contacto con su trato en
la primera etapa del pipeline («Nuevo lead»).

*Acepta si*: un POST válido crea el contacto con el nombre y el teléfono
(+506 normalizado), guarda el email en su ficha y crea el trato en la primera
etapa abierta.

**H2 — Queda vinculado a la propiedad (P1).** El interesado aparece en
«Compradores interesados» de la propiedad por la que preguntó, con su mensaje
como nota.

*Acepta si*: con `PROPIEDADES=on`, el formulario de la ficha KK-0001 deja al
contacto vinculado a KK-0001 en estado `interesado`.

**H3 — Hay una tarea para contestarle (P1).** Aparece en «Hoy» una tarea
«Responder solicitud web — <propiedad>», tipo WhatsApp, vencida desde ya.

*Acepta si*: con `TAREAS=on`, tras el POST «Hoy» muestra la tarea.

**H4 — No se duplica (P1).** Si la web reintenta el mismo envío, no se crea
un segundo trato, vínculo ni tarea. Si una persona que ya existe (porque
escribió por WhatsApp) llena el formulario, se reconoce por su teléfono.

## Decisiones

**D1 — Detrás de la bandera `LEADS_WEB`** (apagada por defecto, ADR-001):
apagada, la ruta responde 404. Las partes de propiedad y tarea se degradan
solas si `PROPIEDADES` o `TAREAS` están apagadas: el contacto y el trato
entran igual.

**D2 — Autenticación por URL secreta.** Ruta
`POST /api/webhooks/web/<WEB_LEADS_TOKEN>`. El token es una variable de
entorno de al menos 32 caracteres; sin él la ruta es 404. Comparación
timing-safe, igual que el webhook de WhatsApp. La URL se trata como
contraseña: se llama **desde el servidor** de la web (función de Lovable
Cloud), nunca desde el navegador.

**D3 — Contrato de entrada** (JSON, validado con Zod):

```json
{
  "id": "opcional: id de la solicitud en la web, para no duplicar",
  "name": "Ana Rojas",
  "phone": "+506 6481-3100",
  "email": "ana@correo.com",
  "message": "¿Se puede visitar el sábado?",
  "property": {
    "id": "4c8bfbf0-... (id de la propiedad en la web)",
    "url": "https://knockknockcr.com/property/4c8bfbf0-...",
    "code": "KK-0001",
    "title": "Terreno Plano Premium en La Guácima"
  },
  "pageUrl": "opcional"
}
```

Obligatorios: `name` y `phone`. Todo lo demás es opcional. Campos de más se
ignoran (la web puede mandar su fila entera).

**D4 — Teléfono costarricense.** Se dejan solo dígitos; `00` inicial se quita;
8 dígitos → se antepone `506`. Así coincide con el `wa_id` que manda Meta y la
persona que luego escribe por WhatsApp es el MISMO contacto (resolución por
`getOrCreateContact`). Un teléfono con menos de 8 dígitos se rechaza con 400.

**D5 — El trato nunca retrocede.** Si el contacto no tiene trato, se crea en
la primera etapa abierta (`createLeadForContact`, fuente `sistema`). Si ya lo
tiene, solo se actualiza su última actividad: el CRM no mueve etapas por un
formulario.

**D6 — Cómo se encuentra la propiedad**, en este orden: (1) `property.code`
igual al código del CRM; (2) el `property.id` de la web contenido en el campo
«Anuncio en portal (URL)» (`url_externa`) de alguna propiedad; (3) la
`property.url` igual a `url_externa`. Sin coincidencia: el lead entra igual,
sin vínculo, y la nota lo dice con el título que mandó la web.

**D7 — Dónde queda el mensaje.** En la nota del vínculo con la propiedad
(si se creó) y anexado a las notas del contacto con fecha y propiedad, para
verlo aunque no haya vínculo. La solicitud entera queda en `web_lead`.

**D8 — Idempotencia por `web_lead`** (constitución IV). Tabla nueva con
`UNIQUE (organization_id, external_id)`. `external_id` = el `id` de la web o,
si no viene, el SHA-256 del teléfono + propiedad + mensaje. Un duplicado
responde 200 con `duplicate: true` y no toca nada más.

**D9 — La tarea se asigna al dueño** de la organización (rol `owner`) y
`created_by` queda vacío (la creó el sistema).

**D10 — No se le escribe al cliente automáticamente.** Fuera de la ventana de
24 h, WhatsApp solo permite plantillas aprobadas; el primer mensaje lo manda
una persona desde la Bandeja con una plantilla. Envío automático: spec aparte.

**D11 — Respuestas.** 200 `{ ok, contactId, leadCreated, propertyId,
duplicate }` · 400 cuerpo inválido (con el detalle, para que quien integra lo
vea) · 404 bandera apagada o token malo · 500 error interno (la web debe
registrarlo pero no bloquear al visitante).

## Fuera de alcance

- Formularios de búsqueda a la medida (`specific_requests`) y clics a
  WhatsApp: se agregan con el mismo endpoint cuando se decidan sus reglas.
- Fuente «Web» en Resultados: `contact.source` no tiene ese valor; agregarlo
  toca analytics y la UI de fuente. Spec aparte.
- Firma HMAC del cuerpo: la URL secreta basta para un llamador de servidor a
  servidor; se agrega si la web pasa a llamarlo desde otro lado.
