# CLAUDE.md — Gestor Financeiro de Excursões

App financeiro para empresa de excursões. Substitui planilhas Excel. Uso solo (a tia), no celular. Web app instalável → APK via Capacitor (fase final). Roda no navegador também.

**Fonte da verdade do produto:** [RASCUNHO.md](RASCUNHO.md). Regras de negócio, modelo de dados e decisões travadas moram lá. Consulte antes de codar; atualize quando uma decisão mudar.

## Estado atual

- Fase: MVP em construção. Prontos: excursões, dashboard, passageiros/parcelas/pagamentos, despesas, passeios.
- Falta: ônibus/quartos (alocação), Capacitor/APK.
- ⚠️ **Auth DESABILITADO em dev.** RLS liberado p/ `anon`. REATIVAR antes de dado real. Ver §12 do RASCUNHO.

## Estrutura

- `web/` — código do app (Next.js). Todos os comandos rodam **de dentro de `web/`**.
- Raiz — planilhas (`.xlsx`) + `RASCUNHO.md` = docs. Não é código.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4.
- `output: export` — build **estático** (gera `web/out/`), Capacitor-ready. Sem SSR/rotas de servidor.
- shadcn/ui (base @base-ui) + lucide-react + sonner (toasts). Fonte IBM Plex Sans.
- Supabase (Postgres) — banco na nuvem. Cliente em [web/src/lib/supabase.ts](web/src/lib/supabase.ts).
- Projeto Supabase: `gestor-excursoes` (ref `mzdlcqmufybgddfafixn`, região sa-east-1).

## Comandos (em `web/`)

```
npm run dev      # dev server
npm run build    # build estático → out/
npm run lint     # eslint
```

## Convenções

- **Toda I/O de dados passa por [web/src/lib/data.ts](web/src/lib/data.ts).** Não chamar `supabase.from(...)` espalhado nas telas — adicionar função em `data.ts`.
- Tipos em [web/src/lib/types.ts](web/src/lib/types.ts). Formatação (moeda/data) em [web/src/lib/format.ts](web/src/lib/format.ts).
- **Campos calculados = views SQL, nunca colunas guardadas** (evita dessincronizar):
  - `v_passageiro_saldo` → valor_pago, saldo, status_pagamento.
  - `v_resumo_excursao` → total_a_receber, total_recebido, total_despesas. **Lucro = saldo_caixa = total_recebido − total_despesas** (nunca "a receber"; regra 2026-07-06).
- **`empresa_id` já entra nas tabelas-topo.** MVP roda com 1 empresa fixa (`getEmpresaId()` memoiza). Não remover — é o gancho p/ multi-empresa + RLS.
- Passageiro = junção `cliente × excursao`. Mesma pessoa = 1 `cliente`, N `passageiro`.
- **Passeio é neutro/pass-through** — entra+sai, NÃO conta no lucro.
- Dinheiro: valores em reais. Última parcela absorve diferença de centavos (ver `gerarParcelas` no RASCUNHO §6).
- **Juros: ADIADO.** MVP = valor ÷ nº parcelas. Campos `juros_tipo`/`juros_taxa` existem no schema (default 'nenhum'), desligados.
- Offline **não** é requisito do MVP. Online-first puro (Supabase direto).

## Regras de trabalho

- Nada de histórico se apaga — guardar tudo.
- Mudança de schema: `list_tables` antes; migrations via Supabase. Rodar `get_advisors` após (resolver ERROS de RLS/security).
- Não gerar recibo (fora de escopo).
- Fora do MVP (não implementar sem pedir): multi-usuário/permissões, check-in/embarque, WhatsApp/notificações, reembolso formal, relatórios avançados. Ver RASCUNHO §8.
