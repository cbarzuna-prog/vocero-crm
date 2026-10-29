import { ContactsClient } from "@/components/contacts/contacts-client";
import { ContactosClient } from "@/components/fork/contactos-client";
import { forkActivo } from "@/server/fork-activo";

export const dynamic = "force-dynamic";

export default function ContactsPage() {
  // Fork (057): con los módulos del fork, la lista para trabajar la cartera.
  return forkActivo() ? <ContactosClient /> : <ContactsClient />;
}
