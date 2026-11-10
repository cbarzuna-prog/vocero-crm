/**
 * 066 (fork) — La franja del sandbox: aparece con ENTORNO=sandbox y no en el real.
 *
 *   ENTORNO=sandbox TAREAS=on PROPIEDADES=on pnpm start
 *   E2E_ENTORNO=sandbox node --env-file=.env scripts/e2e-066-entornos.mjs
 *   (sin ENTORNO en la app y sin E2E_ENTORNO: comprueba que NO aparece)
 */
import { chromium } from "playwright";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
const OWNER = { email: process.env.E2E_EMAIL ?? "e2e-046@example.com", password: process.env.E2E_PASSWORD ?? "e2e-046-contrasena" };
const sandbox = process.env.E2E_ENTORNO === "sandbox";
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
for (const [nombre, viewport] of [["escritorio", { width: 1440, height: 900 }], ["celular", { width: 390, height: 844 }]]) {
  const page = await (await browser.newContext({ viewport })).newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", OWNER.email);
  await page.fill("#password", OWNER.password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/(hoy|onboarding|inbox)/, { timeout: 90_000 });
  await page.goto(`${BASE}/hoy`);
  await page.getByRole("region", { name: "Resumen del día" }).waitFor({ timeout: 60_000 });
  const franja = page.getByRole("note").filter({ hasText: "Sandbox" });
  if (sandbox) {
    check(`${nombre}: la franja del sandbox está arriba`, await franja.isVisible());
    check(`${nombre}: sin desplazamiento horizontal`, (await page.evaluate(() => document.documentElement.scrollWidth)) <= viewport.width);
  } else {
    check(`${nombre}: en el real no hay franja`, (await franja.count()) === 0);
  }
}
await browser.close();
console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
