# 067 (fork) — «Datos de contacto» dentro de la ficha

Decisión del dueño (2026-11-10): el teléfono ya sale junto al nombre, pero
«que salga más info en la ficha donde está todo; no importa que se repita».

- Tarjeta «Datos de contacto» arriba de la columna izquierda de la ficha:
  teléfono (+506 8877 6655, llamar, WhatsApp, copiar), correo (escribir,
  copiar), tipo de cliente, origen, referido por, cliente desde y última
  actividad. Lo que falta dice «Sin … — agréguelo» y abre «Editar».
- «Editar contacto» ahora cambia también teléfono y correo. El teléfono es un
  atributo (la identidad sigue siendo `wa_identity`): `PATCH
  /api/contactos/{id}` con el mismo criterio de los formularios del sitio
  (8 dígitos → 506; lo corto se rechaza con motivo). El correo va a la ficha
  (`PUT /api/contacts/{id}/perfil`).
- Pruebas: `tests/unit/067-datos-contacto.test.ts`,
  `scripts/e2e-067-datos-contacto.mjs`.
