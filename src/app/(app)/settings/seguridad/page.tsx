import { SeguridadClient } from "@/components/seguridad/seguridad-client";

export const dynamic = "force-dynamic";

/** 049 (fork) — Seguridad de la cuenta de quien mira (verificación en dos pasos). */
export default function SeguridadPage() {
  return <SeguridadClient />;
}
