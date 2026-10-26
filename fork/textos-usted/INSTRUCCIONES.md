# Cómo agregar textos en usted (fork Knock Knock)

El fork habla de **usted** (registro de Costa Rica). Los archivos de Vocero
(upstream) **no se editan**: cada texto se pasa a usted con un par en
`diccionario.json`, que el build aplica al compilar (`aplicar.cjs`, loader
de webpack en `next.config.ts`).

## Formato

```json
{
  "src/components/settings/ai-client.tsx": [
    ["Pega tu llave de OpenRouter", "Pegue su llave de OpenRouter"],
    ["¿Quieres probar la conexión?", "¿Quiere probar la conexión?"]
  ]
}
```

- La clave es la ruta del archivo relativa a la raíz del repo.
- `de` es un fragmento **copiado exacto** del archivo (espacios, saltos de
  línea `\n`, comillas, entidades como `&quot;` o `{" "}`), de al menos 12
  caracteres. Se reemplazan **todas** las apariciones en ESE archivo, así que
  `de` debe ser lo bastante largo para no tocar código: usar la frase entera
  o la cadena literal entera, nunca una palabra suelta.
- Nunca incluir en `de` nombres de variables, props o clases que el
  reemplazo cambie: solo cambia el texto humano. `{expresiones}` dentro de la
  frase se copian tal cual a `a`.
- Verificar: `node fork/textos-usted/verificar.mjs <archivo.json>` → `OK`.

## Qué se cambia

Todo lo que **lee el usuario del CRM**: textos de JSX, `placeholder`,
`title`, `aria-label`, `alt`, avisos, toasts, mensajes de error que una API
devuelve a la pantalla, etiquetas de navegación, textos de ayuda.

## Qué NO se cambia

- Prompts para el LLM, personas y juez del Laboratorio (`src/server/ai`,
  `src/server/lab`, `src/lib/ai`), ni nada que lea el cerebro.
- Lo que se le manda al **cliente final** por WhatsApp/Instagram (plantillas
  de ejemplo, respuestas por defecto): eso lo decide el negocio.
- Comentarios, `console.*`/logs, nombres de código, ids de prueba, la CLI
  `doctor`, datos de demo (`seed`), los mocks (`dev`).
- Archivos del fork (ya están en usted): `src/components/{fork,tareas,hoy,propiedades,seguridad}`,
  `src/server/{tareas,propiedades}`, `src/app/(app)/{hoy,propiedades}`,
  `src/app/(auth)/login/verificar`, `src/app/(app)/settings/seguridad`.

## Reglas de conversión

| Tú | Usted |
|---|---|
| tu / tus | su / sus (si «su» queda ambiguo con el contacto, «de usted» o reformular) |
| te (objeto) | le / lo / la según el caso; «te avisamos» → «le avisamos» |
| tienes, puedes, quieres, necesitas, debes, estás, eres | tiene, puede, quiere, necesita, debe, está, es |
| contigo, tuyo/a | con usted, suyo/a |
| Tú (como etiqueta de quien habla) | Usted |
| Imperativo: escribe, busca, agrega, elige, conecta, configura, pega, revisa, prueba, guarda, usa, crea, haz, pon, ve, sube, envía, deja, vuelve, intenta, recarga, selecciona, toca, arrastra, abre, activa, copia, cambia, borra, edita | escriba, busque, agregue, elija, conecte, configure, pegue, revise, pruebe, guarde, use, cree, haga, ponga, vaya, suba, envíe, deje, vuelva, intente, recargue, seleccione, toque, arrastre, abra, active, copie, cambie, borre, edite |
| Enclíticos: escríbele, cámbialo, dale, avísale, conéctalo, pégala | escríbale, cámbielo, dele, avísele, conéctelo, péguela |
| Negativos: no escribas, no cierres, no olvides | no escriba, no cierre, no olvide |
| «¿Seguro?» / «¿Estás seguro?» | «¿Está seguro?» |

Concordar todo el párrafo: si una frase mezcla tú en varias partes, cambiar
todas. Mantener el sentido y la longitud aproximada; no reescribir lo que ya
es impersonal («Se guardó», «Conectado») ni lo que no está en tú.
