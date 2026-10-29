/**
 * 050 — Self-test de COMPORTAMIENTO de los atajos de trabajo, en un navegador
 * real (Playwright) contra la app viva con `TAREAS=on` y `PROPIEDADES=on`.
 *
 *   node --env-file=.env scripts/e2e-050-atajos.mjs
 *
 * Recorre: barra inferior y «+» en el celular, crear tarea desde el «+»,
 * reprogramar con un toque y deshacer, editar, «Llamar» en una llamada,
 * «Enviar ficha» sin conversación (dice por qué y no envía nada).
 */
import { chromium } from "playwright";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "e2e-046@example.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "e2e-046-contrasena";
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const api = (path, init = {}) =>
  page.request.fetch(`${BASE}${path}`, { ...init, headers: { origin: BASE, "content-type": "application/json", ...(init.headers ?? {}) } });

await page.goto(`${BASE}/login`);
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.click("button[type=submit]");
await page.waitForURL(/\/(hoy|onboarding|inbox)/, { timeout: 20_000 });

// Datos: un contacto con teléfono y una llamada para hoy.
const stamp = Date.now().toString(36);
const phone = `5068${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const c = await (await api("/api/contacts", { method: "POST", data: { name: `Atajo ${stamp}`, phone } })).json();
const hoy = await (await api("/api/tareas?vista=hoy")).json();
const t = await (await api("/api/tareas", { method: "POST", data: { contactId: c.contact.id, title: `Llamar ${stamp}`, type: "llamada", day: hoy.today, time: "23:30" } })).json();

await page.goto(`${BASE}/hoy`);
const fila = page.locator("li", { hasText: `Llamar ${stamp}` });
await fila.waitFor({ timeout: 10_000 });

// Barra inferior.
const barra = page.getByRole("navigation", { name: "Pantallas principales" });
check("en el celular hay barra inferior", await barra.isVisible());
for (const label of ["Hoy", "Bandeja", "Propiedades", "Más"]) {
  check(`la barra tiene «${label}»`, (await barra.getByText(label, { exact: true }).count()) === 1);
}
check("el «+» está en la barra (no flota sobre el contenido)", await barra.getByRole("button", { name: /Crear contacto/ }).isVisible());

// Llamar.
const llamar = fila.getByRole("link", { name: /Llamar a/ });
check("una llamada tiene el botón «Llamar» con tel:", (await llamar.getAttribute("href")) === `tel:+${phone}`);
const caja = await llamar.boundingBox();
check("el botón «Llamar» mide 44px en el táctil", caja && caja.height >= 44 && caja.width >= 44, JSON.stringify(caja));

// Reprogramar con un toque y deshacer.
await fila.getByRole("button", { name: /Más acciones/ }).click();
await page.getByRole("menuitem", { name: "Mañana" }).click();
await page.getByRole("status").getByText(/→ mañana/).waitFor({ timeout: 5000 });
await page.waitForTimeout(600);
check("«Mañana» la saca de hoy", (await page.locator("li", { hasText: `Llamar ${stamp}` }).count()) === 0);
let dePersona = await (await api(`/api/tareas?vista=contacto&contactId=${c.contact.id}`)).json();
const manana = new Date(`${hoy.today}T12:00:00Z`);
manana.setUTCDate(manana.getUTCDate() + 1);
const diaDe = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: hoy.timezone }).format(new Date(iso));
const horaDe = (iso) => new Intl.DateTimeFormat("en-GB", { timeZone: hoy.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
check("quedó para mañana a la misma hora", diaDe(dePersona.pendientes[0].dueAt) === manana.toISOString().slice(0, 10) && horaDe(dePersona.pendientes[0].dueAt) === "23:30");
await page.getByRole("status").getByRole("button", { name: "Deshacer" }).click();
await page.locator("li", { hasText: `Llamar ${stamp}` }).waitFor({ timeout: 5000 });
dePersona = await (await api(`/api/tareas?vista=contacto&contactId=${c.contact.id}`)).json();
check("«Deshacer» la devuelve a hoy, misma hora", diaDe(dePersona.pendientes[0].dueAt) === hoy.today && horaDe(dePersona.pendientes[0].dueAt) === "23:30");

// Editar.
await page.locator("li", { hasText: `Llamar ${stamp}` }).getByRole("button", { name: /Más acciones/ }).click();
await page.getByRole("menuitem", { name: "Editar" }).click();
const dlg = page.getByRole("dialog", { name: "Editar tarea" });
check("«Editar» abre el diálogo con el título puesto", (await dlg.locator("#tarea-titulo").inputValue()) === `Llamar ${stamp}`);
check("…y la hora puesta", (await dlg.locator("#tarea-hora").inputValue()) === "23:30");
await dlg.locator("#tarea-titulo").fill(`Llamar ${stamp} (editada)`);
await dlg.getByRole("button", { name: "Guardar cambios" }).click();
await page.locator("li", { hasText: `Llamar ${stamp} (editada)` }).waitFor({ timeout: 5000 });
dePersona = await (await api(`/api/tareas?vista=contacto&contactId=${c.contact.id}`)).json();
check("editar no crea otra tarea", dePersona.pendientes.length === 1, `${dePersona.pendientes.length}`);

// Crear desde el «+».
await barra.getByRole("button", { name: /Crear contacto/ }).click();
await page.getByRole("menuitem", { name: "Tarea" }).click();
const nueva = page.getByRole("dialog", { name: "Nueva tarea" });
await nueva.getByLabel("Buscar contacto").fill(`Atajo ${stamp}`);
await nueva.getByRole("button", { name: `Atajo ${stamp}` }).click();
await nueva.locator("#tarea-titulo").fill(`Desde el más ${stamp}`);
await nueva.getByRole("button", { name: "Guardar tarea" }).click();
await page.waitForTimeout(800);
dePersona = await (await api(`/api/tareas?vista=contacto&contactId=${c.contact.id}`)).json();
check("el «+» crea la tarea", dePersona.pendientes.some((x) => x.title === `Desde el más ${stamp}`));

// Enviar ficha sin conversación: explica y no cambia el estado.
const props = await (await api("/api/propiedades?status=todas")).json();
const prop = props.properties[0];
if (prop) {
  const r = await api(`/api/propiedades/${prop.id}/enviar`, { method: "POST", data: { contactId: c.contact.id } });
  const body = await r.json();
  check("enviar ficha a quien no tiene conversación → 409 con la razón", r.status() === 409 && /conversaci/i.test(body.error?.message ?? ""), `${r.status()} ${JSON.stringify(body)}`);
  const ficha = await (await api(`/api/propiedades/${prop.id}`)).json();
  check("…y no lo marca como «Ficha enviada»", !ficha.property.interesadosDetalle.some((i) => i.contact.id === c.contact.id));
}

// Envío real contra el mock de WhatsApp (app con META_GRAPH_BASE_URL → wa-mock).
if (process.env.E2E_WA_MOCK === "1" && prop) {
  const PN = "PN-E2E-050";
  await api("/api/settings/whatsapp", { method: "PUT", data: { wabaId: "WABA-E2E", phoneNumberId: PN, token: "tok-e2e" } });
  await api("/api/dev/wa-mock/outbox", { method: "DELETE" });
  const tel = `5067${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
  await api("/api/dev/wa-mock/inbound", { method: "POST", data: { phoneNumberId: PN, from: tel, name: `Comprador ${stamp}`, text: "Hola, ¿tienen casas en Santa Ana?" } });
  await page.waitForTimeout(1500);
  const buscados = await (await api(`/api/contacts?q=${encodeURIComponent(`Comprador ${stamp}`)}`)).json();
  const comprador = buscados.contacts[0];
  check("el mensaje entrante creó al comprador", !!comprador);
  // Dos fotos para que haya qué mandar.
  const ficha0 = (await (await api(`/api/propiedades/${prop.id}`)).json()).property;
  const r = await api(`/api/propiedades/${prop.id}/enviar`, { method: "POST", data: { contactId: comprador.id, fotos: 2 } });
  const body = await r.json();
  const esperadas = Math.min(2, ficha0.photos.length);
  check("enviar ficha → 200, texto + fotos", r.ok() && body.mensajes === 1 + esperadas, `${r.status()} ${JSON.stringify(body)}`);
  const outbox = (await (await api("/api/dev/wa-mock/outbox")).json()).outbox ?? [];
  const textos = outbox.filter((m) => m.type === "text").map((m) => m.body?.text?.body ?? "");
  const imagenes = outbox.filter((m) => m.type === "image");
  check("salió el texto con título y referencia", textos.some((t) => t.includes(`*${ficha0.title}*`) && t.includes(`Ref. ${ficha0.code}`)), JSON.stringify(textos).slice(0, 200));
  check(`salieron ${esperadas} fotos`, imagenes.length === esperadas, `${imagenes.length}`);
  const interno = [ficha0.notasInternas, ficha0.seller?.name].filter(Boolean);
  check("lo interno no salió (vendedor, notas)", interno.every((x) => !JSON.stringify(outbox).includes(x)), interno.join(" | "));
  const ficha1 = (await (await api(`/api/propiedades/${prop.id}`)).json()).property;
  check("el comprador quedó en «Ficha enviada»", ficha1.interesadosDetalle.find((i) => i.contact.id === comprador.id)?.status === "enviada");
  // Si ya iba más adelante, no retrocede.
  const intId = ficha1.interesadosDetalle.find((i) => i.contact.id === comprador.id).interestId;
  await api(`/api/interes/${intId}`, { method: "PATCH", data: { status: "visitada" } });
  await api(`/api/propiedades/${prop.id}/enviar`, { method: "POST", data: { contactId: comprador.id, fotos: 0 } });
  const ficha2 = (await (await api(`/api/propiedades/${prop.id}`)).json()).property;
  check("reenviar a quien ya visitó no lo regresa a «enviada»", ficha2.interesadosDetalle.find((i) => i.contact.id === comprador.id)?.status === "visitada");
}

