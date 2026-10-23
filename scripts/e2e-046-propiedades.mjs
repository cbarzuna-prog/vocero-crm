/**
 * 046 — Self-test de COMPORTAMIENTO de propiedades (H1–H3) contra la app viva.
 *
 * Uso: app corriendo con `PROPIEDADES=on` (BD migrada), luego
 *   node --env-file=.env scripts/e2e-046-propiedades.mjs
 * Con `E2E_FLAG_OFF=1` comprueba que, apagada, toda la superficie da 404.
 * Sale con código 1 si algún check falla.
 */
import { deflateSync } from "node:zlib";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
let cookie = "";
let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function api(path, { method = "GET", body, form } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(form ? {} : { "content-type": "application/json" }),
      origin: BASE,
      ...(cookie ? { cookie } : {}),
    },
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
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

/** PNG real (degradado) sin dependencias: lo bastante grande para verse en una captura. */
function png(w, h, [r1, g1, b1], [r2, g2, b2]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const t = (x + y) / (w + h);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r1 + (r2 - r1) * t;
      raw[o + 1] = g1 + (g2 - g1) * t;
      raw[o + 2] = b1 + (b2 - b1) * t;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const subir = (id, buf, name = "foto.png", type = "image/png") => {
  const form = new FormData();
  form.append("file", new Blob([buf], { type }), name);
  return api(`/api/propiedades/${id}/fotos`, { method: "POST", form });
};

async function login() {
  const email = process.env.E2E_EMAIL ?? "e2e-046@example.com";
  const password = process.env.E2E_PASSWORD ?? "e2e-046-contrasena";
  let r = await api("/api/auth/sign-up/email", { method: "POST", body: { email, password, name: "Prueba 046" } });
  if (!r.res.ok) r = await api("/api/auth/sign-in/email", { method: "POST", body: { email, password } });
  check("sesión iniciada", r.res.ok, `${r.res.status}`);
}

async function crearContacto(name) {
  const phone = `5068${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
  const r = await api("/api/contacts", { method: "POST", body: { name, phone } });
  if (!r.res.ok) throw new Error(`contacto: ${r.res.status}`);
  return r.json.contact;
}

async function flagOff() {
  for (const [path, method] of [
    ["/api/propiedades", "GET"],
    ["/api/propiedades", "POST"],
    ["/api/interes", "POST"],
    ["/api/contacts/ct_x/propiedades", "GET"],
    ["/propiedades", "GET"],
  ]) {
    const r = await api(path, { method, body: method === "POST" ? {} : undefined });
    check(`apagada: ${method} ${path} → 404`, r.res.status === 404, `${r.res.status}`);
  }
}

async function flagOn() {
  const stamp = Date.now().toString(36);
  const laura = await crearContacto(`Laura vendedora ${stamp}`);
  const pedro = await crearContacto(`Pedro comprador ${stamp}`);

  // H1 — alta rápida y código secuencial.
  const casa = await api("/api/propiedades", {
    method: "POST",
    body: { operation: "venta", type: "casa", priceCents: 45_000_000, currency: "USD", provincia: "San José", canton: "Escazú", zona: `Valle del Sol ${stamp}` },
  });
  check("alta rápida → 201 con código KK-", casa.res.status === 201 && /^KK-\d{4,}$/.test(casa.json?.code ?? ""), `${casa.res.status} ${JSON.stringify(casa.json)}`);
  const apto = await api("/api/propiedades", {
    method: "POST",
    body: { operation: "alquiler", type: "apartamento", priceCents: 180_000, currency: "USD", provincia: "San José", canton: "Santa Ana", zona: `Lindora ${stamp}` },
  });
  const n1 = Number(casa.json.code.slice(3));
  const n2 = Number(apto.json.code.slice(3));
  check("el segundo código es el siguiente", n2 === n1 + 1, `${casa.json.code} → ${apto.json.code}`);

  const mal = await api("/api/propiedades", { method: "POST", body: { operation: "venta", type: "casa", provincia: "San José", canton: "Liberia" } });
  check("cantón de otra provincia → 422", mal.res.status === 422, `${mal.res.status}`);

  // Lista y filtros.
  const lista = async (qs) => (await api(`/api/propiedades?${qs}`)).json?.properties ?? [];
  const ids = (l) => l.map((p) => p.id);
  let l = await lista(`q=${stamp}`);
  check("la lista trae las dos", ids(l).includes(casa.json.id) && ids(l).includes(apto.json.id));
  check("título por defecto: «Casa en Valle del Sol…»", l.find((p) => p.id === casa.json.id)?.title.startsWith("Casa en Valle del Sol"));
  l = await lista(`q=${stamp}&operation=alquiler`);
  check("filtro Alquiler deja solo el apartamento", ids(l).length === 1 && ids(l)[0] === apto.json.id, JSON.stringify(ids(l)));
  l = await lista(`q=${stamp}&canton=Escaz%C3%BA&currency=USD&min=300000&max=500000`);
  check("Escazú + USD 300k–500k encuentra la casa", ids(l).length === 1 && ids(l)[0] === casa.json.id, JSON.stringify(ids(l)));
  l = await lista(`q=${stamp}&currency=CRC`);
  check("filtro ₡ no mezcla monedas", l.length === 0, `${l.length}`);

  // Ficha: editar.
  const ed = await api(`/api/propiedades/${casa.json.id}`, {
    method: "PATCH",
    body: { habitaciones: 3, banos: 2.5, m2Construccion: 280, m2Terreno: 420, parqueos: 2, comisionBp: 500, exclusiva: true, sellerContactId: laura.id, descripcionPublica: "Casa con jardín.", notasInternas: "La dueña acepta negociar." },
  });
  check("editar la ficha → 200", ed.res.ok, `${ed.res.status} ${JSON.stringify(ed.json)}`);
  let ficha = (await api(`/api/propiedades/${casa.json.id}`)).json?.property;
  check("la ficha refleja lo editado (2.5 baños, 5 %, exclusiva)", ficha?.banos === 2.5 && ficha?.comisionBp === 500 && ficha?.exclusiva === true);
  const dup = await api(`/api/propiedades/${apto.json.id}`, { method: "PATCH", body: { code: casa.json.code } });
  check("código repetido → 409", dup.res.status === 409, `${dup.res.status}`);
  const malCanton = await api(`/api/propiedades/${casa.json.id}`, { method: "PATCH", body: { canton: "Liberia" } });
  check("editar a un cantón de otra provincia → 422", malCanton.res.status === 422, `${malCanton.res.status}`);

  // Fotos.
  const f1 = await subir(casa.json.id, png(640, 400, [34, 87, 122], [244, 211, 94]));
  const f2 = await subir(casa.json.id, png(640, 400, [120, 160, 90], [240, 240, 220]));
  const f3 = await subir(casa.json.id, png(640, 400, [200, 120, 80], [250, 230, 200]));
  check("subir 3 fotos → 201", [f1, f2, f3].every((r) => r.res.status === 201), [f1, f2, f3].map((r) => r.res.status).join(","));
  const svg = await subir(casa.json.id, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "x.png", "image/png");
  check("un SVG disfrazado de PNG → 415", svg.res.status === 415, `${svg.res.status}`);
  ficha = (await api(`/api/propiedades/${casa.json.id}`)).json.property;
  check("la ficha tiene 3 fotos en orden", ficha.photos.map((p) => p.id).join() === [f1, f2, f3].map((r) => r.json.photo.id).join());
  const img = await fetch(`${BASE}${ficha.photos[0].url}`, { headers: { cookie } });
  check("la foto se sirve como imagen", img.ok && (img.headers.get("content-type") ?? "").startsWith("image/png"), `${img.status} ${img.headers.get("content-type")}`);
  const ord = await api(`/api/propiedades/${casa.json.id}/fotos`, { method: "PUT", body: { ids: [f3.json.photo.id, f1.json.photo.id, f2.json.photo.id] } });
  check("reordenar → 200", ord.res.ok, `${ord.res.status}`);
  l = await lista(`q=${stamp}`);
  check("la portada en la lista es la nueva primera", l.find((p) => p.id === casa.json.id)?.coverUrl === f3.json.photo.url);
  const del = await api(`/api/propiedades/${casa.json.id}/fotos/${f2.json.photo.id}`, { method: "DELETE" });
  ficha = (await api(`/api/propiedades/${casa.json.id}`)).json.property;
  check("borrar una foto → 204 y quedan 2", del.res.status === 204 && ficha.photos.length === 2, `${del.res.status} ${ficha.photos.length}`);
  await subir(apto.json.id, png(640, 400, [60, 60, 110], [180, 200, 240]));

  // H2 — vendedor.
  let deLaura = (await api(`/api/contacts/${laura.id}/propiedades`)).json;
  check("Laura vende la casa", deLaura?.vende?.some((p) => p.id === casa.json.id));

  // H3 — interés.
  const v1 = await api("/api/interes", { method: "POST", body: { contactId: pedro.id, propertyId: casa.json.id } });
  const v2 = await api("/api/interes", { method: "POST", body: { contactId: pedro.id, propertyId: apto.json.id } });
  check("vincular a Pedro con dos propiedades → 201", v1.res.status === 201 && v2.res.status === 201, `${v1.res.status},${v2.res.status}`);
  const v1b = await api("/api/interes", { method: "POST", body: { contactId: pedro.id, propertyId: casa.json.id } });
  check("vincular otra vez es idempotente → 200, mismo vínculo", v1b.res.status === 200 && v1b.json.interestId === v1.json.interestId);
  await api(`/api/interes/${v1.json.interestId}`, { method: "PATCH", body: { status: "enviada" } });
  await api(`/api/interes/${v1.json.interestId}`, { method: "PATCH", body: { status: "visitada" } });
  await api(`/api/interes/${v2.json.interestId}`, { method: "PATCH", body: { status: "enviada" } });
  ficha = (await api(`/api/propiedades/${casa.json.id}`)).json.property;
  check("en la casa, Pedro está en «visitada»", ficha.interesadosDetalle.find((i) => i.contact.id === pedro.id)?.status === "visitada");
  const dePedro = (await api(`/api/contacts/${pedro.id}/propiedades`)).json;
  const estados = Object.fromEntries(dePedro.interes.map((i) => [i.property.id, i.status]));
  check("desde Pedro: casa «visitada», apartamento «enviada»", estados[casa.json.id] === "visitada" && estados[apto.json.id] === "enviada", JSON.stringify(estados));
  const malMotivo = await api(`/api/interes/${v2.json.interestId}`, { method: "PATCH", body: { status: "visitada", discardReason: "precio" } });
  check("motivo sin descartar → 422", malMotivo.res.status === 422, `${malMotivo.res.status}`);
  const desc = await api(`/api/interes/${v2.json.interestId}`, { method: "PATCH", body: { status: "descartada", discardReason: "precio" } });
  check("descartar con motivo → 200", desc.res.ok, `${desc.res.status}`);
  const hist = (await api(`/api/interes/${v1.json.interestId}`)).json.events;
  check(
    "historial con fecha: creación → enviada → visitada",
    hist.map((e) => `${e.from ?? "∅"}>${e.to}`).join(" ") === "∅>interesado interesado>enviada enviada>visitada" && hist.every((e) => e.occurredAt),
    JSON.stringify(hist)
  );
  const hist2 = (await api(`/api/interes/${v2.json.interestId}`)).json.events;
  check("el descarte guarda su motivo", hist2.at(-1)?.to === "descartada" && hist2.at(-1)?.discardReason === "precio");
  l = await lista(`q=${stamp}`);
  check("la lista cuenta interesados vigentes (sin descartados)", l.find((p) => p.id === casa.json.id)?.interesados === 1 && l.find((p) => p.id === apto.json.id)?.interesados === 0);

  // Archivar.
  await api(`/api/propiedades/${apto.json.id}`, { method: "PATCH", body: { archived: true } });
  l = await lista(`q=${stamp}`);
  check("archivada deja de salir en la lista", !ids(l).includes(apto.json.id));
  l = await lista(`q=${stamp}&archivadas=1`);
  check("y sale entre las archivadas", ids(l).includes(apto.json.id));
  await api(`/api/propiedades/${apto.json.id}`, { method: "PATCH", body: { archived: false } });

  // Estado de la propiedad y filtro «activas».
  await api(`/api/propiedades/${apto.json.id}`, { method: "PATCH", body: { status: "alquilada" } });
  l = await lista(`q=${stamp}`);
  check("una alquilada no sale entre las activas", !ids(l).includes(apto.json.id));
  l = await lista(`q=${stamp}&status=todas`);
  check("pero sí con «todos los estados»", ids(l).includes(apto.json.id));
  await api(`/api/propiedades/${apto.json.id}`, { method: "PATCH", body: { status: "disponible" } });

  // Quitar un vínculo hecho por error.
  const q = await api(`/api/interes/${v2.json.interestId}`, { method: "DELETE" });
  check("quitar un vínculo → 204", q.res.status === 204, `${q.res.status}`);

  // Pantallas.
  for (const path of ["/propiedades", `/propiedades/${casa.json.id}`]) {
    const r = await api(path);
    check(`la pantalla ${path} carga`, r.res.ok, `${r.res.status}`);
  }
  const no = await api("/propiedades/prop_noexiste");
  check("una ficha inexistente → 404", no.res.status === 404, `${no.res.status}`);

  console.log(`\nfixture: casa=${casa.json.id} pedro=${pedro.id} laura=${laura.id}`);
}

await login();
if (process.env.E2E_FLAG_OFF === "1") await flagOff();
else await flagOn();

console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
