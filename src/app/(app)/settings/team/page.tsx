import { eq } from "drizzle-orm";
import { TeamClient } from "@/components/settings/team-client";
import { getSessionOrNull } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { equipoEnabled } from "@/server/equipo/flag";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  // Fork (054): con los módulos del fork, la lista del equipo trae acciones.
  if (!equipoEnabled()) return <TeamClient />;
  const s = await getSessionOrNull();
  const [yo] = s
    ? await getDb().select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, s.userId)).limit(1)
    : [];
  return <TeamClient gestion={{ meEmail: yo?.email ?? "", esPropietario: s?.role === "owner" }} />;
}
