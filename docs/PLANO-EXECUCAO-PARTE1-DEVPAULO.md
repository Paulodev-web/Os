# Plano de Execução — Parte 1: devpaulo.com.br

> Recorte do plano completo (`C:\Users\conta\.claude\plans\siga-em-frente-e-purrfect-wombat.md`) só com o que pertence ao espaço **devpaulo.com.br**. Detalhe técnico completo (SQL, código de referência) está no plano mestre — este documento é o checklist de execução desta parte.

---

## O que entra nesta parte (e por quê)

As 6 frentes do plano mestre não são todas do espaço devpaulo.com.br — `tasks` e `meetings` são camadas **compartilhadas** entre os 3 espaços (devpaulo/iService/Pessoal), e o Coach/Agente são infraestrutura de IA cross-space. Minha leitura de "tudo do devpaulo.com.br":

| Frente | Entra na Parte 1? | Motivo |
|---|---|---|
| 1 — Clientes/Portal | **Sim** | Clientes, projetos e portal são 100% devpaulo.com.br |
| 4 — Comercial | **Sim** (itens 1, 2, 4) | Leads/propostas são 100% devpaulo.com.br |
| 4, item 3 — fluxo assistido pelo Agente | **Não** (adiado) | Depende da Frente 3.1 (Agente central), que é infra cross-space, fora desta parte |
| 5 — Reuniões nativas | **Sim** | O agendamento público (ex-ReuniCheck) é o funil comercial da devpaulo — leads/clientes marcando diagnóstico |
| 2 — Tarefas (filtro por período) | Não | `tasks` é camada compartilhada entre os 3 espaços, não é específico da devpaulo |
| 3 — Coach treino/dieta | Não | Espaço Pessoal |
| 3.1 — Agente central | Não | Infraestrutura cross-space (tarefas/reuniões/comercial/clientes/financeiro de todos os espaços) |

Se essa leitura não for o que você quis dizer com "tudo do devpaulo.com.br", me avisa antes de eu começar.

---

## Ordem de execução dentro da Parte 1

**1.** Clientes/Portal (bugs primeiro, depois visual) → **2.** Comercial (itens 1, 2, 4) → **3.** Reuniões nativas (maior escopo, deixado por último)

---

## Checklist

### Etapa 1 — Clientes/Portal

**1.1 Bug A — criar marco não funciona**
- [ ] Rodar SQL de inspeção de RLS em `project_milestones`/`project_assets` (comparar com `tasks`, que funciona)
- [ ] Aplicar policy de `INSERT`/`UPDATE`/`DELETE` para `authenticated` se estiver faltando
- [ ] `app/(painel)/projetos/actions.ts` — checar `{ error }` + `redirect(...?erro=...)` em `createMilestone`, `updateProjectStatus`, `setMilestonePublished`, `deleteMilestone`, `deleteAsset`
- [ ] `app/(painel)/projetos/[id]/page.tsx` — renderizar banner de erro (`searchParams.erro`, mesmo estilo de `reunioes/[id]/page.tsx`)
- [ ] Verificar: criar marco de teste, aparece na lista

**1.2 Bug B — upload de foto/arquivo não funciona**
- [ ] Provisionar bucket `portal-assets` (público) + policies de `insert`/`update`/`delete` para `authenticated`
- [ ] `addAsset` — erro de upload e erro de insert final passam a `redirect(...?erro=...)` em vez de só `console.error`
- [ ] Verificar: anexar imagem a um marco, abrir a URL pública em aba anônima (sem sessão) e confirmar que carrega

**1.3 Identidade visual do portal**
- [ ] `app/c/[token]/page.tsx` — header com logo 40×40 + wordmark "devpaulo" (mesmo tratamento de `Wordmark()` em `components/sidebar.tsx`)
- [ ] Polish leve na timeline de marcos (espaçamento/hierarquia com `Card`/`Badge` já existentes)
- [ ] Verificar visual mobile e desktop

