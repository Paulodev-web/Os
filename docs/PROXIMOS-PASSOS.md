# Próximos passos — integrações

Duas integrações ficaram fora do escopo das Fases 1–9 de propósito (dependem
de sistemas externos). Este doc registra o desenho pra quando forem entrar.

## 1. Webhook ReuniCheck → reuniões

**Objetivo:** reunião marcada no ReuniCheck aparece sozinha em `/reunioes`,
já vinculada ao lead/cliente, e entra no prep automático do cron.

**Desenho:**

- Criar `POST /api/webhooks/reunicheck` no os-pessoal:
  - Autenticação por header `x-webhook-secret` (env `REUNICHECK_WEBHOOK_SECRET`).
  - Payload mínimo: `{ titulo, inicio (ISO), nome_contato, email/telefone }`.
  - Handler usa o admin client (service_role) e insere em `meetings` com
    `source: "reunicheck"`, `type: "diagnostico"`, `status: "agendada"`.
  - Match de vínculo: procura lead por nome/contato; se achar, seta
    `related_entity_type: "lead"`. Se não, cria lead `stage: "novo"` e vincula.
- No ReuniCheck, disparar o webhook no evento de agendamento confirmado.
- A coluna `meetings.source` já aceita `reunicheck` — nenhum ajuste de schema.

**Cuidados:** dedupe por (titulo + inicio) pra reagendamento não duplicar;
responder 200 rápido e processar o resto de forma idempotente.

## 2. n8n → WhatsApp (briefing e alertas)

**Objetivo:** o briefing das 6h e alertas críticos chegam no WhatsApp do
Paulo, sem abrir o painel.

**Desenho:**

- O cron `/api/cron/briefing` já devolve JSON com o resultado. Duas opções:
  1. **n8n puxa (recomendado):** workflow n8n com Schedule Trigger ~6h15,
     chama `GET /api/cron/briefing` **não** (já rodou) — em vez disso, criar
     `GET /api/briefing/hoje` (auth por `x-api-key` = env `N8N_API_KEY`) que
     devolve `{ narrative, summary, alerts_abertos }` do dia; n8n formata e
     manda via WhatsApp (Evolution API / Cloud API).
  2. **Painel empurra:** ao final do cron, POST pro webhook do n8n
     (`N8N_WEBHOOK_URL`) com o mesmo payload. Menos peças, mas acopla o cron
     ao n8n estar de pé.
- Alertas `critico` podem disparar um segundo fluxo n8n (filtro no workflow).

**Pré-requisitos:** instância n8n com acesso ao WhatsApp (Evolution API já
usada na operação) e as envs `N8N_API_KEY`/`N8N_WEBHOOK_URL` na Vercel.

## Pendências de ambiente (Fase 0)

- Rotacionar `SUPABASE_SERVICE_ROLE_KEY` no painel do Supabase (a antiga
  vazou em README do devpaulo-main e segue ativa).
- Depois da rotação: atualizar `.env.local` dos dois repos + envs na Vercel
  (projetos devpaulo-main e os-pessoal) e conferir que a chave antiga volta 401.
- Adicionar `ANTHROPIC_API_KEY` na Vercel pra ligar as features de IA.
