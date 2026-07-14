"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";

export async function salvarMeta(formData: FormData) {
  const kcal = Number(formData.get("kcal_alvo") ?? 0);
  const prot = Number(formData.get("proteina_alvo") ?? 0);
  const carb = Number(formData.get("carbo_alvo") ?? 0);
  const gord = Number(formData.get("gordura_alvo") ?? 0);
  if (kcal <= 0 || prot < 0 || carb < 0 || gord < 0) return;

  const hoje = todayISO();
  const supabase = await createClient();

  // meta é versionada por vigente_desde; alterar no mesmo dia atualiza a do dia
  const { data: existente } = await supabase
    .from("dieta_metas")
    .select("id")
    .eq("vigente_desde", hoje)
    .maybeSingle();

  const valores = {
    kcal_alvo: kcal,
    proteina_alvo: prot,
    carbo_alvo: carb,
    gordura_alvo: gord,
  };
  if (existente) {
    await supabase.from("dieta_metas").update(valores).eq("id", existente.id);
  } else {
    await supabase
      .from("dieta_metas")
      .insert({ ...valores, vigente_desde: hoje });
  }
  revalidatePath("/dieta");
}

export async function registrarItem(formData: FormData) {
  const data = String(formData.get("data") ?? "") || todayISO();
  const refeicao = String(formData.get("refeicao_nome") ?? "").trim();
  const alimentoId = String(formData.get("alimento_id") ?? "");
  const qtd = Number(String(formData.get("quantidade_g") ?? "").replace(",", "."));
  if (!refeicao || !alimentoId || !Number.isFinite(qtd) || qtd <= 0) return;

  const supabase = await createClient();

  // agrupa por (data, refeição): acha o registro ou cria
  const { data: registro } = await supabase
    .from("dieta_registros")
    .select("id")
    .eq("data", data)
    .eq("refeicao_nome", refeicao)
    .maybeSingle();

  let registroId = registro?.id as string | undefined;
  if (!registroId) {
    const { data: novo, error } = await supabase
      .from("dieta_registros")
      .insert({ data, refeicao_nome: refeicao })
      .select("id")
      .single();
    if (error || !novo) return;
    registroId = novo.id;
  }

  await supabase.from("dieta_registro_itens").insert({
    registro_id: registroId,
    alimento_id: alimentoId,
    quantidade_g: qtd,
  });
  revalidatePath("/dieta");
  revalidatePath("/hoje");
}

export async function deleteItemRegistro(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("dieta_registro_itens").delete().eq("id", id);
  revalidatePath("/dieta");
}

export async function deleteRegistro(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("dieta_registros").delete().eq("id", id);
  revalidatePath("/dieta");
}
