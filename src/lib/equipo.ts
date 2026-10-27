import { z } from "zod";

/** 054 (fork) — Contratos de la gestión del equipo (cliente y servidor). */
export const ROLES_EQUIPO = ["owner", "member"] as const;
export type RolEquipo = (typeof ROLES_EQUIPO)[number];

export const ROL_LABELS: Record<RolEquipo, string> = {
  owner: "Propietario",
  member: "Miembro",
};

export const ROL_AYUDA: Record<RolEquipo, string> = {
  owner: "Todo, incluidos Ajustes, el equipo y las conexiones.",
  member: "Bandeja, contactos, pipeline, tareas y propiedades. Sin Ajustes.",
};

export const editarMiembroSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    role: z.enum(ROLES_EQUIPO).optional(),
  })
  .refine((v) => v.name !== undefined || v.email !== undefined || v.role !== undefined, {
    message: "Nada que cambiar",
  });

export const contrasenaSchema = z.object({
  password: z.string().min(8).max(128),
  /** Para quien perdió el teléfono: quita también la verificación en dos pasos. */
  quitarDosPasos: z.boolean().default(false),
});
