// Uso: node fork/textos-usted/verificar.mjs [archivo.json ...]
// Sin argumentos revisa diccionario.json. Cada «de» debe existir en su archivo,
// no ser igual a su «a», y no quedar texto en tú visible tras aplicar (aviso).
import { readFileSync, existsSync } from "node:fs";
const archivos = process.argv.slice(2).length ? process.argv.slice(2) : ["fork/textos-usted/diccionario.json"];
let errores = 0;
for (const f of archivos) {
  const dic = JSON.parse(readFileSync(f, "utf8"));
  for (const [rel, pares] of Object.entries(dic)) {
    if (!existsSync(rel)) { console.log(`✗ ${f}: no existe ${rel}`); errores++; continue; }
    const src = readFileSync(rel, "utf8");
    for (const [de, a] of pares) {
      if (typeof de !== "string" || typeof a !== "string" || de.length < 6) { console.log(`✗ ${rel}: par inválido ${JSON.stringify([de, a])}`); errores++; }
      else if (!src.includes(de)) { console.log(`✗ ${rel}: no aparece ${JSON.stringify(de)}`); errores++; }
      else if (de === a) { console.log(`✗ ${rel}: par sin cambio ${JSON.stringify(de)}`); errores++; }
    }
  }
}
console.log(errores ? `${errores} error(es)` : "OK");
process.exit(errores ? 1 : 0);
