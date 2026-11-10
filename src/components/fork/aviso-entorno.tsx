/**
 * 066 (fork) — Franja naranja arriba de todo en el sandbox, para que nadie
 * confunda la copia de pruebas con el CRM real. Se decide en el servidor
 * (`ENTORNO=sandbox`); en el real no pinta nada.
 */
export function AvisoEntorno() {
  if (process.env.ENTORNO !== "sandbox") return null;
  return (
    <div role="note" className="bg-[#fd5d08] px-4 py-1.5 text-center text-[13px] font-semibold text-white">
      Sandbox · copia de pruebas. Lo que haga aquí no afecta al CRM real ni le escribe a ningún cliente.
    </div>
  );
}
