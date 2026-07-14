import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/* Cliente service_role — SÓ para contextos sem sessão de usuário (cron).
   Nunca importar em código que roda no browser. */

export function adminConfigurado(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada — necessária para o cron."
    );
  }
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    db: { schema: "os_pessoal" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
