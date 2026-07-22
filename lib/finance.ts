import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinanceOrigin, FinanceType } from "@/lib/database.types";

/* Regras de lançamento financeiro em funções puras — reaproveitadas pela
   Server Action (parse de FormData) e pela tool do Agente central, pra
   ninguém aceitar origin/type fora do enum que a UI já rejeita. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export const FINANCE_ORIGINS: FinanceOrigin[] = [
  "devpaulo",
  "pessoal",
  "iservice",
];
export const FINANCE_TYPES: FinanceType[] = ["entrada", "saida"];

export interface LancamentoInput {
  origin: string;
  type: string;
  category: string;
  description?: string | null;
  amount: number;
  date: string;
}

export type LancamentoResult =
  | { ok: true; id: string }
  | { ok: false; erro: string };

function validar(input: {
  origin?: string;
  type?: string;
  category?: string;
  amount?: number;
  date?: string;
}): string | null {
  if (input.origin !== undefined && !FINANCE_ORIGINS.includes(input.origin as FinanceOrigin))
    return "Origem inválida (use devpaulo, pessoal ou iservice).";
  if (input.type !== undefined && !FINANCE_TYPES.includes(input.type as FinanceType))
    return "Tipo inválido (use entrada ou saida).";
  if (input.category !== undefined && !input.category.trim())
    return "Categoria obrigatória.";
  if (
    input.amount !== undefined &&
    (!Number.isFinite(input.amount) || input.amount <= 0)
  )
    return "Valor deve ser maior que zero.";
  return null;
}

/** Insere um lançamento, validando origin/type/amount. Não trata transferência
    (transferência é sempre par atômico via RPC create_transfer). */
export async function inserirLancamento(
  db: Db,
  input: LancamentoInput
): Promise<LancamentoResult> {
  const erro = validar(input);
  if (erro) return { ok: false, erro };

  const { data, error } = await db
    .from("finance_entries")
    .insert({
      origin: input.origin,
      type: input.type,
      category: input.category.trim(),
      description: input.description?.trim() || null,
      amount: input.amount,
      date: input.date,
    })
    .select("id")
    .single();

  if (error) return { ok: false, erro: error.message };
  return { ok: true, id: data.id as string };
}

/** Atualiza um lançamento existente. Rejeita perna de transferência (par
    atômico não pode ser editado solto). Origin/type não são editáveis aqui. */
export async function atualizarLancamento(
  db: Db,
  input: {
    id: string;
    category: string;
    description?: string | null;
    amount: number;
    date: string;
  }
): Promise<LancamentoResult> {
  const erro = validar(input);
  if (erro) return { ok: false, erro };

  const { data: current } = await db
    .from("finance_entries")
    .select("transfer_group_id")
    .eq("id", input.id)
    .maybeSingle();
  if (current?.transfer_group_id) {
    return {
      ok: false,
      erro:
        "Essa linha é perna de uma transferência — edite pela tela de Financeiro (excluir e recriar o par).",
    };
  }

  const { data, error } = await db
    .from("finance_entries")
    .update({
      category: input.category.trim(),
      description: input.description?.trim() || null,
      amount: input.amount,
      date: input.date,
    })
    .eq("id", input.id)
    .select("id");

  if (error) return { ok: false, erro: error.message };
  if (!data?.length)
    return { ok: false, erro: "Nada foi atualizado (RLS ou id inexistente)." };
  return { ok: true, id: input.id };
}
