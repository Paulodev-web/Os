# Escopo — Revisão de Julho/2026 (OS Pessoal)

> Origem: review em áudio (Whisper) do Paulo navegando pelo produto em produção, + rodada de esclarecimentos respondendo às perguntas em aberto da v1 deste doc. **Nada foi implementado ainda** — é só o plano, pra Paulo validar antes de eu começar a construir.
>
> Referência de arquitetura original: `PLANO.md` (raiz de `devpaulo.com.br`). Este doc assume esse contexto e só registra o que muda.

---

## 0. Sem mudança nesta rodada

- Financeiro — não mencionado nesta rodada, mantém as 3 telas e o par atômico de transferência.
- Treino/Dieta (dados e telas) — sem mudança de modelo ou UI; só o back-end do Coach que muda de provedor (ver seção 3).
- iService — não mencionado, sem mudança.

---

## 1. Clientes / Portal do cliente — **prioridade 1, urgente**

Paulo marcou esta frente como a que tem mais urgência de ficar pronta — separar e entregar primeiro.

### Bugs a corrigir
- **Adicionar marco não está funcionando** — a ação de criar `project_milestone` (em `/projetos/[id]` ou onde ela vive hoje) está quebrada. Precisa investigar o handler atual antes de escopar a correção.
- **Upload de foto/arquivo não está funcionando** — anexar imagem/arquivo a um marco (`project_assets`) precisa de upload real (Supabase Storage: bucket, política de acesso, referência em `storage_url`). Hoje aparentemente não existe ou está quebrado.

### Melhorias visuais
- Exibição pro cliente (`/c/[token]`) mais bonita e organizada — aplicar a identidade visual oficial da devpaulo (ver seção "Logo oficial" abaixo) no header/marca do portal.

**Escopo desta frente:** corrigir os dois bugs primeiro (são bloqueadores — sem eles o portal não cumpre a função básica), depois aplicar a identidade visual. Melhorias de conteúdo adicional no portal (mais dados agregados, timeline mais rica) ficam pra uma rodada seguinte, não bloqueiam esta entrega.

---

## 2. Tarefas — filtro por período

Confirmado sem ajuste em relação à v1 deste doc.

**Estado atual:** lista única em `/tarefas`, ordenada por status → prioridade → prazo, sem filtro de data.

**Escopo:** filtro por **dia / semana / mês / ano** no topo da lista. Client-side ou query param sobre `due_date`; default sugerido = semana atual. Sem mudança de schema.

---

## 3. Coach de IA (treino/dieta) — só troca de provedor

**Confirmado: o Coach fica exatamente como está hoje**, respondendo só sobre treino/dieta com dado real (`treino_series_registradas`, `dieta_metas`, etc). **Nenhuma mudança funcional.**

**Única mudança:** back-end passa de Claude (`lib/claude.ts`) pra **Gemini API**, com **thinking desativado** (`thinkingConfig.thinkingBudget: 0`). Sem novas ferramentas, sem mudança de UI, sem mudança no prompt/escopo de conhecimento (continua só treino/dieta).

---

## 3.1 Agente central — feature nova, separada do Coach

Isso **não é** uma expansão do `/coach` — é uma capacidade nova. Confirmado por Paulo: também em Gemini, thinking desativado.

**Objetivo:** um agente com contexto de **todo o sistema** (tarefas, reuniões, comercial, clientes — financeiro em leitura, ver decisão em aberto) e capacidade de **executar ações** via linguagem natural, não só responder.

**Onde vive:** no Hub `/hoje` — é a evolução natural da "captura rápida" já desenhada no `PLANO.md` (campo de texto livre que a IA classifica e roteia pro espaço/tabela certo), agora com mais alcance (leitura+escrita real via tools, não só classificação/roteamento) e suporte a anexar imagem/print (Gemini é nativamente multimodal, encaixa bem aqui).

### Tools propostas (function calling sobre tabelas já existentes)

