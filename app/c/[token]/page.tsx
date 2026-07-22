import Image from "next/image";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  CheckCircle2,
  Paperclip,
  ExternalLink,
  Check,
  X,
  AlertTriangle,
  MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { PhaseStepper } from "@/components/portal/phase-stepper";
import { AssetGallery } from "@/components/portal/asset-gallery";
import { publicAssetUrl } from "@/lib/storage";
import { PROJECT_STATUS_LABEL } from "@/lib/labels";
import { PHASE_LABEL, type ProjectPhaseKey } from "@/lib/phases";
import { dateBR, dateTimeBR } from "@/lib/format";

export const dynamic = "force-dynamic";

/* Portal público de acompanhamento.
   Fonte de dados: RPC os_pessoal.portal_do_cliente(token) — por construção,
   só retorna marcos publicados e assets ligados a marco publicado (ou
   entregáveis do projeto sem marco, ver "arquivos"). */

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
  fase: string | null;
  assets: PortalAsset[];
}
interface PortalProjeto {
  id: string;
  nome: string;
  status: string;
  descricao: string | null;
  iniciado_em: string | null;
  fase_atual: string | null;
  fase_atual_previsao: string | null;
  escopo_incluido: string | null;
  escopo_excluido: string | null;
  proxima_acao: string | null;
  proxima_acao_data: string | null;
  marcos: PortalMarco[];
  arquivos: PortalAsset[];
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

function splitLines(text: string | null): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function assetHref(asset: PortalAsset): string | null {
  if (asset.storage_path) return publicAssetUrl(asset.storage_path);
  return asset.url_externa;
}

function AssetChip({ asset }: { asset: PortalAsset }) {
  const href = assetHref(asset);
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

function ScopeList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "negative";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          tone === "positive" ? "text-primary-dark" : "text-muted"
        }`}
      >
        {title}
      </p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            {tone === "positive" ? (
              <Check size={14} className="mt-0.5 shrink-0 text-primary" />
            ) : (
              <X size={14} className="mt-0.5 shrink-0 text-muted" />
            )}
            <span
              className={tone === "positive" ? "text-foreground" : "text-muted"}
            >
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const portal = await fetchPortal(token);
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  // Defesa: a RPC portal_do_cliente já deve filtrar arquivados, mas o front
  // não lista projetos arquivados caso a função no banco ainda não tenha sido
  // atualizada (ver docs/sql/2026-07-parte2-portal-etapas.sql).
  const projetos =
    portal?.projetos.filter((p) => p.status !== "arquivado") ?? [];

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
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-5">
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

      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-black tracking-tight">
          Olá, {portal.cliente} 👋
        </h1>
        <p className="mt-2 font-light text-muted">
          Aqui você acompanha cada etapa concluída do seu projeto — sem
          precisar perguntar.
        </p>

        {projetos.length === 0 && (
          <p className="mt-10 rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
            Seu acompanhamento vai aparecer aqui em breve.
          </p>
        )}

        {projetos.map((projeto) => {
          const scopeIncluded = splitLines(projeto.escopo_incluido);
          const scopeExcluded = splitLines(projeto.escopo_excluido);

          return (
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

              {/* Visão geral — stepper de fases */}
              <PhaseStepper
                currentPhase={projeto.fase_atual}
                targetDate={projeto.fase_atual_previsao}
              />

              {/* Escopo do projeto */}
              {(scopeIncluded.length > 0 || scopeExcluded.length > 0) && (
                <div className="mt-6 grid gap-5 rounded-xl border border-border bg-surface p-4 shadow-card sm:grid-cols-2">
                  <ScopeList
                    title="Incluído no escopo"
                    items={scopeIncluded}
                    tone="positive"
                  />
                  <ScopeList
                    title="Fora do escopo"
                    items={scopeExcluded}
                    tone="negative"
                  />
                </div>
              )}

              {/* Próxima ação necessária do cliente */}
              {projeto.proxima_acao && (
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3">
                  <AlertTriangle
                    size={18}
                    className="mt-0.5 shrink-0 text-warn"
                  />
                  <div>
                    <p className="text-sm font-semibold text-warn">
                      Ação necessária da sua parte
                    </p>
                    <p className="mt-0.5 text-sm text-foreground">
                      {projeto.proxima_acao}
                    </p>
                    {projeto.proxima_acao_data && (
                      <p className="mt-1 text-xs text-muted">
                        Prazo: {dateBR(projeto.proxima_acao_data)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Timeline de marcos */}
              {projeto.marcos.length === 0 ? (
                <p className="mt-6 rounded-xl border border-dashed border-border bg-surface p-5 text-sm text-muted">
                  As primeiras etapas deste projeto vão aparecer aqui assim que
                  forem concluídas.
                </p>
              ) : (
                <ol className="relative mt-6 space-y-6 border-l-2 border-primary-soft pl-6">
                  {projeto.marcos.map((marco, i) => {
                    const imageAssets = marco.assets.filter(
                      (a) => a.tipo === "imagem" && a.storage_path
                    );
                    const otherAssets = marco.assets.filter(
                      (a) => !(a.tipo === "imagem" && a.storage_path)
                    );
                    return (
                      <li key={i} className="relative">
                        <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-surface">
                          <CheckCircle2
                            size={18}
                            className="text-primary"
                            strokeWidth={2.4}
                          />
                        </span>
                        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-semibold text-primary-dark">
                              {dateTimeBR(marco.publicado_em)}
                            </p>
                            {marco.fase && (
                              <Badge tone="info">
                                {PHASE_LABEL[marco.fase as ProjectPhaseKey] ??
                                  marco.fase}
                              </Badge>
                            )}
                          </div>
                          <h3 className="mt-0.5 font-semibold">
                            {marco.titulo}
                          </h3>
                          {marco.descricao && (
                            <p className="mt-1 text-sm text-muted">
                              {marco.descricao}
                            </p>
                          )}
                          {imageAssets.length > 0 && (
                            <AssetGallery
                              images={imageAssets.map((a) => ({
                                src: assetHref(a)!,
                                alt: a.titulo ?? marco.titulo,
                              }))}
                            />
                          )}
                          {otherAssets.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {otherAssets.map((a, j) => (
                                <AssetChip key={j} asset={a} />
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              {/* Arquivos e entregáveis do projeto */}
              {(projeto.arquivos ?? []).length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Arquivos do projeto
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(projeto.arquivos ?? []).map((a, j) => (
                      <AssetChip key={j} asset={a} />
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Footer grafite — wordmark branco (regra: logo verde só em fundo claro) */}
      <footer className="mt-16 bg-graphite">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 py-8 text-center">
          <span className="text-lg font-black tracking-tight text-white">
            devpaulo
            <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-primary-soft" />
          </span>
          <p className="text-xs font-light text-white/50">
            Software sob medida — contato@devpaulo.com.br
          </p>
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
                `Oi! Sou ${portal.cliente} e vim pelo portal de acompanhamento.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              <MessageCircle size={16} /> Falar no WhatsApp
            </a>
          )}
        </div>
      </footer>
    </main>
  );
}
