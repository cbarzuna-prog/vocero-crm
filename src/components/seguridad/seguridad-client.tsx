"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Paso =
  | { tipo: "reposo" }
  | { tipo: "pedirClave"; para: "activar" | "desactivar" | "codigos" }
  | { tipo: "escanear"; uri: string; qr: string; secreto: string; codigos: string[] }
  | { tipo: "codigos"; codigos: string[] };

/** El secreto en base32 viene dentro del URI `otpauth://…?secret=XXXX`. */
function secretoDe(uri: string): string {
  try {
    return new URL(uri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

/** «ABCD EFGH IJKL»: se copia a mano sin perderse. */
const agrupar = (s: string) => s.replace(/(.{4})/g, "$1 ").trim();

function mensajeDe(err: { status?: number; message?: string } | null | undefined): string {
  if (!err) return "No se pudo completar. Intente de nuevo.";
  if (err.status === 429) return "Demasiados intentos. Espere unos minutos.";
  if (/password/i.test(err.message ?? "")) return "La contraseña no es correcta.";
  if (/code|otp|totp/i.test(err.message ?? "")) return "El código no es correcto o ya venció. Use el que muestra la app en este momento.";
  return "No se pudo completar. Intente de nuevo.";
}

function CodigosRespaldo({ codigos, onListo }: { codigos: string[]; onListo: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const texto = codigos.join("\n");
  return (
    <div className="space-y-3">
      <p className="text-sm">
        <strong>Guarde estos códigos de respaldo</strong> en su gestor de contraseñas o impresos. Cada uno sirve
        <strong> una sola vez</strong> para entrar si pierde el celular. No se volverán a mostrar.
      </p>
      <ul className="grid grid-cols-2 gap-1.5 rounded-md border bg-subtle p-3 font-mono text-sm">
        {codigos.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(texto).then(() => setCopiado(true));
          }}
        >
          {copiado ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
          {copiado ? "Copiados" : "Copiar"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([`Códigos de respaldo — Knock Knock CRM\n\n${texto}\n`], { type: "text/plain" }));
            a.download = "codigos-respaldo-crm.txt";
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          <Download className="mr-1 h-4 w-4" /> Descargar
        </Button>
        <Button size="sm" className="ml-auto" onClick={onListo}>
          Ya los guardé
        </Button>
      </div>
    </div>
  );
}

/**
 * 049 — Ajustes → Seguridad: verificación en dos pasos (TOTP) de quien mira.
 *
 * Activar: contraseña → QR (o clave manual) en la app autenticadora → un
 * código para confirmar que quedó bien → códigos de respaldo. Hasta confirmar
 * el código, la cuenta sigue entrando solo con contraseña: así nadie se queda
 * fuera por escanear mal el QR.
 */
export function SeguridadClient() {
  const { data: session, refetch } = authClient.useSession();
  const activo = !!(session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled;

  const [paso, setPaso] = useState<Paso>({ tipo: "reposo" });
  const [clave, setClave] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [paso.tipo]);

  async function conClave() {
    if (paso.tipo !== "pedirClave") return;
    setCargando(true);
    setError(null);
    try {
      if (paso.para === "activar") {
        const { data, error: err } = await authClient.twoFactor.enable({ password: clave });
        if (err || !data) return setError(mensajeDe(err));
        const qr = await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 });
        setPaso({ tipo: "escanear", uri: data.totpURI, qr, secreto: secretoDe(data.totpURI), codigos: data.backupCodes });
      } else if (paso.para === "desactivar") {
        const { error: err } = await authClient.twoFactor.disable({ password: clave });
        if (err) return setError(mensajeDe(err));
        await refetch();
        setAviso("La verificación en dos pasos quedó desactivada.");
        setPaso({ tipo: "reposo" });
      } else {
        const { data, error: err } = await authClient.twoFactor.generateBackupCodes({ password: clave });
        if (err || !data) return setError(mensajeDe(err));
        setPaso({ tipo: "codigos", codigos: data.backupCodes });
      }
    } finally {
      setClave("");
      setCargando(false);
    }
  }

  async function confirmar() {
    if (paso.tipo !== "escanear") return;
    setCargando(true);
    setError(null);
    const { error: err } = await authClient.twoFactor.verifyTotp({ code: codigo.replace(/\s/g, "") });
    setCargando(false);
    if (err) return setError(mensajeDe(err));
    setCodigo("");
    await refetch();
    setPaso({ tipo: "codigos", codigos: paso.codigos });
  }

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" strokeWidth={1.8} aria-hidden /> Verificación en dos pasos
            </CardTitle>
            {activo ? <Badge variant="success">Activa</Badge> : <Badge variant="warning">Apagada</Badge>}
          </div>
          <CardDescription>
            Además de la contraseña, al entrar se pide un código de 6 dígitos de una app autenticadora en su celular
            (Google Authenticator, Microsoft Authenticator, 1Password…). Si alguien roba su contraseña, sin su celular
            no puede entrar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {aviso && <p className="text-sm text-success-text">{aviso}</p>}

          {paso.tipo === "reposo" &&
            (activo ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setPaso({ tipo: "pedirClave", para: "codigos" })}>
                  Generar códigos de respaldo nuevos
                </Button>
                <Button variant="ghost" onClick={() => setPaso({ tipo: "pedirClave", para: "desactivar" })}>
                  <ShieldOff className="mr-1 h-4 w-4" /> Desactivar
                </Button>
              </div>
            ) : (
              <Button onClick={() => { setAviso(null); setPaso({ tipo: "pedirClave", para: "activar" }); }}>
                <ShieldCheck className="mr-1 h-4 w-4" /> Activar
              </Button>
            ))}

          {paso.tipo === "pedirClave" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void conClave();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="clave-2fa">Confirme su contraseña</Label>
                <Input
                  id="clave-2fa"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-danger-text" role="alert">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={cargando || !clave}>
                  {cargando ? "Verificando…" : paso.para === "desactivar" ? "Desactivar" : "Continuar"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPaso({ tipo: "reposo" })}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          {paso.tipo === "escanear" && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void confirmar();
              }}
            >
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>Abra su app autenticadora y toque «Agregar» o «+».</li>
                <li>Escanee este código (o escriba la clave manualmente).</li>
                <li>Escriba abajo el código de 6 dígitos que le muestra la app.</li>
              </ol>
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL generado aquí */}
                <img src={paso.qr} alt="Código QR para la app autenticadora" width={220} height={220} className="rounded-md border bg-white p-1" />
                <div className="text-xs text-text-3">
                  <p className="font-semibold text-text-2">Clave manual</p>
                  <p className="mt-1 break-all font-mono text-sm text-foreground">{agrupar(paso.secreto)}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="codigo-2fa">Código de 6 dígitos</Label>
                <Input
                  id="codigo-2fa"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9 ]{6,7}"
                  maxLength={7}
                  autoFocus
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/[^\d ]/g, ""))}
                  className="max-w-[10rem] font-mono text-lg tracking-widest"
                />
              </div>
              {error && <p className="text-sm text-danger-text" role="alert">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={cargando || codigo.replace(/\s/g, "").length !== 6}>
                  {cargando ? "Confirmando…" : "Confirmar y activar"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPaso({ tipo: "reposo" })}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          {paso.tipo === "codigos" && (
            <CodigosRespaldo
              codigos={paso.codigos}
              onListo={() => {
                setAviso("Listo: la verificación en dos pasos está activa y su cuenta pide el código al entrar.");
                setPaso({ tipo: "reposo" });
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