| Ferramenta | Ação | Tabela |
|---|---|---|
| `get_tasks` / `create_task` / `update_task` | consultar/criar/editar tarefas | `tasks` |
| `get_meetings` / `create_meeting` | consultar/criar reuniões | `meetings` |
| `get_leads` / `create_lead` / `update_lead_stage` | consultar e mover pipeline comercial | `leads` |
| `create_proposal` | registrar proposta vinculada a um lead | `proposals` |
| `get_clients` / `get_projects` | consultar clientes e projetos | `clients`, `projects` |
| `get_finance_summary` / `create_finance_entry` / `update_finance_entry` | consultar e lançar movimentações | `finance_entries` |

**Confirmado: liberdade total.** O agente tem escrita liberada em todos os espaços, incluindo financeiro — sem restrição de só-leitura. Toda ação de escrita continua relatando o que fez na própria resposta (o Paulo vê o resultado, não é uma ação silenciosa), mas não há bloqueio prévio de confirmação.

Este agente é a peça que também **alimenta o fluxo comercial assistido** descrito na seção 5 — depende dele existir antes de fazer sentido revisar o Comercial.

**Confirmado: toda a IA da plataforma migra pra Gemini** (thinking desativado) — não é só Coach + Agente central. Isso inclui **prep de reunião, estruturar ata e briefing diário** (hoje em `lib/claude.ts`), que também passam a usar Gemini. `lib/claude.ts` é substituído/aposentado em favor de um `lib/gemini.ts` único usado por todas as rotas de IA do sistema.

---

## 4. Reuniões — migração total pra dentro do os-pessoal, aposentar o ReuniCheck

**Mudança de direção em relação à v1 deste doc:** não é mais "integrar com o ReuniCheck via webhook" — é **reconstruir o agendamento nativamente dentro do os-pessoal**, usando o ReuniCheck como referência de modelo, e depois **desativar o ReuniCheck** como produto separado.

**Modelo de dados do ReuniCheck (referência pra portar)**, levantado na investigação:
- `links` — `titulo, descricao, duracao, slots (jsonb), ativo`
- `agendamentos` — `link_id, nome_cliente, email_cliente, data, horario, agendado_em`
- `bloqueios` — `titulo, data, horario_inicio, horario_fim`

### Escopo proposto
- Novas tabelas no schema `os_pessoal` (ex: `booking_links`, `booking_slots`/`bloqueios`) espelhando esse modelo, mas gravando o agendamento **direto em `meetings`** (com `source: "os_pessoal"` já que não é mais externo) em vez de precisar de sincronização entre sistemas.
- Rota pública de agendamento sem login, no padrão já validado (`/c/[token]` do portal do cliente, `/b/[token]` do BrifingForm) — algo como `/agendar/[slug]`.
- Painel interno pra Paulo criar/editar links de agendamento e bloqueios de horário (equivalente ao admin do ReuniCheck hoje).
- Depois de validado em produção: desativar o projeto ReuniCheck (tirar do ar ou redirecionar pro novo endpoint dentro do os-pessoal).

**Confirmado: começa do zero.** Não migra o histórico de agendamentos do ReuniCheck — o banco antigo fica só arquivado/desligado, sem importação de dados.

---

## 5. Comercial — refatorar (detalhado)

Feedback específico do Paulo, agora concreto:

1. **Proposta não está vinculada visualmente ao lead.** O schema já tem `proposals.lead_id`, mas a UI mostra propostas como lista separada embaixo do kanban — não fica claro que aquela proposta pertence àquele lead. **Fix:** aninhar a proposta no card do lead (ou permitir expandir o card do lead pra ver a proposta ligada ali mesmo).

