"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { executarBriefingDiario } from "@/lib/briefing";

export async function gerarBriefingAgora() {
  const supabase = await createClient();

  let erro: string | null = null;
  try {
    await executarBriefingDiario(supabase);
  } catch (e) {
    erro = e instanceof Error ? e.message : "Falha ao gerar o briefing.";
  }

  revalidatePath("/hoje");
  if (erro) redirect(`/hoje?erro=${encodeURIComponent(erro)}`);
}

export async function updateAlertStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["resolvido", "dispensado"].includes(status)) return;

  const supabase = await createClient();
  await supabase.from("alerts").update({ status }).eq("id", id);
  revalidatePath("/hoje");
}

/* Gestão manual da memória do agente — saída sem depender do chat.
   (O agente também escreve/apaga via tools remember_fact/forget_memory.) */
export async function deleteMemory(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("agent_memories").delete().eq("id", id);
  revalidatePath("/hoje");
}
