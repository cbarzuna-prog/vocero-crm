import { notFound } from "next/navigation";
import { ContactoPagina } from "@/components/fork/contacto-pagina";
import { forkActivo } from "@/server/fork-activo";

export const dynamic = "force-dynamic";

/** 057 (fork) — La página completa de un contacto. Sin los módulos del fork, no existe. */
export default async function ContactoPage({ params }: { params: Promise<{ id: string }> }) {
  if (!forkActivo()) notFound();
  const { id } = await params;
  return <ContactoPagina id={id} />;
}
