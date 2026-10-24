"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // 049 (fork) — twoFactorClient: el login avisa cuando falta el segundo paso.
  plugins: [organizationClient(), twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
