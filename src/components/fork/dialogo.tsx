"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const ENFOCABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 056 (fork) — Diálogo accesible para los formularios del fork.
 *
 * - Se pinta en `<body>` (portal): abierto desde la barra lateral, un
 *   `fixed` dentro de ella quedaba atrapado en su ancho (190 px).
 * - `role="dialog"` + `aria-modal` + `aria-labelledby` con su título.
 * - Al abrir, el foco va al primer campo (o a `[data-autofocus]`); Tab y
 *   Mayús+Tab no salen del diálogo; Esc cierra; al cerrar, el foco vuelve a
 *   lo que lo abrió.
 * - En el celular sube como hoja desde abajo; en escritorio, centrado.
 */
export function Dialogo({
  titulo,
  descripcion,
  onClose,
  children,
  className,
  ancho = "sm:max-w-md",
}: {
  titulo: string;
  descripcion?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  ancho?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [montado, setMontado] = useState(false);
  const cerrar = useRef(onClose);
  cerrar.current = onClose;

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!montado) return;
    const previo = document.activeElement as HTMLElement | null;
    const caja = ref.current;
    const primero =
      caja?.querySelector<HTMLElement>("[data-autofocus]") ??
      caja?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled])") ??
      caja?.querySelector<HTMLElement>(ENFOCABLE);
    primero?.focus();
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        cerrar.current();
        return;
      }
      if (e.key !== "Tab" || !caja) return;
      const items = [...caja.querySelectorAll<HTMLElement>(ENFOCABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const a = items[0]!;
      const z = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = scroll;
      if (previo && document.contains(previo)) previo.focus();
    };
  }, [montado]);

  if (!montado) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={descripcion ? `${id}-d` : undefined}
        className={cn(
          "max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border bg-popover p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-foreground shadow-pop sm:rounded-lg",
          ancho,
          className
        )}
      >
        <h2 id={`${id}-t`} className="text-[17px] font-semibold">
          {titulo}
        </h2>
        {descripcion && (
          <p id={`${id}-d`} className="mt-1 text-[13px] text-text-2">
            {descripcion}
          </p>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
