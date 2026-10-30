# 059 (fork) — Lo que llega del sitio, bien presentado

Ajustes tras las primeras pruebas reales de knockknockcr.com (058).

1. **La tarea no nace vencida.** «Responder solicitud web» vence una hora después
   de que llega (`PLAZO_RESPUESTA_MS`): rojo solo si de verdad nadie contestó.
2. **Origen «Sitio web».** Un contacto que llenó un formulario muestra «Sitio web»
   en Contactos y en su página (no «Contenido orgánico»), y el filtro Origen tiene
   la opción. Lo que alguien capturó distinto a mano se respeta (`origenDe`).
3. **Las notas son de las personas.** El mensaje del formulario ya no se pega en
   `contact.notes`: queda en `kk_web_solicitud.mensaje` (migración 0027) y se ve en
   la tarjeta «Del sitio web» de la página del contacto (tipo, propiedad, referidor,
   mensaje, enlace a la página) y en su Historia.

Pruebas: `tests/unit/059-leads-web-ux.test.ts` y los checks «059:» de
`scripts/e2e-058-web-leads.mjs`.
