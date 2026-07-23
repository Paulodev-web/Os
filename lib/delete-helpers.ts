import { PORTAL_BUCKET } from "@/lib/storage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/**
 * Apaga um conjunto de projetos e tudo que pende deles: arquivos no Storage,
 * project_assets e project_milestones. Usado tanto na exclusão de um projeto
 * isolado quanto na exclusão em cascata a partir do cliente.
 */
export async function cascadeDeleteProjects(
  supabase: Db,
  projectIds: string[]
): Promise<void> {
  if (projectIds.length === 0) return;

  const { data: assets } = await supabase
    .from("project_assets")
    .select("storage_path")
    .in("project_id", projectIds);
  const paths: string[] = (assets ?? [])
    .map((a: { storage_path: string | null }) => a.storage_path)
    .filter((p: string | null): p is string => Boolean(p));
  if (paths.length > 0) {
    await supabase.storage.from(PORTAL_BUCKET).remove(paths);
  }

  await supabase.from("project_assets").delete().in("project_id", projectIds);
  await supabase.from("project_milestones").delete().in("project_id", projectIds);
  await supabase.from("projects").delete().in("id", projectIds);
}
