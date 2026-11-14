# 068 (fork · Hiyou) — Motor de plantillas de negocio

**Carril:** ciclo completo (spec → plan → tareas). Escrito **antes** de programar.
**Estado:** borrador para aprobación del dueño (2026-11-13).
**Base de evidencia:** cuatro investigaciones cruzadas y documentadas en el
proyecto (`hiyou-investigacion-fichas.md`, `hiyou-quejas-y-principios.md`),
más el borrador visual del lienzo «Hiyou CRM — setup y plantillas».

## 1. Por qué

Hiyou es el CRM de Knock Knock convertido en producto para negocios pequeños
que atienden por WhatsApp. Las quejas mejor documentadas sobre los CRM actuales
son tres:

- **Llenarlo es trabajo extra.** El 13 % de la semana se va en captura manual
  (Salesforce, *State of Sales* 2026), y el 37 % admite que su equipo inventa
  datos (Validity 2025).
- **Es complicado.** La curva de aprendizaje es la queja número uno de Bitrix24
  en G2.
- **No refleja cómo vende cada negocio.** Los embudos genéricos obligan a
  «traducir» la realidad al software.

Ningún CRM general arranca configurado para un giro. Este motor hace que, al
elegir el tipo de negocio, el CRM quede listo: con las palabras, etapas, campos,
registros y alertas de ese giro, y con la IA llenando la ficha a partir de la
conversación.

## 2. Qué es una plantilla

Una plantilla es una **declaración en código**, versionada y con pruebas, no
algo que se arma en una pantalla. Define:

| Parte | Contenido |
|---|---|
| **Vocabulario** | Cómo se llama a la gente y a las cosas (Compradores/Dueños, Pacientes, Estudiantes; Propiedades, Tratamientos, Productos). |
| **Etapas** | Nombre, tipo (abierta, ganada o perdida), **criterio de paso** escrito («Calificado = confirmó zona, presupuesto y plazo»), campos que el criterio mira, acción sugerida y tiempos del semáforo (062). |
| **Campos de la ficha** | Clave, etiqueta, tipo (texto, número, importe y moneda, fecha, lista, lista múltiple, sí/no, relación), opciones, **momento** (`inicio`, `venta`, `opcional`), si es **sensible**, si se puede **pedir por chat** y condición para mostrarlo. |
| **Registros vinculados** | Lo que un cliente puede tener varias veces: propiedades, pedidos, citas, casos, inscripciones, vehículos, mascotas. Cada uno con sus campos y estados. |
| **Catálogo** | Lo que vende el negocio y sus atributos (precio, duración, variantes…). |
| **Motivos de pérdida** | La lista sugerida para ese giro. |
| **Recordatorios** | Los automáticos que trae encendidos (confirmar la cita el día antes, recordar la clase de prueba…). |
| **Números del mes** | Las métricas que el tablero del mes muestra primero. |
| **Módulos** | Qué se ve (Captación externa, Agenda, Catálogo…). |

Una plantilla puede tener **subtipos**: dentro de «Salud y belleza», una
barbería y una clínica dental heredan la base y cambian campos. Así se evita
tener 30 plantillas casi iguales.

### Plantillas de la primera versión

| Plantilla | En v1 | Por qué |
|---|---|---|
| **Bienes raíces** | Completa | Las tres investigaciones coinciden y Knock Knock ya la usa en la práctica. |
| **Otro (general)** | Completa | Es la red de seguridad: sirve a cualquier negocio con lo básico. |
| Salud y belleza · Servicios profesionales · Tienda · Educación | **Beta**, detrás de una bandera | La evidencia es media o débil. Se activan después de las entrevistas con dueños. |

Que haya pocas plantillas, pero que sirvan, cuenta más que tener seis a medias.
Talleres, servicios a domicilio, gimnasios, restaurantes y veterinarias quedan
para después de validar.

## 3. Reglas que la plantilla no puede romper

1. **Solo nombre y una forma de contacto son obligatorios.** Ningún campo de
   plantilla bloquea guardar. Los criterios de etapa *sugieren*, no impiden.
2. **Lo calculable no se escribe:** última interacción, total comprado, próxima
   cita y visitas se calculan de los registros.
3. **Ningún dato de salud en la ficha comercial** (alergias, diagnósticos,
   medicamentos). Si una clínica lo necesita, irá en un módulo clínico aparte,
   con su propio consentimiento (artículo 9 de la Ley 8968). El motor rechaza
   una plantilla que declare un campo de salud fuera de ese módulo.
