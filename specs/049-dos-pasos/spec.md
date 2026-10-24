# 049 — Verificación en dos pasos (2FA)

**Feature Branch**: `feat/046-propiedades-y-tareas` (fork Knock Knock)

**Created**: 2026-10-24

**Status**: Especificada e implementada el mismo día a pedido del dueño
(revisión de seguridad, chat 2026-10-23). Gates y self-test E2E en verde.

**Carril**: ligero, con el modelo de datos dentro de esta spec (precedente
020 y 027). Toca el modelo —migración aditiva `0024_dos_pasos`: tabla
`two_factor` y columna `user.two_factor_enabled`— pero no ningún contrato
publicado (`/api/bot/*`, webhook y SSE no cambian). Las rutas nuevas son las
del plugin `twoFactor` de Better Auth bajo `/api/auth/two-factor/*`.

## Problema

Hoy basta correo y contraseña. Un CRM con datos de vendedores, compradores y
comisiones no puede depender de que nadie adivine o robe una contraseña.

## Comportamiento

**H1 — Activar.** En Ajustes → Mi cuenta → Seguridad: «Activar» pide la
contraseña, muestra un QR (y la clave manual) para la app autenticadora y pide
un código para confirmar. **Hasta confirmar, el login sigue siendo solo con
contraseña**: un QR mal escaneado no deja a nadie fuera. Al confirmar se
muestran 10 códigos de respaldo (copiar / descargar), una sola vez.

**H2 — Entrar.** Con 2FA activo, la contraseña correcta lleva a «Verificación
en dos pasos»; sin el código no hay sesión. Opción «No volver a pedirlo en este
dispositivo por 30 días» (marcada por defecto). «¿No tiene el celular?» → un
código de respaldo, que sirve una sola vez.

**H3 — Administrar.** Con 2FA activo: generar códigos de respaldo nuevos o
desactivar; ambas cosas piden la contraseña.

*Acepta si* (automatizado en `scripts/e2e-049-dos-pasos.mjs`): todo lo
anterior, más contraseña equivocada al activar/desactivar → rechazado, código
equivocado → rechazado, la API responde 401 entre contraseña y código.

## Decisiones

- **D1 — El plugin `twoFactor` de Better Auth**, no una implementación propia:
  el login ya es Better Auth y el plugin guarda secreto y códigos de respaldo
  cifrados con `BETTER_AUTH_SECRET`, con bloqueo por intentos fallidos.
- **D2 — Opcional por usuario**, sin bandera de despliegue: toda instancia lo
  puede usar y apagado no cambia nada.
- **D3 — Límite de intentos** también en `/two-factor/verify-totp` y
  `/two-factor/verify-backup-code` (el del CRM, 10 / 10 min por IP), además del
  propio de Better Auth.
- **D4 — El QR se dibuja en el navegador** (`qrcode`, sin servicio externo):
  el secreto nunca sale a un tercero.
- **D5 — Emisor «Knock Knock CRM»**: es lo que se lee en la app del celular.

## Fuera de alcance

- **Obligar 2FA a todo el equipo** (un interruptor del propietario). Con dos
  socios, se acuerda; si crece el equipo, spec aparte.
- Llaves de acceso (passkeys) y códigos por SMS o correo (el núcleo no envía
  correo: constitución II).
