# 055 — Ficha inmobiliaria del cliente (fork Knock Knock)

Origen: las fichas de los leads no tenían correo, dónde vive ni qué busca.
Vocero solo guarda nombre, teléfono, notas, origen y una ficha libre (jsonb)
que llena el agente.

## Qué hace (con `PROPIEDADES=on`)

- Tabla `contact_perfil` (1:1 con `contact`, migración `0025`): correo, otro
  teléfono, dónde vive (provincia/cantón + detalle), idioma; tipo de cliente
  (comprador, vendedor, inquilino, propietario que alquila, inversionista;
  varios); qué busca (comprar/alquilar, tipos de propiedad, zonas,
  presupuesto mín–máx con moneda, habitaciones mínimas, para cuándo); cómo paga
  (contado, crédito, preaprobado).
- Sección «Cliente» en el panel del contacto (Bandeja) y el cajón del trato
  (Pipeline), antes de «Propiedades»: lectura compacta y edición en el mismo
  lugar.
- **El agente la llena**: en su perfil (`GET /api/bot/profile`) se le agregan
  las claves fijas (`INSTRUCCION_FICHA`); cuando escribe la ficha libre
  (`PUT /api/bot/ficha`), `perfilDesdeFicha` traduce esas claves («300 mil
  dólares», «Escazú y Santa Ana», «en 2 meses»…) a campos. Tolerante: lo que no
  entiende lo ignora y nunca tumba el turno.
- `fuentes` por campo (`agente` | `manual`): ✦ en pantalla marca lo que anotó
  el agente; lo que edita una persona el agente ya no lo pisa. Vaciar un campo
  se lo devuelve al agente.

## Decisiones

- Tabla propia y no columnas en `contact`: no se toca la tabla de upstream.
- Cédula fuera por ahora: dato sensible que solo hace falta al firmar.
- Sin tipo de cambio: el presupuesto guarda su moneda; el cruce con
  propiedades (047) decidirá cómo comparar US$ y ₡.

Código: `src/lib/perfil-cliente*.ts`, `src/server/perfil/`,
`src/app/api/contacts/[id]/perfil/`, `src/components/fork/perfil-cliente.tsx`;
costuras en `api/bot/ficha`, `api/bot/profile`, `contact-panel.tsx`,
`lead-drawer.tsx`. Verificación: `tests/unit/055-perfil-cliente.test.ts`,
`scripts/e2e-055-perfil.mjs`.
