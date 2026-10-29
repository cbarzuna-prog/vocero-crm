/**
 * 053 (fork) — Textos en usted sin tocar los archivos de upstream.
 *
 * `diccionario.json` mapea cada archivo de Vocero (ruta relativa a la raíz)
 * a pares [texto en tú, texto en usted]. El build los aplica al compilar
 * (loader de webpack en next.config.ts): el archivo de upstream queda tal
 * cual en git, así que actualizar desde `upstream` no choca. Si Vocero cambia
 * una frase, la prueba `tests/unit/053-textos-usted.test.ts` avisa qué par
 * quedó huérfano.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- loader de webpack: CommonJS por contrato */
const fs = require("node:fs");
const path = require("node:path");

const DICCIONARIO = path.join(__dirname, "diccionario.json");
let cache = { mtime: 0, data: {} };

function diccionario() {
  const mtime = fs.statSync(DICCIONARIO).mtimeMs;
  if (mtime !== cache.mtime) cache = { mtime, data: JSON.parse(fs.readFileSync(DICCIONARIO, "utf8")) };
  return cache.data;
}

/** Aplica los pares de `rel` a `source`. Pura: la usan el loader y la prueba. */
function aplicar(source, pares) {
  let out = source;
  for (const [de, a] of pares ?? []) out = out.split(de).join(a);
  return out;
}

function loader(source) {
  this.addDependency(DICCIONARIO);
  const rel = path.relative(this.rootContext, this.resourcePath).split(path.sep).join("/");
  const pares = diccionario()[rel];
  return pares ? aplicar(source, pares) : source;
}

module.exports = loader;
module.exports.aplicar = aplicar;
module.exports.DICCIONARIO = DICCIONARIO;