// 051 — Lista densa, orden y ficha plegable en el celular.
if (prop) {
  await page.goto(`${BASE}/propiedades`);
  await page.locator("h1", { hasText: "Propiedades" }).waitFor();
  check("bajo el título va el resumen del inventario", /\d+ (disponible|en captación|reservada)/.test(await page.locator("h1 + p").innerText()));
  await page.getByRole("radio", { name: "Lista" }).click();
  check("la vista de lista muestra renglones con precio", (await page.locator("ul.divide-y > li").count()) > 0);
  await page.reload();
  await page.locator("ul.divide-y > li").first().waitFor({ timeout: 10_000 });
  check("la vista elegida se recuerda al volver", (await page.getByRole("radio", { name: "Lista" }).getAttribute("aria-checked")) === "true");
  await page.getByRole("radio", { name: "Cuadrícula" }).click();

  await page.goto(`${BASE}/propiedades/${prop.id}`);
  const interno = page.getByRole("button", { name: /Interno · no compartir/ });
  await interno.waitFor();
  check("en el celular lo interno arranca plegado", (await interno.getAttribute("aria-expanded")) === "false" && !(await page.getByText("nunca se muestran al comprador").isVisible()));
  await interno.click();
  check("…y se despliega con un toque", await page.getByText("nunca se muestran al comprador").isVisible());
  const yInteresados = (await page.getByText(/Compradores interesados/).boundingBox())?.y ?? Infinity;
  const yDatos = (await page.getByRole("button", { name: /^Datos/ }).boundingBox())?.y ?? Infinity;
  check("en el celular los interesados van antes que los datos", yInteresados < yDatos, `${yInteresados} vs ${yDatos}`);
}

