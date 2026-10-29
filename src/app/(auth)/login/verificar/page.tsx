"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * 049 (fork) — Segundo paso del login. Llega aquí quien escribió bien su
 * contraseña y tiene la verificación en dos pasos activa; la sesión todavía
 * no existe hasta que el código sea correcto.
 */
export default function VerificarPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"app" | "respaldo">("app");
  const [codigo, setCodigo] = useState("");
  const [confiar, setConfiar] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const code = modo === "app" ? codigo.replace(/\s/g, "") : codigo.trim();
    const { error: err } =
      modo === "app"
        ? await authClient.twoFactor.verifyTotp({ code, trustDevice: confiar })
        : await authClient.twoFactor.verifyBackupCode({ code, trustDevice: confiar });
    setCargando(false);
    if (err) {
      setError(
        err.status === 429
          ? "Demasiados intentos. Espere unos minutos."
          : err.status === 401
            ? "La sesión de inicio venció. Vuelva a escribir su correo y contraseña."
            : "El código no es correcto. Revise que sea el que muestra la app en este momento."
      );
      if (err.status === 401) setTimeout(() => router.push("/login"), 1500);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Verificación en dos pasos</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {modo === "app"
              ? "Escriba el código de 6 dígitos que muestra su app autenticadora."
              : "Escriba uno de sus códigos de respaldo. Cada uno sirve una sola vez."}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="codigo">{modo === "app" ? "Código" : "Código de respaldo"}</Label>
            <Input
              id="codigo"
              autoFocus
              required
              autoComplete="one-time-code"
              inputMode={modo === "app" ? "numeric" : "text"}
              maxLength={modo === "app" ? 7 : 32}
              value={codigo}
              onChange={(e) => setCodigo(modo === "app" ? e.target.value.replace(/[^\d ]/g, "") : e.target.value)}
              className={modo === "app" ? "font-mono text-lg tracking-widest" : "font-mono"}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={confiar} onChange={(e) => setConfiar(e.target.checked)} />
            No volver a pedirlo en este dispositivo por 30 días
          </label>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={cargando}>
            {cargando ? "Verificando…" : "Entrar"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-primary hover:underline"
            onClick={() => {
              setModo(modo === "app" ? "respaldo" : "app");
              setCodigo("");
              setError(null);
            }}
          >
            {modo === "app" ? "¿No tiene el celular? Use un código de respaldo" : "Usar la app autenticadora"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