4. **Cédula, tarjetas y cuentas no se piden por chat** (política de WhatsApp
   Business). Los campos marcados `pedirPorChat: false` se piden por formulario
   seguro, y la IA nunca los pide ni los extrae de un mensaje.
5. **Permisos de comunicación con detalle:** estado, finalidad (responder o
   promociones), canal, fecha y evidencia (el mensaje o el formulario donde se
   dio). Las promociones nunca quedan autorizadas por defecto. Una baja
   («BAJA», «no me escriban») se registra y se respeta.
6. **Canal y origen son cosas distintas.** Canal: por dónde hablamos. Origen:
   qué trajo al cliente.
7. **Los datos de una compra se quedan en esa compra** (por ejemplo, la talla),
   salvo que el cliente confirme que son suyos.
8. **Cambiar de plantilla nunca borra datos.** Solo agrega o esconde.

## 4. Historias de usuario

### H1 — Elegir el giro y quedar listo (setup)
*Como dueño de un negocio nuevo, quiero elegir mi tipo de negocio y que el CRM
quede configurado, para empezar a atender en minutos.*

- **Dado** un negocio sin plantilla, **cuando** entra por primera vez, **entonces**
  ve tres pasos: tipo de negocio, su marca (nombre, logo, color) y conectar
  WhatsApp (que se puede saltar).
- **Cuando** elige «Bienes raíces», **entonces** quedan creadas las etapas con su
  criterio y tiempos, los campos, los motivos de pérdida, los recordatorios y
  los módulos de la plantilla, y lo ve resumido en «Su CRM ya está listo».
- Todo el setup se completa en **menos de 2 minutos** sin ayuda (se mide en las
  pruebas con usuarios).
- **Camino infeliz:** si se cae a medio setup, al volver retoma donde quedó y no
  duplica etapas.

### H2 — Ajustar sin programar
*Como dueño, quiero cambiar nombres, etapas, campos y tiempos de mi plantilla.*

- En **Ajustes → Mi negocio** puede renombrar, reordenar, esconder o agregar
  etapas y campos (los propios del negocio), y cambiar los criterios y tiempos.
- Lo que el negocio cambia es suyo: una nueva versión de la plantilla **no**
  pisa sus cambios. Solo le ofrece las novedades.

### H3 — La ficha según el giro
*Como quien atiende, quiero ver en la ficha solo lo que sirve para mi tipo de
negocio.*

- La ficha muestra la base común (datos de contacto, 067) y, debajo, los campos
  de la plantilla agrupados por momento: **Al primer contacto**, **Durante la
  venta** y **Más datos** (opcionales, plegados).
- Los registros vinculados se ven como tarjetas en la ficha (por ejemplo, «2
  propiedades · 1 visita agendada»), cada uno con su propia página.
- Los campos condicionales aparecen solo cuando aplican (por ejemplo, los datos
  del encargado si el estudiante es menor).

### H4 — La IA llena la ficha y yo confirmo
*Como quien atiende, quiero que lo que el cliente dice por WhatsApp aparezca en
su ficha sin tener que copiarlo.*

- Al llegar mensajes nuevos, la IA extrae los valores de los campos de la
  plantilla y los deja como **sugerencias** con su evidencia: «Presupuesto:
  hasta $250 000 — "tengo como 250 mil dólares", 10:42».
- En la ficha y en la Bandeja, cada sugerencia tiene **Aceptar** y **Descartar**.
  Aceptar escribe el valor y anota la fuente («IA, confirmado por Ana»).
- Nunca sobrescribe un valor escrito por una persona sin preguntar. Nunca
  extrae campos sensibles ni los marcados `pedirPorChat: false`.
- **Camino infeliz:** si la IA no está configurada o falla, no aparece ninguna
  sugerencia y nada se rompe. Si devuelve un formato inesperado, se descarta y
  se reintenta (CLAUDE.md, Definición de Hecho).

### H5 — Criterio de etapa y sugerencia de paso
*Como quien atiende, quiero saber qué falta para pasar al cliente a la
siguiente etapa.*

- Cada etapa muestra su criterio como una lista de verificación: «Calificado:
  ✓ zona · ✓ presupuesto · ✗ plazo».
- Cuando se cumple el criterio de la siguiente etapa, se sugiere el cambio
  («¿Pasar a Calificado?»). Se acepta con un toque; nunca se mueve solo.

### H6 — Actuar desde el chat
*Como quien atiende por WhatsApp, quiero mover la etapa, crear la tarea y
aceptar sugerencias sin salir de la conversación.*

