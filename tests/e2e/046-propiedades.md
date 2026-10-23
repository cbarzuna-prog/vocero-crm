# 046 — Propiedades e interés (guion E2E)

Automatizado en `scripts/e2e-046-propiedades.mjs` (`pnpm test:e2e:propiedades`).

**Con `PROPIEDADES=on`** (app viva, BD migrada):

1. **H1 alta y lista.** Alta rápida → 201 con código `KK-NNNN`; la siguiente lleva el código siguiente. Un cantón de otra provincia → 422. La lista trae las dos con título por defecto «Casa en …». Filtros: Alquiler deja solo el apartamento; Escazú + USD 300k–500k encuentra la casa; ₡ no mezcla monedas.
2. **Ficha.** Editar habitaciones, 2.5 baños, m², 5 % de comisión, exclusiva, descripción y notas → 200 y se refleja. Código repetido → 409. Cantón inválido → 422.
3. **Fotos.** Subir 3 PNG → 201; un SVG disfrazado de PNG → 415; la ficha las trae en orden; se sirven como imagen; reordenar cambia la portada de la lista; borrar una deja 2.
4. **H2 vendedor.** Con Laura como vendedora, `GET /api/contacts/<Laura>/propiedades` la lista en «vende».
5. **H3 interés.** Pedro con dos propiedades → 201; repetir es idempotente (200, mismo vínculo). Casa en «visitada» y apartamento en «enviada», visto desde la propiedad y desde Pedro. Motivo sin descartar → 422; descartar con motivo → 200 y queda en el historial. Historial con fecha: creación → enviada → visitada. La lista cuenta solo interesados vigentes.
6. **Archivar y estados.** Archivada sale de la lista y aparece con `archivadas=1`; alquilada sale de «activas» y aparece con «todos los estados».
7. **Pantallas.** `/propiedades` y la ficha cargan; una ficha inexistente → 404.

**Con la bandera apagada** (`E2E_FLAG_OFF=1`): `/api/propiedades` (GET y POST), `/api/interes`, `/api/contacts/<id>/propiedades` y `/propiedades` → 404.

**Visual** (Playwright, 380px y 1366px): lista en una columna con portada; alta rápida como hoja desde abajo; ficha con galería, datos, sección «Interno · no compartir» separada e interesados al lado en escritorio; sección Propiedades en el drawer del trato.
