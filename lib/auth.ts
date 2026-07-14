import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Guarda de página: exige sessão válida, senão manda pro /login.
 * Defesa em profundidade — o proxy.ts já redireciona, mas a página
 * revalida por conta própria (e a RLS garante o dado no fim).
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

// ================================================
// Rate limit de falhas de login (em memória, por IP)
// Mesmo padrão do devpaulo-main — suficiente pra 1 usuário.
// ================================================

const failures = new Map<string, { count: number; resetTime: number }>();

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function isLoginBlocked(ip: string): boolean {
  const entry = failures.get(ip);
  if (!entry || Date.now() > entry.resetTime) return false;
  return entry.count >= MAX_FAILURES;
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const entry = failures.get(ip);
  if (!entry || now > entry.resetTime) {
    failures.set(ip, { count: 1, resetTime: now + WINDOW_MINUTES * 60_000 });
    return;
  }
  entry.count++;
}

export function clearLoginFailures(ip: string): void {
  failures.delete(ip);
}

export const LOGIN_WINDOW_MINUTES = WINDOW_MINUTES;