// 052 — Pipeline en el celular: una etapa a la vez, con pestañas.
{
  await page.goto(`${BASE}/pipeline`);
  const tabs = page.getByRole("tablist", { name: "Etapas" });
  await tabs.waitFor({ timeout: 10_000 });
  check("en el celular el pipeline va por pestañas de etapa", await tabs.isVisible());
  const segunda = tabs.getByRole("tab").nth(1);
  await segunda.click();
  check("tocar una pestaña la selecciona", (await segunda.getAttribute("aria-selected")) === "true");
  // Llevar a alguien a esa etapa desde la primera, por el mismo cajón del tablero.
  await tabs.getByRole("tab").first().click();
  const fila = page.getByRole("button", { name: /Abrir el trato de/ }).first();
  if (await fila.count()) {
    const nombre = (await fila.getAttribute("aria-label")).replace("Abrir el trato de ", "");
    await fila.click();
    const cajon = page.getByRole("dialog", { name: `Trato de ${nombre}` });
    check("tocar un trato abre el cajón del trato", await cajon.isVisible());
    const destino = (await segunda.innerText()).replace(/\s*\d+\s*$/, "").trim();
    await cajon.getByRole("button", { name: `Mover a ${destino}`, exact: true }).click();
    await page.getByRole("button", { name: "Cerrar el panel del trato" }).click();
    await segunda.click();
    await page.waitForTimeout(500);
    check("…y moverlo de etapa lo pasa a esa pestaña", (await page.getByRole("button", { name: `Abrir el trato de ${nombre}` }).count()) === 1);
  }
}

// Limpieza.
for (const x of dePersona.pendientes) await api(`/api/tareas/${x.id}`, { method: "DELETE" });
await browser.close();
console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
