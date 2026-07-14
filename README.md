# OS Pessoal — devpaulo

Painel único do Paulo: devpaulo.com.br (clientes, portal, comercial, financeiro),
iService (decisões, roadmap, caixa isolado) e Pessoal (treino, dieta, coach IA).

- **Produção:** https://os-pessoal.vercel.app (futuro: painel.devpaulo.com.br)
- **Stack:** Next.js 16 (Turbopack) · Tailwind 4 · Supabase (schema `os_pessoal`, RLS deny-by-default) · Claude API
- **Plano completo:** `../../PLANO.md` na raiz da pasta devpaulo.com.br

## Rodar local

```bash
npm install
npm run dev
```

## Variáveis de ambiente (`.env.local`)

| Variável | Obrigatória | Pra quê |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | chave anon (RLS protege tudo) |
| `ADMIN_LOGIN_EMAIL` | sim | email fixo do login (só pede senha) |
| `ANTHROPIC_API_KEY` | p/ IA | prep, ata, briefing narrado, coach, captura rápida — sem ela tudo degrada com aviso |
| `CLAUDE_MODEL` | não | default `claude-sonnet-5` |
| `SUPABASE_SERVICE_ROLE_KEY` | p/ cron | briefing/prep automáticos do cron diário |
| `CRON_SECRET` | p/ cron | a Vercel manda `Authorization: Bearer <CRON_SECRET>` |

## Regras de negócio que o código protege

1. **Portal do cliente (`/c/[token]`)**: só marcos **publicados** e assets ligados
   a marco publicado, via RPC `portal_do_cliente`. Prep/ata de reunião nunca
   aparecem pro cliente.
2. **Transferências devpaulo ↔ pessoal**: sempre em par atômico
   (`create_transfer`, mesmo `transfer_group_id`). Excluir uma perna remove o par.
3. **iService é isolado**: caixa próprio, nunca entra no consolidado,
   constraint impede transferência.
4. **Ficha de treino versionada**: editar cria item novo (`substituiu_item_id`)
   e desativa o antigo — histórico de progressão nunca se perde.

## Cron diário

`vercel.json` agenda `GET /api/cron/briefing` às 9h UTC (6h em São Paulo) —
plano Hobby permite 1 cron/dia, então o handler acumula: briefing do dia +
alertas por regra + prep automático das reuniões do dia.

## Próximos passos

Integrações planejadas (ReuniCheck → reuniões, n8n → WhatsApp) estão
documentadas em [`docs/PROXIMOS-PASSOS.md`](docs/PROXIMOS-PASSOS.md).
