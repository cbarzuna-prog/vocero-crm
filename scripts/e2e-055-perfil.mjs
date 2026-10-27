/**
 * 055 (fork) — Self-test de la ficha inmobiliaria contra la app viva
 * (`PROPIEDADES=on`, mocks de WhatsApp encendidos, `BOT_API_KEY` en el .env).
 *
 *   node --env-file=.env scripts/e2e-055-perfil.mjs
 *
 * Recorre: ficha vacía → edición manual (validación de correo y presupuesto)
 * → el agente anota por `PUT /api/bot/ficha` y el CRM la traduce, sin pisar
 * lo que editó una persona → el perfil del agente trae las claves → la
 * pantalla la muestra y se edita en el celular. `E2E_FLAG_OFF=1`: 404.
 */
import { chromium } from "playwright";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
const OWNER = { email: process.env.E2E_EMAIL ?? "e2e-046@example.com", password: process.env.E2E_PASSWORD ?? "e2e-046-contrasena" };
const BOT = process.env.BOT_API_KEY ?? "";
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
let cookie = "";
async function api(path, { method = "GET", body, bot = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", origin: BASE, ...(bot ? { "x-api-key": BOT } : cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.getSetCookie?.() ?? [];
  if (!bot && sc.length) cookie = sc.map((c) => c.split(";")[0]).join("; ");
  let json = null;
  try { json = await res.json(); } catch { /* sin JSON */ }
  return { status: res.status, json };
}

let r = await api("/api/auth/sign-in/email", { method: "POST", body: OWNER });
if (r.status !== 200) await api("/api/auth/sign-up/email", { method: "POST", body: { ...OWNER, name: "Prueba 055" } });

const stamp = Date.now().toString(36);
const tel = `5067${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

if (process.env.E2E_FLAG_OFF === "1") {
  const c = await api("/api/contacts", { method: "POST", body: { name: `Off ${stamp}`, phone: tel } });
  r = await api(`/api/contacts/${c.json.contact.id}/perfil`);
  check("apagado: GET /api/contacts/:id/perfil → 404", r.status === 404, `${r.status}`);
  process.exit(failures ? 1 : 0);
}

// Un comprador que escribe por WhatsApp (mock): así hay conversación para el agente.
const PN = "PN-E2E-055";
await api("/api/settings/whatsapp", { method: "PUT", body: { wabaId: "WABA-E2E", phoneNumberId: PN, token: "tok-e2e" } });
await api("/api/dev/wa-mock/inbound", { method: "POST", body: { phoneNumberId: PN, from: tel, name: `Comprador ${stamp}`, text: "Hola, busco casa" } });
await new Promise((res) => setTimeout(res, 1500));
const contacto = (await api(`/api/contacts?q=${encodeURIComponent(`Comprador ${stamp}`)}`)).json.contacts[0];
check("el mensaje entrante creó al contacto", !!contacto);
const conv = (await api("/api/conversations")).json.conversations.find((c) => c.contact?.id === contacto.id);
check("…con su conversación", !!conv);

r = await api(`/api/contacts/${contacto.id}/perfil`);
check("ficha inmobiliaria vacía al inicio", r.status === 200 && r.json.perfil.zonas.length === 0 && r.json.perfil.email === null, JSON.stringify(r.json));

// Edición manual.
r = await api(`/api/contacts/${contacto.id}/perfil`, { method: "PUT", body: { email: "no-es-correo" } });
check("un correo inválido → 422", r.status === 422, `${r.status}`);
r = await api(`/api/contacts/${contacto.id}/perfil`, { method: "PUT", body: { presupuestoMinCents: 50_000_000, presupuestoMaxCents: 30_000_000 } });
check("mínimo mayor que máximo → 422", r.status === 422, `${r.status}`);
r = await api(`/api/contacts/${contacto.id}/perfil`, { method: "PUT", body: { email: "Ana@Ejemplo.com", tiposCliente: ["comprador"] } });
check("guardar correo y tipo de cliente", r.status === 200 && r.json.perfil.email === "ana@ejemplo.com" && r.json.perfil.fuentes.email === "manual", JSON.stringify(r.json));

// El agente anota.
const p = await api("/api/bot/profile", { bot: true });
check("el perfil del agente trae las claves de la ficha", p.status === 200 && /presupuesto_max/.test(p.json?.profile?.instructions ?? ""), `${p.status}`);
r = await api("/api/bot/ficha", {
  method: "PUT",
  bot: true,
  body: {
    conversationId: conv.id,
    ficha: {
      correo: "otro@correo.com",
      tipo_cliente: "inversionista",
      operacion: "comprar",
      tipo_propiedad: "casa o apartamento",
      zonas: "Santa Ana, Escazú",
      presupuesto_min: "300 mil dólares",
      presupuesto_max: "450k USD",
      habitaciones: "3",
      para_cuando: "en 2 meses",
      forma_pago: "crédito preaprobado",
      mascota: "perro",
    },
  },
});
check("el agente guarda su ficha (200)", r.status === 200, `${r.status} ${JSON.stringify(r.json)}`);
const perfil = (await api(`/api/contacts/${contacto.id}/perfil`)).json.perfil;
check("…el CRM la traduce a la ficha inmobiliaria", perfil.operacion === "venta" && perfil.presupuestoMaxCents === 45_000_000 && perfil.zonas.join() === "Santa Ana,Escazú" && perfil.pago === "preaprobado" && perfil.plazo === "1_3_meses", JSON.stringify(perfil));
check("…marcado como del agente", perfil.fuentes.presupuesto === "agente" && perfil.fuentes.zonas === "agente");
check("…sin pisar lo que editó una persona (correo y tipo)", perfil.email === "ana@ejemplo.com" && perfil.tiposCliente.join() === "comprador", JSON.stringify([perfil.email, perfil.tiposCliente]));
r = await api("/api/bot/ficha", { method: "PUT", bot: true, body: { conversationId: conv.id, ficha: { presupuesto_max: "lo que sea", habitaciones: "muchas" } } });
const despues = (await api(`/api/contacts/${contacto.id}/perfil`)).json.perfil;
check("un dato que no se entiende no rompe nada ni borra lo anterior", r.status === 200 && despues.presupuestoMaxCents === 45_000_000 && despues.habitaciones === 3);

// Pantalla en el celular.
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addCookies(cookie.split("; ").map((c) => { const [name, ...v] = c.split("="); return { name, value: v.join("="), url: BASE }; }));
const page = await ctx.newPage();
await page.goto(`${BASE}/pipeline`);
await page.getByRole("tablist", { name: "Etapas" }).waitFor({ timeout: 15_000 });
for (const tab of await page.getByRole("tab").all()) {
  await tab.click();
  if (await page.getByRole("button", { name: `Abrir el trato de Comprador ${stamp}` }).count()) break;
}
await page.getByRole("button", { name: `Abrir el trato de Comprador ${stamp}` }).click();
const cajon = page.getByRole("dialog", { name: `Trato de Comprador ${stamp}` });
const seccion = cajon.locator(`section[aria-labelledby="perfil-${contacto.id}"]`);
await seccion.waitFor({ timeout: 10_000 });
const textoSeccion = await seccion.innerText();
check("el cajón del trato muestra la ficha: presupuesto y zonas", /US\$300,000 – US\$450,000/.test(textoSeccion) && /Santa Ana, Escazú/.test(textoSeccion), textoSeccion.slice(0, 200));
check("…con la marca de lo que anotó el agente", (await seccion.getByLabel("Lo anotó el agente").count()) > 0);
await seccion.getByRole("button", { name: /Editar/ }).click();
await seccion.getByLabel("Habitaciones mínimas").fill("4");
await seccion.getByRole("button", { name: "Inglés" }).click();
await seccion.getByRole("button", { name: "Guardar" }).click();
await seccion.getByText("4+ hab", { exact: false }).waitFor({ timeout: 15_000 });
const final = (await api(`/api/contacts/${contacto.id}/perfil`)).json.perfil;
check("editar en el celular guarda y queda como manual", final.habitaciones === 4 && final.idioma === "en" && final.fuentes.habitaciones === "manual" && final.fuentes.presupuesto === "agente", JSON.stringify(final.fuentes));
await browser.close();

console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
