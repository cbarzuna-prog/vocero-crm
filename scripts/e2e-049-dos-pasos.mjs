/**
 * 049 — Self-test de COMPORTAMIENTO de la verificación en dos pasos.
 *
 * Uso: app corriendo y BD migrada; la cuenta E2E debe existir y NO tener 2FA.
 *   node --env-file=.env scripts/e2e-049-dos-pasos.mjs
 * Deja la cuenta como la encontró (2FA apagado). Sale con 1 si algo falla.
 */
import { createHmac } from "node:crypto";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "e2e-046@example.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "e2e-046-contrasena";
let cookie = "";
let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

function guardarCookies(res) {
  const nuevas = res.headers.getSetCookie?.() ?? [];
  if (!nuevas.length) return;
  const jar = new Map(cookie.split("; ").filter(Boolean).map((c) => [c.split("=")[0], c]));
  for (const c of nuevas) {
    const par = c.split(";")[0];
    const nombre = par.split("=")[0];
    // Una cookie vaciada (Max-Age=0) se borra del frasco.
    if (/max-age=0/i.test(c) || par.endsWith("=")) jar.delete(nombre);
    else jar.set(nombre, par);
  }
  cookie = [...jar.values()].join("; ");
}

/**
 * Better Auth limita sus rutas sensibles (3 intentos cada 10 s por IP, más el
 * límite propio del CRM). Es justo lo que se quiere en producción; la prueba
 * se pausa entre llamadas de auth para no confundirse con un atacante.
 */
let ultimaAuth = 0;
async function pausaAuth(path) {
  if (!path.startsWith("/api/auth/")) return;
  const espera = ultimaAuth + 3600 - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaAuth = Date.now();
}

async function api(path, body, method = "POST") {
  await pausaAuth(path);
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", origin: BASE, ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  guardarCookies(res);
  let json = null;
  try {
    json = await res.clone().json();
  } catch {
    // sin JSON
  }
  return { res, json };
}

/** TOTP RFC 6238 (SHA-1, 30 s, 6 dígitos), lo mismo que hace la app del celular. */
function totp(secretB32, at = Date.now()) {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secretB32.replace(/=+$/, "").toUpperCase()) {
    const v = alfabeto.indexOf(ch);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac("sha1", bytes).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

const entrar = () => api("/api/auth/sign-in/email", { email: EMAIL, password: PASSWORD });
const salir = async () => {
  await api("/api/auth/sign-out", {});
  cookie = "";
};

// 0 — Sesión normal (sin 2FA todavía).
let r = await entrar();
check("entra con contraseña (2FA apagado)", r.res.ok && !r.json?.twoFactorRedirect, `${r.res.status} ${JSON.stringify(r.json)}`);

// 1 — Activar pide la contraseña.
r = await api("/api/auth/two-factor/enable", { password: "incorrecta-123" });
check("activar con contraseña equivocada → rechazado", !r.res.ok, `${r.res.status}`);
r = await api("/api/auth/two-factor/enable", { password: PASSWORD });
const uri = r.json?.totpURI ?? "";
const secreto = new URL(uri || "otpauth://x").searchParams.get("secret") ?? "";
const respaldo = r.json?.backupCodes ?? [];
check("activar → URI otpauth con emisor «Knock Knock CRM» y 10 códigos de respaldo", r.res.ok && uri.startsWith("otpauth://totp/") && decodeURIComponent(uri).includes("Knock Knock CRM") && respaldo.length === 10, `${r.res.status} ${uri.slice(0, 60)} ${respaldo.length}`);

// 2 — Hasta confirmar, el login sigue sin pedir código (nadie queda fuera por un QR mal escaneado).
await salir();
r = await entrar();
check("sin confirmar el código, el login no pide el segundo paso", r.res.ok && !r.json?.twoFactorRedirect, JSON.stringify(r.json));

// 3 — Confirmar con un código malo y luego con el bueno.
r = await api("/api/auth/two-factor/verify-totp", { code: "000000" });
check("código equivocado → rechazado", !r.res.ok, `${r.res.status}`);
r = await api("/api/auth/two-factor/verify-totp", { code: totp(secreto) });
check("código correcto → 2FA activo", r.res.ok, `${r.res.status} ${JSON.stringify(r.json)}`);
r = await api("/api/auth/get-session", undefined, "GET");
check("la sesión dice twoFactorEnabled: true", r.json?.user?.twoFactorEnabled === true, JSON.stringify(r.json?.user ?? null));

// 4 — Ahora el login exige el segundo paso y no crea sesión hasta el código.
await salir();
r = await entrar();
check("login con contraseña → pide el segundo paso", r.res.ok && r.json?.twoFactorRedirect === true, JSON.stringify(r.json));
r = await api("/api/tareas?vista=contador", undefined, "GET");
check("sin el código no hay sesión (la API responde 401)", r.res.status === 401, `${r.res.status}`);
r = await api("/api/auth/two-factor/verify-totp", { code: "123456" });
check("código equivocado en el login → rechazado", !r.res.ok && r.res.status !== 429, `${r.res.status}`);
await new Promise((res) => setTimeout(res, 31_000));
r = await api("/api/auth/two-factor/verify-totp", { code: totp(secreto) });
check("código correcto en el login → entra", r.res.ok, `${r.res.status}`);
r = await api("/api/auth/get-session", undefined, "GET");
check("y la sesión existe", !!r.json?.user, JSON.stringify(r.json));

// 5 — Código de respaldo: sirve una vez.
await salir();
await entrar();
r = await api("/api/auth/two-factor/verify-backup-code", { code: respaldo[0] });
check("un código de respaldo deja entrar", r.res.ok, `${r.res.status} ${JSON.stringify(r.json)}`);
await salir();
await entrar();
r = await api("/api/auth/two-factor/verify-backup-code", { code: respaldo[0] });
check("el mismo código de respaldo no sirve dos veces", !r.res.ok && r.res.status !== 429, `${r.res.status}`);
// Un código TOTP no se acepta dos veces en la misma ventana: se espera a la siguiente.
await new Promise((res) => setTimeout(res, 31_000));
r = await api("/api/auth/two-factor/verify-totp", { code: totp(secreto) });
check("entra otra vez con un código nuevo", r.res.ok, `${r.res.status} ${JSON.stringify(r.json)}`);

// 6 — Las pantallas existen (ya con sesión: entró con el código).
for (const path of ["/login/verificar", "/settings/seguridad"]) {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
  check(`la pantalla ${path} carga`, res.status === 200, `${res.status}`);
}

// 7 — Desactivar (pide contraseña) y dejar la cuenta como estaba.
r = await api("/api/auth/two-factor/disable", { password: "incorrecta-123" });
check("desactivar con contraseña equivocada → rechazado", !r.res.ok, `${r.res.status}`);
r = await api("/api/auth/two-factor/disable", { password: PASSWORD });
check("desactivar → 200", r.res.ok, `${r.res.status}`);
await salir();
r = await entrar();
check("apagado, el login vuelve a ser solo con contraseña", r.res.ok && !r.json?.twoFactorRedirect, JSON.stringify(r.json));

console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