2. **Kanban ruim de usar** — "aquele cambão que tem que ficar rolando com o negocinho pra poder ver tudo": scroll horizontal incômodo, difícil editar/visualizar o board inteiro. **Fix:** revisar a UX do kanban buscando inspiração em ferramentas de CRM/comercial conhecidas (ex: padrões tipo Pipedrive, HubSpot, board estilo Linear) — considerar colunas mais compactas, drag-and-drop mais claro, ou um modo lista alternativo pros estágios.

3. **Fluxo assistido pelo Agente central (depende da seção 3.1):** no Hub `/hoje`, Paulo quer poder colar informação de um lead novo (texto e/ou print/screenshot) e o Agente: entende o contexto, sugere uma mensagem pronta pra iniciar conversa com o lead, e cria o registro de lead automaticamente já no estágio certo. Esse é o principal ganho de UX que ele descreveu — "chegou um lead, explico, ele já entende e me dá a mensagem pronta e cria o lead".

4. **Estágios confirmados, sem mudança no enum:** `novo → diagnóstico agendado → proposta enviada → fechado/perdido`.

**Dependência:** os itens 1 e 2 (proposta vinculada + kanban) podem avançar independente do Agente. O item 3 só faz sentido depois da seção 3.1 (Agente central) estar pronta.

---

## Logo oficial — resolvido

- **Logo oficial (fundo transparente):** `public/logo/devpaulo.png` — usar em qualquer contexto sobre fundo claro/variável (ex: header do portal do cliente).
- **Versão com fundo branco/sólido:** `public/logo/logo nova vf.png` — usar só onde precisar de um retângulo de fundo sólido.
- **Feito:** removidos de `MeusSites/devpaulo-main/public/logo/` os arquivos não usados (`logo.png`, `logo nova.png`, `logo nova vf sem fundo.png` — confirmei antes que nenhum era referenciado no código, só `logo/devpaulo.png` é usado em `components/Header.tsx`). Pasta ficou só com `devpaulo.png` e `logo nova vf.png`. Mudança está no working tree do repo `devpaulo-main` (git), ainda **não commitada** — revisar e commitar quando quiser.
- **Nota à parte (fora deste escopo):** `app/cases/*/page.tsx` do devpaulo-main referenciam `https://devpaulo.com.br/logo.png` em JSON-LD de SEO — esse arquivo não existe na raiz de `public/` (só existe dentro de `public/logo/`, e esse específico acabou de ser removido). É um link quebrado independente desta revisão; avisando, não mexi nisso.

---

## Ordem sugerida de execução (revisada)

1. **Clientes/Portal** — corrigir bug de marco + upload de foto, depois aplicar logo oficial. (urgente, confirmado por Paulo)
2. **Tarefas** — filtro por período (pequeno, sem dependência)
3. **Coach (treino/dieta)** — trocar pra Gemini thinking-off (isolado, baixo risco)
4. **Agente central** — Gemini thinking-off, tools de leitura/escrita, vive no Hub
5. **Comercial** — itens 1 e 2 (proposta vinculada + kanban) podem entrar em paralelo com o item 4; item 3 (fluxo assistido) só depois do Agente pronto
6. **Reuniões** — construir agendamento nativo + aposentar ReuniCheck (maior escopo isolado, pode rodar em paralelo às demais frentes)

---

## Decisões — todas fechadas

1. ~~Agente central: escrita em financeiro?~~ → **liberdade total**, escreve em tudo.
2. ~~Prep/ata/briefing seguem em Claude?~~ → **tudo migra pra Gemini**, `lib/claude.ts` aposentado.
3. ~~Migrar histórico do ReuniCheck?~~ → **começa do zero**.
4. ~~Logos não usados?~~ → **removidos** de `devpaulo-main/public/logo/` (feito, não commitado).

Escopo pronto pra virar plano de implementação. Único ponto que ainda depende do Paulo antes de eu começar a escrever código: detalhar, se quiser, algo mais específico sobre a UX do kanban comercial (seção 5, item 2) além de "buscar inspiração" — do contrário eu decido a direção na hora de implementar.