- El panel del contacto en la Bandeja (`src/components/inbox/contact-panel.tsx`)
  muestra: barra de etapas, siguiente paso, sugerencias de la IA, los 3 campos
  clave del giro y los botones Tarea y Nota.
- Todo lo que se hace ahí queda en la línea de actividad de la ficha.

### H7 — Permisos y bajas
*Como dueño, quiero saber a quién puedo mandarle promociones, para que Meta no
me bloquee el número.*

- La ficha muestra el estado del permiso para promociones y de dónde salió.
- Si el cliente escribe una baja reconocible, se registra y el envío de
  promociones queda bloqueado para ese contacto.

## 5. Cómo se construye (resumen técnico; el detalle va en `plan.md`)

- **Bandera `PLANTILLAS`** (patrón ADR-001), apagada por defecto. Con la bandera
  apagada, todo funciona como hoy.
- **Definición:** `src/lib/plantillas/` (un archivo por plantilla, un tipo
  `Plantilla` y un esquema Zod que valida las reglas de la sección 3 en las
  pruebas).
- **Aplicación:** `aplicarPlantilla(org, clave, subtipo)`, idempotente. Crea las
  etapas en `pipeline_stage` (más el criterio en una tabla nueva), la
  configuración de atención (`kk_config_atencion`, 062) y guarda una **copia**
  de la configuración en `kk_config_negocio` (JSON por organización), que es lo
  que el negocio edita.
- **Valores de la ficha:** una tabla nueva `kk_ficha_valor` (organización,
  contacto, campo, valor en JSON, fuente, quién y cuándo), validada contra la
  configuración del negocio. **Bienes raíces sigue usando `contact_perfil`** a
  través de un adaptador, sin migrar datos de Knock Knock en esta fase. La
  migración, si conviene, irá en una spec aparte.
- **Registros vinculados:** una tabla genérica `kk_registro` (tipo, contacto,
  título, estado, importe, fecha y datos en JSON) para los giros nuevos. Bienes
  raíces sigue con sus tablas de propiedades.
- **Sugerencias de IA:** tabla `kk_sugerencia` (campo, valor propuesto, mensaje
  de evidencia, estado). La extracción usa `chatJson` con la llave de Ajustes →
  IA, por ráfaga de mensajes y fuera del camino crítico del webhook (no lo
  retrasa).
- **Multi-tenancy:** todo con `organization_id` y `scoped()`. Las conversaciones
  del Laboratorio (`is_test`) nunca generan sugerencias que lleguen a datos
  reales.
- **Migraciones** re-ejecutables. **Knock Knock** recibe «Bienes raíces» aplicada
  automáticamente al encender la bandera, y nada cambia para su equipo.

## 6. Fuera de esta spec

- Registro abierto de negocios en un servidor compartido, precios y cobro
  (spec 069).
- Gestión de plantillas de Meta y aviso de costos por mensaje (spec aparte).
- App instalable con notificaciones, detección de duplicados y exportación
  (specs aparte).
- El módulo clínico.
- Las plantillas beta, que se completan después de las entrevistas.

## 7. Cómo sabemos que funciona

- **Pruebas unitarias:** cada plantilla pasa el esquema (ningún campo de salud,
  ningún campo sensible pedido por chat, criterios que apuntan a campos que
  existen), y `aplicarPlantilla` es idempotente.
- **Pruebas de punta a punta** (Playwright + mocks):
  - setup completo en tres pasos;
  - la ficha muestra los campos del giro;
  - un mensaje del ai-mock produce una sugerencia que se acepta desde la
    Bandeja;
  - el criterio sugiere el cambio de etapa;
  - con la IA caída no se rompe nada;
  - con la bandera apagada, Knock Knock queda igual.
- **Con usuarios:** 5 dueños completan el setup sin ayuda en menos de 2
  minutos. En la primera semana, al menos el 60 % de las sugerencias de la IA
  se aceptan (si es menos, la IA estorba y hay que ajustarla).

## 8. Preguntas abiertas para el dueño

1. ¿Está de acuerdo con lanzar solo **Bienes raíces + General** y dejar las
   otras cuatro en beta hasta las entrevistas?
2. ¿Las sugerencias de la IA se generan **siempre** (cuesta llamadas a la IA en
   cada conversación) o **solo cuando alguien abre la ficha o el chat**? Se
   recomienda la segunda opción para la v1: cuesta menos y la persona igual
   las ve en el momento en que las necesita.
3. Para Knock Knock, ¿encendemos esto primero en el sandbox y lo prueba su
   equipo una semana antes de pasarlo al CRM real?
