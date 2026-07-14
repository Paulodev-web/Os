"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";

const ORIGINS = ["devpaulo", "pessoal", "iservice"];
const FINANCE_PATHS = [
  "/financeiro",
  "/financeiro/consolidado",
  "/iservice/financeiro",
];

function revalidateFinance() {
  for (const p of FINANCE_PATHS) revalidatePath(p);
}

export async function createEntry(formData: FormData) {
  const origin = String(formData.get("origin") ?? "");
  const type = String(formData.get("type") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "").replace(",", "."));
  const date = String(formData.get("date") ?? "") || todayISO();

  if (
    !ORIGINS.includes(origin) ||
    !["entrada", "saida"].includes(type) ||
    !category ||
    !Number.isFinite(amount) ||
    amount <= 0
  )
    return;

  const supabase = await createClient();
  await supabase.from("finance_entries").insert({
    origin,
    type,
    category,
    description: description || null,
    amount,
    date,
  });
  revalidateFinance();
}

/* Transferência devpaulo ↔ pessoal — SEMPRE em par atômico via RPC
   create_transfer (saída na origem + entrada no destino, mesmo
   transfer_group_id). iService nunca participa (constraint no banco). */
export async function createTransfer(formData: FormData) {
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const amount = Number(String(formData.get("amount") ?? "").replace(",", "."));
  const date = String(formData.get("date") ?? "") || todayISO();
  const description = String(formData.get("description") ?? "").trim();

  const validos = ["devpaulo", "pessoal"];
  if (
    !validos.includes(from) ||
    !validos.includes(to) ||
    from === to ||
    !Number.isFinite(amount) ||
    amount <= 0
  )
    return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_transfer", {
    p_from: from,
    p_to: to,
    p_amount: amount,
    p_date: date,
    p_description: description || null,
  });

  revalidateFinance();
  if (error) {
    redirect(
      `/financeiro/consolidado?erro=${encodeURIComponent(error.message)}`
    );
  }
}

/* Excluir lançamento: se for perna de transferência, remove o PAR inteiro —
   nunca pode sobrar perna solta. */
export async function deleteEntry(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("finance_entries")
    .select("transfer_group_id")
    .eq("id", id)
    .maybeSingle();

  if (data?.transfer_group_id) {
    await supabase
      .from("finance_entries")
      .delete()
      .eq("transfer_group_id", data.transfer_group_id);
  } else {
    await supabase.from("finance_entries").delete().eq("id", id);
  }
  revalidateFinance();
}
