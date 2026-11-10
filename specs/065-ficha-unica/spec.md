# 065 (fork) — Una sola ficha: la tarjeta de Compradores abre la del contacto

Decisión del dueño (2026-11-09): «debería salir la misma ficha en pipeline de
compradores que en contactos; es mucho más completa y permite dar el
seguimiento».

- Con el fork encendido, tocar una tarjeta de Compradores (escritorio y
  celular) abre `/contacts/{id}?desde=compradores`; el enlace de arriba dice
  «← Compradores» y vuelve al tablero. Sin el fork, el panel del trato de
  upstream sigue igual (costura mínima en `pipeline-client.tsx`).
- Lo que solo tenía el panel pasa a la ficha: tarjeta **Trato** (monto
  editable y prioridad, mismo `PATCH /api/pipeline/leads/{id}`) y la tarjeta
  del anuncio de origen (upstream 018: «siempre visible»).
- `ContactoFila.lead` trae `amountCents`/`currency`; `ContactoDetalle` trae
  `monedaNegocio`.
- Guiones: 063 (abre la ficha, edita monto y prioridad, vuelve), 050 y 055
  (el celular abre la ficha en vez del cajón).
