# 060 (fork) — Colaboradores: quién trajo y quién vende cada propiedad

**Bandera**: `PROPIEDADES`. **Paso 1** de lo acordado con el dueño (2026-10-30):
el CRM reconoce a los co-corredores y reparte la comisión, pero ellos **no
entran al CRM** (hoy un miembro ve toda la cartera: contactos, conversaciones,
dueños y comisiones). El paso 2 —que el co-corredor lleve su propio pipeline—
va por un portal en el sitio, no con cuentas del CRM.

**Del dueño**: el reparto cambia en cada negocio (70/30, 33/33/33…); los
co-corredores atienden a sus clientes en su WhatsApp personal.

## Historias

1. **Reparto en la ficha** (Interno · no compartir → «Quién la trajo y quién la
   vende»): agregar gente del equipo o un colaborador externo (buscarlo en
   Contactos o registrarlo con nombre y teléfono, sin trato de comprador), su
   papel (la trajo / la vende / ambas) y su porcentaje de la comisión. Muestra
   el monto estimado de cada quien y lo que **queda para la agencia** (lo no
   repartido). «Partes iguales» reparte parejo (33,34/33,33/33,33). La suma no
   puede pasar de 100 %; una persona no se repite. Se guarda con su propio
   botón.
2. **El colaborador queda marcado** «Colaborador (co-corredor)» en su ficha;
   Contactos lo filtra por tipo, y su página muestra **«Colabora en»**: cada
   propiedad, su papel, su porcentaje, su monto y el total estimado.
3. **Filtros**: Propiedades y Captaciones filtran por colaborador; la tarjeta
   de Captaciones dice quién participa y con cuánto.

## Datos (migración aditiva `0029`)

`kk_propiedad_participante`: propiedad, `user_id` **o** `contact_id` (check),
papel, `porcentaje_bp` (0–10000, check). Únicos por propiedad+persona.

## Fuera de alcance

- Acceso del co-corredor (paso 2: portal en el sitio).
- Reparto sobre el monto real de cierre (hoy es sobre la comisión estimada de
  la ficha: precio × % o un mes de renta).
