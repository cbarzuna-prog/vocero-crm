# 061 (fork) — Tema con estética de Apple

Pedido del dueño (2026-11-05): «más moderno, como los diseños de Apple».

Un solo archivo, `src/app/fork-tema.css`, cargado después de `globals.css`
desde `app/layout.tsx` (una línea: quitarla apaga el tema). Solo redefine
tokens y unas pocas piezas; ningún componente de upstream cambia.

- **Letra del sistema** (San Francisco en Mac/iPhone, Segoe UI en Windows) con
  el interletrado negativo de Apple; horas, conteos y códigos en la misma
  letra con cifras tabulares (adiós a la monoespaciada); título grande de
  28 px en escritorio.
- **Grises neutros de Apple** (#1d1d1f, #6e6e73, #e5e5ea, #f5f5f7) en lugar
  de los grises azulados de Vocero; verde, ámbar y rojo del sistema.
- **Barra lateral clara**, como Finder o Mail: renglón activo en píldora gris
  con el ícono en el azul Knock Knock (#083F59). En el celular, la barra
  superior y el cajón son translúcidos (desenfoque); el velo de diálogos
  desenfoca lo de atrás.
- **Campos rellenos de gris** que se vuelven blancos al enfocarlos; botones
  secundarios grises rellenos; sin el salto al pasar el cursor; un leve
  «hundirse» al tocar.
- **Columnas** de Pipeline y Captaciones sin borde y tarjetas blancas con
  sombra mínima; esquinas algo más redondas; hilo del chat liso.
- **Tema oscuro** con los grises del sistema de Apple.

De paso: el foco vuelve siempre a «Crear» al cerrar sus diálogos (antes a
veces quedaba en `<body>`; e2e-056 intermitente).

Pruebas: e2e-056 (el renglón activo se distingue con píldora y azul de marca),
e2e-046, 048, 050, 057, 058 y 060 en verde con el tema puesto.
