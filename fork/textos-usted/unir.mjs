// Une fork/textos-usted/parciales/*.json en diccionario.json (sin duplicados).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const DIR = "fork/textos-usted";
const dic = JSON.parse(readFileSync(`${DIR}/diccionario.json`, "utf8"));
for (const f of readdirSync(`${DIR}/parciales`).filter((x) => x.endsWith(".json")).sort()) {
  for (const [rel, pares] of Object.entries(JSON.parse(readFileSync(`${DIR}/parciales/${f}`, "utf8")))) {
    const actual = (dic[rel] ??= []);
    for (const [de, a] of pares) if (!actual.some(([d]) => d === de)) actual.push([de, a]);
  }
}
const ordenado = Object.fromEntries(Object.keys(dic).sort().map((k) => [k, dic[k]]));
writeFileSync(`${DIR}/diccionario.json`, JSON.stringify(ordenado, null, 2) + "\n");
console.log(`${Object.keys(ordenado).length} archivos, ${Object.values(ordenado).flat().length} pares`);
