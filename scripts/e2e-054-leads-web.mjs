/**
 * 054 — Self-test de COMPORTAMIENTO: formularios de la web → CRM.
 *
 * Uso: app corriendo con `LEADS_WEB=on`, `PROPIEDADES=on`, `TAREAS=on` y
 * `WEB_LEADS_TOKEN` (BD migrada), luego
 *   node --env-file=.env scripts/e2e-054-leads-web.mjs
 * Con `E2E_FLAG_OFF=1` comprueba que, apagada, la ruta da 404.
 * Sale con código 1 si algún check falla.
 */

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.WEB_LEADS_TOKEN ?? "";
let cookie = "";
let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", origin: BASE, ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  let json = null;
  try {
    json = await res.clone().json();
  } catch {
    // sin JSON
  }
  return { res, json };
}

/** La web llama SIN sesión: se manda sin cookie. */
async function web(body, token = TOKEN) {
  const res = await fetch(`${BASE}/api/webhooks/web/${token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.clone().json();
  } catch {
    // sin JSON
  }
  return { res, json };
}

async function login() {
  const email = process.env.E2E_EMAIL ?? "e2e-054@example.com";
  const password = process.env.E2E_PASSWORD ?? "e2e-054-contrasena";
  let r = await api("/api/auth/sign-up/email", { method: "POST", body: { email, password, name: "Prueba 054" } });
  if (!r.res.ok) r = await api("/api/auth/sign-in/email", { method: "POST", body: { email, password } });
  check("sesión iniciada", r.res.ok, `${r.res.status}`);
}

const telefono = () => `8${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

async function tareasDe(contactId) {
  const h = (await api("/api/tareas?vista=hoy")).json ?? {};
  return [...(h.vencidas ?? []), ...(h.hoy ?? [])].filter((t) => JSON.stringify(t).includes(contactId));
}

async function flagOff() {
  const r = await web({ name: "Ana", phone: "88888888" }, TOKEN || "x".repeat(64));
  check("apagada: POST → 404", r.res.status === 404, `${r.res.status}`);
}

async function flagOn() {
  const stamp = Date.now().toString(36);
  const webId = `4c8bfbf0-${stamp}-aaaa`;

  // La propiedad en el CRM con el link de la web en «Anuncio en portal (URL)».
  const prop = await api("/api/propiedades", {
    method: "POST",
    body: { operation: "venta", type: "lote", priceCents: 75_000_000, currency: "USD", provincia: "Alajuela", canton: "Alajuela", zona: `La Guácima ${stamp}` },
  });
  check("propiedad creada", prop.res.status === 201, `${prop.res.status}`);
  const pid = prop.json.id;
  await api(`/api/propiedades/${pid}`, { method: "PATCH", body: { urlExterna: `https://knockknockcr.com/property/${webId}` } });

  // D2 — llaves malas.
  check("token malo → 404", (await web({ name: "A", phone: "88888888" }, "x".repeat(64))).res.status === 404);
  const get = await fetch(`${BASE}/api/webhooks/web/${TOKEN}`);
  check("GET con el token → 200 (comprobar la URL)", get.status === 200, `${get.status}`);

  // D11 — cuerpos inválidos dicen qué falta.
  const sinTel = await web({ name: "Ana" });
  check("sin teléfono → 400 con el campo", sinTel.res.status === 400 && sinTel.json?.issues?.some((i) => i.field === "phone"), JSON.stringify(sinTel.json));
  check("no JSON → 400", (await web("hola")).res.status === 400);
  check("teléfono absurdo → 400", (await web({ name: "Ana", phone: "12" })).res.status === 400);

  // H1 + H2 + H3 — el caso feliz: la ficha de la web manda su id.
  const tel = telefono();
  const solicitud = {
    id: `req-${stamp}`,
    name: `Ana Rojas ${stamp}`,
    phone: `+506 ${tel.slice(0, 4)}-${tel.slice(4)}`,
    email: `ana.${stamp}@correo.com`,
    message: "¿Se puede visitar el sábado?",
    property: { id: webId, title: "Terreno Plano Premium en La Guácima" },
    created_at: "2026-10-26T20:00:00Z",
  };
  const r1 = await web(solicitud);
  check("formulario → 200", r1.res.status === 200, `${r1.res.status} ${JSON.stringify(r1.json)}`);
  check("trato creado y propiedad reconocida por el id de la web", r1.json?.leadCreated === true && r1.json?.propertyId === pid, JSON.stringify(r1.json));
  const contactId = r1.json?.contactId;

  const c = (await api(`/api/contacts/${contactId}`)).json;
  check("contacto con nombre y teléfono +506", c?.contact?.name === solicitud.name && c?.contact?.phone === `506${tel}`, JSON.stringify(c?.contact));
  check("email en la ficha", c?.contact?.ficha?.email === solicitud.email, JSON.stringify(c?.contact?.ficha));
  check("mensaje en las notas", (c?.contact?.notes ?? "").includes("¿Se puede visitar el sábado?") && (c?.contact?.notes ?? "").includes("[Formulario web"));

  const board = (await api("/api/pipeline/board")).json;
  const primera = [...board.stages].filter((s) => s.kind === "open").sort((a, b) => a.position - b.position)[0];
  const lead = board.leads.find((l) => l.contact.id === contactId);
  check("el trato está en la primera etapa", lead?.stageId === primera?.id, `${lead?.stageId} vs ${primera?.id}`);

  const ficha = (await api(`/api/propiedades/${pid}`)).json?.property;
  const interes = ficha?.interesadosDetalle?.find((i) => i.contact.id === contactId);
  check("aparece en «Compradores interesados» como interesado", interes?.status === "interesado", JSON.stringify(ficha?.interesadosDetalle));

  const t1 = await tareasDe(contactId);
  check("hay una tarea «Responder solicitud web» en Hoy", t1.length === 1 && JSON.stringify(t1[0]).includes("Responder solicitud web"), JSON.stringify(t1));

  // H4 — reintento idéntico.
  const r2 = await web(solicitud);
  check("reintento → duplicate, mismo contacto", r2.res.status === 200 && r2.json?.duplicate === true && r2.json?.contactId === contactId, JSON.stringify(r2.json));
  check("el reintento no crea otra tarea", (await tareasDe(contactId)).length === 1);

  // H4 — otra pregunta de la misma persona, sin id y por código: mismo contacto, el trato no se repite.
  const r3 = await web({ name: "Otro nombre", phone: tel, message: "¿Acepta financiamiento?", property: { code: prop.json.code } });
  check("misma persona → mismo contacto, sin trato nuevo", r3.json?.contactId === contactId && r3.json?.leadCreated === false && r3.json?.propertyId === pid, JSON.stringify(r3.json));
  const c3 = (await api(`/api/contacts/${contactId}`)).json?.contact;
  check("el nombre no se pisa con el del formulario", c3?.name === solicitud.name, c3?.name);

  // H4 — quien ya existía por WhatsApp es el mismo contacto.
  const telWa = telefono();
  const wa = await api("/api/contacts", { method: "POST", body: { name: `Luis WhatsApp ${stamp}`, phone: `506${telWa}` } });
  const r4 = await web({ name: "Luis Formulario", phone: telWa, property: { title: "Casa que no está en el CRM" } });
  check("reconoce al contacto de WhatsApp por el teléfono", r4.json?.contactId === wa.json?.contact?.id, `${r4.json?.contactId} vs ${wa.json?.contact?.id}`);
  check("sin propiedad en el CRM entra igual, sin vínculo", r4.res.status === 200 && r4.json?.propertyId === null, JSON.stringify(r4.json));
}

await login();
if (process.env.E2E_FLAG_OFF === "1") await flagOff();
else await flagOn();

console.log(failures ? `\n${failures} check(s) fallaron` : "\nTodo verde");
process.exit(failures ? 1 : 0);
