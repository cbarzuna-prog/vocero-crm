# 054 — Administrar el equipo (fork Knock Knock)

Carril ligero. Origen: el dueño no podía editar ni quitar usuarios; Ajustes →
Equipo de Vocero solo crea cuentas.

## Qué hace (solo propietarios)

- **Editar** nombre, correo para entrar y rol (Propietario / Miembro, con lo
  que puede cada uno). Nunca queda la organización sin propietario (409
  `ultimo_propietario`). Un correo en uso → 409 `correo_en_uso`.
- **Contraseña temporal** para quien la olvidó: se muestra una vez para
  copiarla; cierra las sesiones abiertas de esa persona; opción de quitar la
  verificación en dos pasos (teléfono perdido).
- **Quitar del equipo**: confirmación en la misma fila (sin `confirm()` del
  navegador). Sus tareas pendientes pasan a quien la quita; las hechas quedan
  como historial. La cuenta se borra (sesiones, 2FA, credenciales en cascada)
  si solo pertenece a esta organización; si no, solo su membresía. No se puede
  quitar uno mismo (409 `a_si_mismo`).
- Un miembro ve la lista sin acciones; la API le responde 403.

## Decisiones

- Borrar la cuenta (y no desactivarla): una instancia = un negocio, y así
  volver a crearla con el mismo correo funciona. Costo aceptado: el historial
  que guardaba quién hizo algo (`actor_user_id`) queda sin nombre.
- Sin bandera propia: viaja con `TAREAS`/`PROPIEDADES`; con ambas apagadas,
  Equipo es el de upstream y `/api/equipo/*` da 404.
- Costura en upstream: prop opcional `gestion` en `team-client.tsx` y la
  página pasa quién mira.

Código: `src/server/equipo/`, `src/app/api/equipo/`, `src/lib/equipo.ts`,
`src/components/fork/equipo-miembros.tsx`. Verificación:
`tests/unit/054-equipo.test.ts`, `scripts/e2e-054-equipo.mjs`.
