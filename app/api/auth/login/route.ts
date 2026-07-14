import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  getClientIp,
  isLoginBlocked,
  recordLoginFailure,
  clearLoginFailures,
  LOGIN_WINDOW_MINUTES,
} from "@/lib/auth";

/**
 * Login do owner: a tela pede só a senha.
 * O email é fixo, server-side, via ADMIN_LOGIN_EMAIL — nunca exposto no front.
 */
export async function POST(request: NextRequest) {
  const email = process.env.ADMIN_LOGIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.error("ADMIN_LOGIN_EMAIL não configurado");
    return NextResponse.json(
      { success: false, error: "Configuração de login ausente" },
      { status: 500 }
    );
  }

  let password: string | undefined;
  try {
    const body = await request.json();
    password = typeof body?.password === "string" ? body.password : undefined;
  } catch {
    // body inválido cai na validação abaixo
  }

  if (!password) {
    return NextResponse.json(
      { success: false, error: "Senha é obrigatória" },
      { status: 400 }
    );
  }

  const ip = getClientIp(request.headers);
  if (isLoginBlocked(ip)) {
    return NextResponse.json(
      {
        success: false,
        error: `Muitas tentativas. Tente novamente em ${LOGIN_WINDOW_MINUTES} minutos.`,
      },
      { status: 429 }
    );
  }

  const response = NextResponse.json({ success: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message === "Invalid login credentials") {
      recordLoginFailure(ip);
    } else {
      console.error("Login error:", error.message);
    }
    return NextResponse.json(
      { success: false, error: "Senha incorreta" },
      { status: 401 }
    );
  }

  clearLoginFailures(ip);
  return response;
}
