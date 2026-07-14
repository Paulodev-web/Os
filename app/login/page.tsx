"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? "Erro ao fazer login");
        return;
      }

      const from = searchParams.get("from");
      router.push(from && from.startsWith("/") ? from : "/");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            OS Pessoal
          </h1>
          <p className="mt-1 text-sm text-zinc-400">painel.devpaulo.com.br</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg"
        >
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-300"
          >
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-400"
          />

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || password.length === 0}
            className="mt-5 w-full rounded-lg bg-zinc-100 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:opacity-50"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