### Etapa 2 — Comercial

**2.1 Proposta aninhada no lead**
- [ ] Extrair `LeadCard` + novo `ProposalRow` para `components/comercial/lead-card.tsx`
- [ ] Agrupar `proposals` por `lead_id` em `app/(painel)/comercial/page.tsx`
- [ ] Badge de valor total + status no card; lista completa de propostas dentro do `<details>` de edição já existente
- [ ] Mini-form de nova proposta com `lead_id` pré-preenchido (reusa `createProposal`)
- [ ] Verificar: criar lead → criar proposta vinculada → aparece dentro do card, não mais solta

**2.2 Kanban sem scroll horizontal**
- [ ] Trocar `overflow-x-auto` + `flex`/`w-60 shrink-0` por `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3`
- [ ] Testar em 1280px e 1440px
- [ ] Verificar: kanban nunca precisa de scroll horizontal em telas ≥1024px

**2.3 Fluxo assistido pelo Agente — ADIADO**
- Não implementar nesta parte. Fica pendente até a Frente 3.1 (Agente central) ser construída numa parte futura.

### Etapa 3 — Reuniões nativas (aposentar ReuniCheck)

**3.1 Schema**
- [ ] SQL: criar `os_pessoal.booking_links` e `os_pessoal.booking_blocks`
- [ ] SQL: `alter table meetings` — adicionar `booking_link_id`, `client_name`, `client_contact`, `duration_minutes`
- [ ] SQL: `unique index` anti double-booking em `(booking_link_id, scheduled_at)`
- [ ] SQL: RLS policies em `booking_links`/`booking_blocks` (só `authenticated`, nada pra `anon`)
- [ ] SQL: expandir `meetings.source` pra incluir `'os_pessoal'`
- [ ] Atualizar `lib/database.types.ts` (`BookingLink`, `BookingBlock`, `Meeting` estendido)
- [ ] RPCs `public_booking_link(p_slug)` e `criar_agendamento(...)` — incluindo checagem de conflito contra **qualquer** reunião existente (não só do mesmo link), conforme decisão de robustez do plano mestre

**3.2 Algoritmo de disponibilidade**
- [ ] `lib/booking-slots.ts` — porte de `ReuniCheck/lib/slots.ts` (nomenclatura PT→EN)

**3.3 Painel admin**
- [ ] `app/(painel)/reunioes/agendamento/page.tsx` + `[id]/page.tsx` — CRUD de links e bloqueios
- [ ] `components/agendar-admin/slot-builder.tsx` — porte restilizado do `SlotBuilder` do ReuniCheck
- [ ] `app/(painel)/reunioes/agendamento/actions.ts` — protegido por `requireUser()` via layout

**3.4 Página pública**
- [ ] `app/agendar/[slug]/page.tsx` + `slot-picker.tsx` + `confirmacao-form.tsx` + `actions.ts` + `confirmado/page.tsx` + `error.tsx`
- [ ] `proxy.ts` — liberar `/agendar` e `/agendar/*` como rota pública

**3.5 Validar e desligar ReuniCheck**
- [ ] Teste ponta a ponta: criar link → reservar em aba anônima → aparece em `/reunioes` com `source='os_pessoal'`
- [ ] Testar colisão de horário (duas abas simultâneas)
- [ ] Conferir `devpaulo-main` por CTAs apontando pro ReuniCheck antes de desligar
- [ ] Desligar/redirecionar o projeto ReuniCheck

---

## Fora da Parte 1 (fica para depois)

- Frente 2 — Tarefas (filtro por período)
- Frente 3 — Coach de treino/dieta (troca pra Gemini)
- Frente 3.1 — Agente central (e a migração de prep/ata/briefing pra Gemini, que está bundlada nela)
- Frente 4, item 3 — fluxo assistido de captura de lead (depende da 3.1)
