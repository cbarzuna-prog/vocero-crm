# 058 — Leads de knockknockcr.com y referidos (fork Knock Knock)

## Contexto

El sitio (Lovable + Supabase) manda cada formulario de propiedad por la
función `submit-property-crm` a `POST {CRM}/api/webhooks/web/{WEB_LEADS_TOKEN}`.
Esa ruta se construyó a mano en el servidor y nunca se subió a GitHub; las
actualizaciones del 27/10 en adelante la borraron (404 en el sitio). Además, el
referidor (`?ref=CÓDIGO`) solo llegaba a Supabase y a HubSpot, nunca al CRM,
y los formularios de contacto, solicitud específica y vendedores no llegaban.

## Contrato

`GET  /api/webhooks/web/{token}` → `200 { ok: true }` (prueba de conexión).
`POST /api/webhooks/web/{token}` → `200 { ok: true, contactId, duplicate }`.
Llave mala o `WEB_LEADS_TOKEN` vacío o módulos del fork apagados → `404`.

```jsonc
{
  "id": "uuid del envío (idempotencia)",          // obligatorio
  "kind": "propiedad|info|contacto|solicitud|vendedor", // opcional; acepta contact, request_info, specific_request, seller…
  "name": "…", "phone": "+506 8888 1234", "email": "…", "message": "…",
  "language": "es|en",
  "property": { "id": "uuid del sitio", "url": "…/property/<uuid>", "title": "…", "code": "KK-0001" },
  "pageUrl": "…",
  "referrer": { "id": "uuid", "code": "JP123", "name": "Juan Pérez", "email": "…", "phone": "…" },
  "preferences": { "operation": "compra|alquiler", "types": ["casa"], "zones": ["Escazú"],
                   "budgetMin": 300000, "budgetMax": 450000, "currency": "USD|CRC",
                   "bedrooms": 3, "timeline": "en 2 meses" }
}
```

Compatible con lo que el sitio manda hoy (`id, name, phone, email, message,
property{id,url,title}, pageUrl`): actualizar el CRM basta para que vuelva a
funcionar. Teléfono o correo, al menos uno; 8 dígitos de CR reciben el 506.

## Qué hace el CRM con cada envío

1. Recibo `web_lead` por `id` (reintentos = un solo lead).
2. Contacto sin duplicar (teléfono, luego correo), en el pipeline.
3. Propiedad del CRM por `web_id`, por la URL en «Anuncio en portal», por
   código o por título; guarda el `web_id` para la próxima. Interés
   «Interesado» (no en formularios de vendedor).
4. Referidor (`referidor`, por id del sitio o código) y «Referido por» en el
   contacto (`contact_referencia`, el primero gana); origen «Referido».
5. Ficha inmobiliaria (fuente `web`; no pisa lo editado a mano; las listas se
   suman): correo, tipo de cliente, lo que busca, idioma.
6. Nota con tipo, propiedad, referidor y mensaje; UNA tarea abierta por
   propiedad («Responder solicitud web — KK-0001 · …» o «Contactar vendedor»),
   para el propietario con menos tareas pendientes.

## Pantallas

- **Referidos** (menú, con PROPIEDADES): leads, en juego, visitaron, cierres y
  último lead por referidor; el nombre abre Contactos filtrado.
- Contactos: filtro «Referido por» y «Ref. …» en la fila; página del contacto:
  «Referido por …».

## Servidor

- `docker-compose.yml` pasa `WEB_LEADS_TOKEN` al contenedor.
- `instalar-servidor.sh` y `conectar-agente.sh` ya no pisan cambios locales:
  si el servidor tiene archivos modificados o commits sin subir, los
  respaldan en `~/vocero-respaldo-<fecha>` y se detienen (`FORZAR=1` para
  descartarlos a propósito).

Verificación: `tests/unit/058-web-leads.test.ts`, `scripts/e2e-058-web-leads.mjs`.
Texto para el sitio: [lovable-prompt.md](lovable-prompt.md).
