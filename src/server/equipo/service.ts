import { and, eq, isNull, ne } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import type { SessionContext } from "@/lib/auth/session";
import type { RolEquipo } from "@/lib/equipo";

/** 054 (fork) — Errores de dominio de la gestión del equipo. */
export class EquipoError extends Error {
  constructor(
    readonly status: 403 | 404 | 409 | 422,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "EquipoError";
  }
}

function soloPropietario(s: SessionContext) {
  if (s.role !== "owner") throw new EquipoError(403, "forbidden", "Solo un propietario puede administrar el equipo.");
}

/** El miembro, siempre dentro de la organización de quien pide. */
async function miembro(s: SessionContext, memberId: string) {
  const db = getDb();
  const [m] = await db
    .select({ id: schema.member.id, userId: schema.member.userId, role: schema.member.role })
    .from(schema.member)
    .where(scoped(schema.member.organizationId, s.organizationId, eq(schema.member.id, memberId)))
    .limit(1);
  if (!m) throw new EquipoError(404, "no_encontrado", "Esa persona no está en el equipo.");
  return m;
}

async function propietarios(organizationId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(scoped(schema.member.organizationId, organizationId, eq(schema.member.role, "owner")));
  return rows.length;
}

const esUnico = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";

export async function editarMiembro(
  s: SessionContext,
  memberId: string,
  cambios: { name?: string; email?: string; role?: RolEquipo }
): Promise<void> {
  soloPropietario(s);
  const m = await miembro(s, memberId);
  const db = getDb();

  if (cambios.role && cambios.role !== m.role) {
    // Nunca sin propietario: alguien tiene que poder entrar a Ajustes.
    if (m.role === "owner" && cambios.role !== "owner" && (await propietarios(s.organizationId)) <= 1) {
      throw new EquipoError(409, "ultimo_propietario", "Tiene que quedar al menos un propietario. Haga propietario a otra persona primero.");
    }
    await db.update(schema.member).set({ role: cambios.role }).where(eq(schema.member.id, m.id));
  }

  const datos: { name?: string; email?: string; updatedAt?: Date } = {};
  if (cambios.name !== undefined) datos.name = cambios.name;
  if (cambios.email !== undefined) datos.email = cambios.email;
  if (Object.keys(datos).length > 0) {
    try {
      await db.update(schema.user).set({ ...datos, updatedAt: new Date() }).where(eq(schema.user.id, m.userId));
    } catch (err) {
      if (esUnico(err)) throw new EquipoError(409, "correo_en_uso", "Ya hay otra cuenta con ese correo.");
      throw err;
    }
  }
}

/**
 * Contraseña temporal puesta por un propietario (quien la olvidó, o quien
 * perdió el teléfono con la verificación en dos pasos). Cierra las sesiones
 * abiertas de esa persona, salvo que sea quien lo hace.
 */
export async function restablecerContrasena(
  s: SessionContext,
  memberId: string,
  password: string,
  quitarDosPasos: boolean
): Promise<void> {
  soloPropietario(s);
  const m = await miembro(s, memberId);
  const ctx = await getAuth().$context;
  const hash = await ctx.password.hash(password);
  const cuentas = await ctx.internalAdapter.findAccounts(m.userId);
  if (cuentas.some((a) => a.providerId === "credential")) {
    await ctx.internalAdapter.updatePassword(m.userId, hash);
  } else {
    await ctx.internalAdapter.linkAccount({ userId: m.userId, providerId: "credential", accountId: m.userId, password: hash });
  }
  const db = getDb();
  if (quitarDosPasos) {
    await db.delete(schema.twoFactor).where(eq(schema.twoFactor.userId, m.userId));
    await db.update(schema.user).set({ twoFactorEnabled: false }).where(eq(schema.user.id, m.userId));
  }
  if (m.userId !== s.userId) await db.delete(schema.session).where(eq(schema.session.userId, m.userId));
}

/**
 * Quitar a alguien del equipo. Sus tareas pendientes pasan a quien lo quita
 * (nada queda sin dueño); las hechas se quedan como historial. La cuenta se
 * borra: sus sesiones se cierran y ya no puede entrar.
 */
export async function quitarMiembro(s: SessionContext, memberId: string): Promise<{ tareasReasignadas: number }> {
  soloPropietario(s);
  const m = await miembro(s, memberId);
  if (m.userId === s.userId) throw new EquipoError(409, "a_si_mismo", "No puede quitarse a sí mismo. Pídaselo a otro propietario.");
  if (m.role === "owner" && (await propietarios(s.organizationId)) <= 1) {
    throw new EquipoError(409, "ultimo_propietario", "Tiene que quedar al menos un propietario.");
  }
  const db = getDb();
  return db.transaction(async (tx) => {
    const movidas = await tx
      .update(schema.task)
      .set({ assignedUserId: s.userId })
      .where(
        and(
          scoped(schema.task.organizationId, s.organizationId),
          eq(schema.task.assignedUserId, m.userId),
          isNull(schema.task.doneAt)
        )
      )
      .returning({ id: schema.task.id });
    // Si la cuenta solo pertenece a esta organización (lo normal: una
    // instancia = un negocio), se borra entera; si no, solo su membresía.
    const otras = await tx
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(and(eq(schema.member.userId, m.userId), ne(schema.member.id, m.id)));
    if (otras.length === 0) await tx.delete(schema.user).where(eq(schema.user.id, m.userId));
    else {
      await tx.delete(schema.member).where(eq(schema.member.id, m.id));
      await tx.delete(schema.session).where(eq(schema.session.userId, m.userId));
    }
    return { tareasReasignadas: movidas.length };
  });
}
