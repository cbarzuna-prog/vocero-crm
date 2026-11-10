# 066 (fork) — Dos entornos en el servidor: el CRM real y el sandbox

Decisión del dueño (2026-11-09): «convertimos el actual en el CRM ya de verdad
y dejamos uno de pruebas para el siguiente experimento».

| | Real | Sandbox |
|---|---|---|
| Enlace | https://crm.knockknockcr.com (crm-pruebas redirige con 308) | https://sandbox.knockknockcr.com |
| Carpeta | `~/vocero` (proyecto compose `vocero`) | `~/vocero-sandbox` (proyecto `vocero-sandbox`) |
| Rama | `produccion` | `feat/046-propiedades-y-tareas` |
| Datos | los de siempre | copia del real; `COPIAR_DATOS=1` la refresca |
| Credenciales | las suyas | **borradas** al copiar (WhatsApp, IA, anuncios, Zoom, Google) y otra `ENCRYPTION_KEY` |
| Agente | Nea si se conecta | nunca |
| Aviso | — | franja naranja «Sandbox · copia de pruebas» |

- `scripts/instalar-servidor.sh` con `ENTORNO=real|sandbox` (sin `ENTORNO`, el
  modo de siempre). Verifica que el dominio apunte al servidor antes de pedir
  el certificado; el sandbox exige que el real ya esté en este modo.
- Un solo Caddy (el del real) atiende los 80/443: `fork/servidor/Caddyfile`
  importa `~/vocero-sitios/*.caddy` (sandbox y dominio viejo) y alcanza al
  sandbox por la red Docker `kk_proxy` (`kk-sandbox-app`).
- Imágenes con nombre propio (`knockknock-crm:real` / `:sandbox`): construir
  una no reetiqueta la otra.
- Flujo: Claude sube a la rama de pruebas → se actualiza el sandbox → el dueño
  prueba → Claude mueve `produccion` a ese commit → se actualiza el real.
- Guion: `scripts/e2e-066-entornos.mjs` (franja solo en el sandbox, sin
  desbordar en el celular).
