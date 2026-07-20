import Image from "next/image";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { CheckCircle2, Paperclip, ExternalLink } from "lucide-react";
import { publicAssetUrl } from "@/lib/storage";
import { PROJECT_STATUS_LABEL } from "@/lib/labels";
import { dateBR, dateTimeBR } from "@/lib/format";

export const dynamic = "force-dynamic";

/* Portal público de acompanhamento.
   Fonte de dados: RPC os_pessoal.portal_do_cliente(token) — por construção,
   só retorna marcos publicados e assets ligados a marco publicado. */

interface PortalAsset {
  tipo: string;
  titulo: string | null;
  storage_path: string | null;
  url_externa: string | null;
}
interface PortalMarco {
  titulo: string;
  descricao: string | null;
  publicado_em: string;
  assets: PortalAsset[];
}
interface PortalProjeto {
  id: string;
  nome: string;
  status: string;
  descricao: string | null;
  iniciado_em: string | null;
  marcos: PortalMarco[];
}
interface PortalData {
  cliente: string;
  projetos: PortalProjeto[];
}

async function fetchPortal(token: string): Promise<PortalData | null> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "os_pessoal" }, auth: { persistSession: false } }
  );
  const { data, error } = await supabase.rpc("portal_do_cliente", {
    p_token: token,
  });
  if (error || !data) return null;
  return data as PortalData;
}

function AssetChip({ asset }: { asset: PortalAsset }) {
  const href = asset.storage_path
    ? publicAssetUrl(asset.storage_path)
    : asset.url_externa;
  if (!href) return null;

  if (asset.tipo === "imagem" && asset.storage_path) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={href}
          alt={asset.titulo ?? "Imagem do projeto"}
          className="max-h-56 rounded-lg border border-border object-cover transition hover:opacity-90"
        />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:text-primary-dark"
    >
      {asset.tipo === "link" ? (
        <ExternalLink size={14} className="text-primary" />
      ) : (
        <Paperclip size={14} className="text-primary" />
      )}
      {asset.titulo ?? "Anexo"}
    </a>
  );
}

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const portal = await fetchPortal(token);

  if (!portal) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <Image
          src="/logo/devpaulo.png"
          alt="devpaulo"
          width={64}
          height={64}
        />
        <h1 className="mt-4 text-xl font-black">Link não encontrado</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Este link de acompanhamento não existe ou foi desativado. Confira com
          quem enviou ou fale com contato@devpaulo.com.br.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header claro com logo verde (regra da marca) */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-5">
          <Image
            src="/logo/devpaulo.png"
            alt="devpaulo"
            width={40}
            height={40}
          />
          <div>
            <span className="flex items-baseline gap-1 text-lg font-black tracking-tight">
              devpaulo
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <p className="text-xs font-light text-muted">
              Acompanhamento de projeto
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-black tracking-tight">
          Olá, {portal.cliente} 👋
        </h1>
        <p className="mt-2 font-light text-muted">
          Aqui você acompanha cada etapa concluída do seu projeto — sem
          precisar perguntar.
        </p>

        {portal.projetos.length === 0 && (
          <p className="mt-10 rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
            Seu acompanhamento vai aparecer aqui em breve.
          </p>
        )}

        {portal.projetos.map((projeto) => (
          <section key={projeto.id} className="mt-10">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-black tracking-tight">
                {projeto.nome}
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  projeto.status === "entregue"
                    ? "bg-primary-soft text-primary-dark"
                    : "bg-background text-muted border border-border"
                }`}
              >
                {PROJECT_STATUS_LABEL[projeto.status] ?? projeto.status}
              </span>
            </div>
            {projeto.iniciado_em && (
              <p className="mt-1 text-xs text-muted">
                Início: {dateBR(projeto.iniciado_em)}
              </p>
            )}

            {projeto.marcos.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-border bg-surface p-5 text-sm text-muted">
                As primeiras etapas deste projeto vão aparecer aqui assim que
                forem concluídas.
              </p>
            ) : (
              <ol className="relative mt-6 space-y-6 border-l-2 border-primary-soft pl-6">
                {projeto.marcos.map((marco, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-surface">
                      <CheckCircle2
                        size={18}
                        className="text-primary"
                        strokeWidth={2.4}
                      />
                    </span>
                    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                      <p className="text-xs font-semibold text-primary-dark">
                        {dateTimeBR(marco.publicado_em)}
                      </p>
                      <h3 className="mt-0.5 font-semibold">{marco.titulo}</h3>
                      {marco.descricao && (
                        <p className="mt-1 text-sm text-muted">
                          {marco.descricao}
                        </p>
                      )}
                      {marco.assets.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {marco.assets.map((a, j) => (
                            <AssetChip key={j} asset={a} />
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>

      {/* Footer grafite — wordmark branco (regra: logo verde só em fundo claro) */}
      <footer className="mt-16 bg-graphite">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-1 px-6 py-8 text-center">
          <span className="text-lg font-black tracking-tight text-white">
            devpaulo
            <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-primary-soft" />
          </span>
          <p className="text-xs font-light text-white/50">
            Software sob medida — contato@devpaulo.com.br
          </p>
        </div>
      </footer>
    </main>
  );
}
