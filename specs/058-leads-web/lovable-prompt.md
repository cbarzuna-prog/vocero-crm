Necesito que TODOS los formularios del sitio y los enlaces de referidores lleguen al CRM. El CRM ya está listo; solo hay que cambiar lo que el sitio le manda. No cambies la base de datos de referidos, ni HubSpot, ni el diseño.

Contexto: la función `submit-property-crm` ya llama a `POST {CRM}/api/webhooks/web/{WEB_LEADS_TOKEN}` con `{ id, name, phone, email, message, property: { id, url, title }, pageUrl }` y espera `200 { ok: true }`. Eso sigue igual. El CRM acepta además estos campos opcionales:

- `kind`: "propiedad" (formulario de contacto de una propiedad), "info" (pedir más información de una propiedad), "contacto" (formulario general de contacto), "solicitud" (solicitud específica: qué busca), "vendedor" (dueño que quiere vender o alquilar / prospecto de acuerdo de corretaje).
- `referrer`: `{ id, code, name }` del referidor cuando la persona llegó con `?ref=CÓDIGO` (el mismo que hoy se manda a `track-referral-lead`).
- `language`: "es" o "en" (idioma del sitio en ese momento).
- `preferences` (solo en «solicitud»): `{ operation: "compra"|"alquiler", types: string[], zones: string[], budgetMin: number, budgetMax: number, currency: "USD"|"CRC", bedrooms: number, timeline: string }`.

Cambios:

1. `submit-property-crm`: agregar al cuerpo que va al CRM `kind` ("propiedad" cuando source es "contact", "info" cuando es "request_info"), `language`, y `referrer` cuando exista. El navegador debe mandarle a la función el referidor que ya conoce (id, código y nombre); valida el id como UUID, el código hasta 60 caracteres y el nombre hasta 120. Si no hay referidor, no mandes el campo.

2. Formularios que hoy NO llegan al CRM — que también lleguen, por el servidor (nunca expongas WEB_LEADS_TOKEN en el navegador), con un `id` UUID nuevo por envío, el mismo `referrer` si la persona llegó con `?ref=`, y `language`:
   - Formulario general de contacto → `kind: "contacto"`.
   - Solicitud específica (tabla `specific_requests`) → `kind: "solicitud"` con `preferences` mapeado desde lo que la persona llenó.
   - Prospectos de vendedores / acuerdos de corretaje (`agreement_prospects`) → `kind: "vendedor"` con el mensaje o la descripción de su propiedad en `message`.
   Puedes generalizar `submit-property-crm` (propertyId opcional) o crear una función `submit-crm-lead` con el mismo patrón (mismo token, mismo registro de entrega, mismos límites). Lo que ya se guarda en Supabase y en HubSpot debe seguir guardándose igual: el CRM es un envío adicional y, si falla, el formulario igual responde «enviado» a la persona.

3. Registro: sigue registrando solo `requestId` y el estado HTTP del CRM. Nunca la llave, la URL completa, encabezados ni datos personales.

4. Pruebas simuladas para cada tipo de formulario (con y sin referidor). Después, haz UN envío real de prueba por tipo con nombres que empiecen con «Prueba CRM» y dime el estado HTTP de cada uno. Esperado: 200 con `ok: true`. Si da 404, la llave del sitio no coincide con `WEB_LEADS_TOKEN` del servidor: avísame y no la cambies tú.
