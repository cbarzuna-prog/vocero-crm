import { apiError } from "@/lib/api";
import type { EquipoError } from "./service";

export function equipoErrorResponse(err: EquipoError): Response {
  return apiError(err.status, err.code, err.message);
}
