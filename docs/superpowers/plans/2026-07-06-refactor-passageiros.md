# Refatoração da Tela de Passageiros — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a tela atual de passageiros (`/excursao`) por um módulo completo de gestão de passageiros + pagamentos + parcelas que elimina a planilha Excel.

**Architecture:** Lista-tabela com multi-seleção e ações em massa (`/passageiros`) + página de detalhe por passageiro (`/passageiro?id=`). Todo estado financeiro é **derivado por views SQL** (nunca armazenado): editar/excluir um pagamento recalcula tudo sozinho, sem dessincronizar. Lógica pura de dinheiro (parcelas, abate) isolada em `lib/parcelas.ts` com teste.

**Tech Stack:** Next.js 16 (App Router, `output: export`), React 19, TS, Tailwind v4, Supabase, shadcn/ui, sonner, lucide-react. Vitest (novo devDep, só p/ lógica de dinheiro).

## Global Constraints

- Build **estático** (`output: export`): sem SSR, rotas com query param (`?id=`), nunca segmento dinâmico.
- Toda I/O do módulo em `web/src/lib/passageiros.ts` (precedente: `despesas.ts`). Nada de `supabase.from()` na tela.
- Campos calculados = **views SQL** com `security_invoker = on`. Nunca coluna armazenada.
- Juros: **fora do escopo** (decisão 2026-07-06). Campos `juros_tipo`/`juros_taxa` ficam no schema, UI não expõe.
- Design system atual (globals.css): fundo preto + `glass-card`/`surface`/`glass-float`, `.money` p/ valores, radius via tokens, cores só `--foreground`/`--muted-foreground`/`--faint` + semânticas (`--success` verde, `--destructive` vermelho, `--warning` âmbar). **Nenhuma cor nova.**
- Mobile-first (uso: celular da tia), alvo de toque ≥ 44px, input ≥ 16px, `pb-nav` + safe-area.
- Comandos rodam de dentro de `web/`.
- Migrations via Supabase MCP; rodar `get_advisors` após qualquer mudança SQL.

---

## PARTE A — Análise e diagnóstico

### A1. Estado atual da tela (`web/src/app/excursao/page.tsx`, 350 linhas)

O que existe:
- Header com nome da excursão + resumo 3 números (Recebido / A receber / Lucro).
- Lista de cards: avatar + nome + badge status + "Falta X de Y" + botão Pagar.
- Dialog "Novo passageiro" (nome + valor total obrigatórios juntos).
- Dialog "Registrar pagamento" (só um campo de valor; insere `pagamento` avulso).
- Busca por nome (só aparece com > 3 passageiros).
- Status vindo de `v_passageiro_saldo` (quitado / atrasado / em_dia) — mas **atrasado nunca acontece**, porque nenhuma parcela com vencimento é criada.

O que NÃO existe (e o schema já suporta — tabelas `parcela` e `pagamento` prontas desde a migration inicial):
- Parcelamento: tabela `parcela` tem 2 linhas de teste e a UI nunca grava nela.
- Vencimentos → inadimplência real é impossível.
- Histórico de pagamentos: pagamentos são gravados mas nunca exibidos.
- Editar/excluir pagamento, editar valor total, excluir passageiro.
- Filtros por status, ordenação, seleção em massa.
- `pagamento.data`, `forma`, `obs` nunca preenchidos além do default.

### A2. Problemas encontrados

**Arquitetura**
1. A página mistura dois domínios: dashboard da excursão + gestão de passageiros. A home (`/`) já tem dashboard; o resumo daqui duplica.
2. I/O de passageiros espalhada em `data.ts` junto com excursão — o módulo despesas já estabeleceu o padrão de arquivo próprio (`despesas.ts`).
3. `parcela.status` é coluna armazenada com CHECK (`pendente|paga|atrasada`) — viola a convenção do projeto (calculado = view). "Atrasada" armazenada é um bug em potência: o tempo passa, a coluna não.
4. `addPassageiro` cria um `cliente` novo a cada inscrição — homônimos duplicam; aceitável no MVP, mas a função nunca reusa cliente (registrado como dívida, fora deste escopo).

**UX / Fluxo**
5. Cadastro exige valor junto com nome — na prática a tia lista as pessoas primeiro e fecha valores depois (a planilha mostra isso: 47 vagas "1450" numeradas sem nome).
6. Pagamento não tem data visível nem histórico — impossível responder "quando a Maria pagou?".
7. Erro de digitação num pagamento é irrecuperável pela UI.
8. Sem visão "quem devo cobrar" — o motivo nº 1 do app existir.
9. Botão "Pagar" pré-preenche o saldo TOTAL — o caso comum é receber uma parcela, não o total.

**UI / Informação**
10. Card mostra só "Falta X de Y" — a planilha da tia pensa em colunas (Nº, Nome, Valor, Pago, Status). A aba "Balanço Geral" tem literalmente os headers `Nº · Nome · Valor Esperado · Status`.
11. Lucro no header desta tela é métrica de excursão, não de passageiros — ruído.
12. Busca escondida atrás de regra `length > 3`.

### A3. Comparação: planilha real × app atual

Extraído de `planilha organizada.xlsx` (aba 2027 + aba Balanço Geral):

| Conceito na planilha | Como funciona lá | App atual | Veredito |
|---|---|---|---|
| Nº da vaga (col A, 1–64) | Identidade principal; nomes só p/ 17 da família | Não existe | **FALTA** — manter nº de ordem na tabela |
| Valor da vaga (1450 / 650 / 60 / 0) | Digitado linha a linha, repetitivo | Digitado 1 a 1 no cadastro | **MELHORAR** — aplicar valor em massa |
| Coluna "Pago" | Existe mas está 100% vazia (Recebido = 0) | Grava pagamento mas não mostra histórico | **CORRIGIR** — registrar E exibir |
| Status "Pago" (SUMIF no Balanço) | Manual, binário | Derivado (view), 3 estados | App já é melhor; falta o estado "atrasado" funcionar |
| Total a receber (SUM = 74.710) | Fórmula | `v_resumo_excursao` | OK |
| Saldo final | −63.240 (irreal, receita não lançada) | Real se pagamentos forem lançados | OK — a UI nova precisa tornar o lançamento trivial |
| Parcelas / vencimentos | **Não existem** (a dor) | Não existem na UI | **CRIAR** — é o ganho central sobre a planilha |
| "Quanto falta por pessoa" | Não existe (dor principal, RASCUNHO §4) | Existe (saldo) | OK — manter em coluna |

### A4. Decisões travadas na sessão de requisitos (2026-07-05/06)

1. Cadastro **só com nome**; valor/parcelas entram depois.
2. **Multi-seleção** na lista → ações em massa: *definir valor* e *parcelar* (mesmo modal do individual: nº de parcelas + data do 1º vencimento).
3. **Sem juros** (descartado 2026-07-06).
4. Tabela estilo planilha: `Nº · Nome · Total · Pago · Falta · Status` (revisitar formato depois).
5. Baixa de pagamento: valor livre → **abate automático da parcela mais antiga em aberto** (parcial permitido); marcar parcela específica no detalhe; **atalho na linha** que quita a próxima parcela.
6. **Editar/excluir pagamento de vez** (hard delete — regra "nada se apaga" descartada pelo usuário).
7. Desconto/acréscimo = **editar o valor total direto**.
8. Detalhe do passageiro = **página própria**.
9. Filtros: busca + chips de status + ordenar (nome / maior dívida / vence antes).
10. Indicadores no topo: Recebido · A receber · Falta.

---

## PARTE B — Proposta

### B1. Modelo de funcionamento (o coração do plano)

**Tudo derivado, nada armazenado.** `pagamento` é a única fonte de verdade de dinheiro recebido; `parcela` guarda apenas o plano (número, valor, vencimento). Status de parcela e de passageiro saem de views:

- Parcela *paga* = soma dos pagamentos vinculados (`pagamento.parcela_id`) ≥ valor.
- Parcela *atrasada* = não paga e `vencimento < hoje`.
- Passageiro *quitado* = saldo ≤ 0; *atrasado* = tem parcela atrasada; senão *em dia*.

Por que: o usuário pediu editar/excluir pagamento livremente. Com estado derivado, deletar um pagamento **reverte automaticamente** a parcela para aberta e o passageiro para devedor — zero código de "desfazer", zero dessincronização. Com `parcela.status` armazenado (como está hoje), cada edição exigiria recalcular e regravar — a coluna passa a ser ignorada (mantida no schema, custo zero, remoção futura).

**Abate automático ("waterfall"):** pagamento de valor livre é fatiado em N linhas de `pagamento`, uma por parcela alcançada, cada uma com seu `parcela_id`. Ex.: R$ 600 com parcelas de R$ 290 → 3 inserts (290 + 290 + 20). Inserção em array = 1 statement = atômico. Excedente além de todas as parcelas (ou passageiro sem parcelas) vira pagamento com `parcela_id = null` (avulso — continua contando no saldo, como hoje).

**Mudar valor total com parcelas existentes:** redistribui o novo saldo (`novo_total − já_pago`) igualmente entre as parcelas **não quitadas** (mantém datas e números; última absorve centavos). Parcelas quitadas nunca são tocadas (têm pagamentos vinculados). Sem parcela aberta e saldo > 0 → saldo fica visível como "sem parcelamento" e a tia reparcela se quiser.

**Parcelar em massa sobre quem já tem parcelas:** substitui o plano de quem **não tem pagamento vinculado a parcela**; quem tem, é pulado com aviso no toast ("2 passageiros pulados — já têm parcelas pagas"). Evita corromper histórico.

### B2. Nova estrutura de tela

**`/passageiros?id=<excursao>`** (substitui `/excursao`):

```
┌─ Header ─────────────────────────────┐
│ ← Passageiros · Arraial 2027    (52) │
├─ Resumo (glass-card, 3 colunas) ─────┤
│ Recebido      A receber      Falta   │  ← v_resumo_excursao
│ R$ 12.400     R$ 74.710   R$ 62.310  │    (verde)         (vermelho se >0)
├─ Toolbar ────────────────────────────┤
│ 🔍 busca   [Todos|Atrasados|Em dia|  │  ← chips status
│             Quitados]  ⇅ordem  ☑sel  │  ← ordenar + toggle seleção
├─ Tabela (glass-card, overflow-x) ────┤
│ ☐ Nº Nome        Total  Pago  Falta  │  ← header sticky, nome sticky-left
│ ☐ 1  Carol       1450    870    580🔴│  ← linha toca → /passageiro?id=
│ ☐ 2  Pedro       1450   1450      0🟢│  ← status = cor+badge na col. Falta
│ ☐ 3  (vaga 3)    1450      0   1450⚪│  ← ação rápida: [⚡ pagar parcela]
├─ [Barra de seleção — aparece c/ ≥1] ─┤
│ 3 selecionados   [R$ Valor] [≡ Parc.]│  ← glass-float, acima da bottom-nav
└──────────────────────────────────────┘
                                  (FAB +) ← novo passageiro (só nome)
```

Estados: skeleton (linhas fantasma) · vazio ("Nenhum passageiro — Adicionar") · erro (toast) · seleção ativa (barra sobe, FAB some).

**`/passageiro?id=<passageiro>`** (nova):

```
┌ ← Carol · Arraial 2027            ⋮ ┐  ← menu: excluir passageiro
├ Hero (glass-card) ───────────────────┤
│ Falta R$ 580          de R$ 1.450 ✏️ │  ← valor total editável inline
│ ▓▓▓▓▓▓░░░░ 60% pago                  │
├ Parcelas (se houver) ────────────────┤
│ 1  R$290  10/03  ✅ paga             │
│ 2  R$290  10/04  🔴 atrasada [pagar] │  ← pagar = quita esta parcela
│ 3  R$290  10/05  ⚪ aberta   [pagar] │
│           [≡ Parcelar / Reparcelar]  │  ← abre ParcelamentoDialog
├ Histórico de pagamentos ─────────────┤
│ 12/03  R$ 290  Pix     ✏️ 🗑         │  ← editar / excluir de vez
│ 15/02  R$ 580          ✏️ 🗑         │
│        [+ Registrar pagamento]       │  ← valor livre → abate na ordem
└──────────────────────────────────────┘
```

**Modais (Dialog `variant="sheet"`, padrão do app):**
- *Novo passageiro*: 1 campo (nome) + "salvar e adicionar outro" (cadastro em série, como preencher a coluna da planilha).
- *Definir valor* (massa ou 1): 1 campo R$.
- *ParcelamentoDialog* (massa e individual — mesmo componente): nº de parcelas + data do 1º vencimento + preview das parcelas geradas antes de confirmar.
- *Registrar pagamento*: valor (pré-preenchido com o valor da **próxima parcela aberta**, não o saldo total) + data (default hoje) + forma (opcional) + preview "vai quitar parcela 2 e abater R$ 20 da 3".
- *Confirmações destrutivas* (excluir pagamento/passageiro): Dialog central curto.

### B3. Mudanças × justificativa × elo com a planilha

| # | Mudança | Justificativa técnica | Elo com a planilha |
|---|---|---|---|
| 1 | Rota nova `/passageiros` + apagar `/excursao` | Separa domínio (home = dashboard); rota nomeada pelo que é | A tela vira "a planilha", um lugar só |
| 2 | Tabela colunar com Nº | Densidade de informação; scan vertical de valores (`.money` alinha) | Réplica dos headers da aba Balanço Geral (`Nº·Nome·Valor·Status`) |
| 3 | Cadastro só nome + "adicionar outro" | Menos fricção; valor vem depois em massa | Fluxo real: numerar vagas primeiro, fechar valores depois |
| 4 | Seleção em massa (valor/parcelar) | 1 ação p/ N linhas; elimina digitação repetida | Os 47×"1450" digitados um a um somem |
| 5 | Parcelas com vencimento + views derivadas | Status por data calculado no banco; nunca dessincroniza | Não existe na planilha — é o ganho novo |
| 6 | Waterfall de pagamento | Tia só informa "recebi X"; sistema aloca; atômico (insert array) | Substitui a coluna "Pago" manual que nunca foi preenchida |
| 7 | Histórico com editar/excluir hard | Estado derivado torna delete seguro (recalcula sozinho) | Auditável: "quando pagou?" respondível |
| 8 | Chips Atrasados + ordenar por vencimento | Responde "quem cobrar hoje" em 1 toque | Inexistente na planilha; dor nº 1 do RASCUNHO §4 |
| 9 | Lógica de dinheiro em `lib/parcelas.ts` puro + teste | Centavos e alocação são money-path; teste barato evita regressão | Fórmulas da planilha viram funções testadas |

### B4. Componentes

**Criar**
- `web/src/app/passageiros/page.tsx` — lista/tabela/seleção/modais de massa (single-file, precedente `despesas/page.tsx`).
- `web/src/app/passageiro/page.tsx` — detalhe.
- `web/src/lib/passageiros.ts` — toda a I/O do módulo (tipos incluídos, precedente `despesas.ts`).
- `web/src/lib/parcelas.ts` — funções puras: `gerarParcelas`, `alocarPagamento`, `redistribuirParcelas`.
- `web/src/lib/parcelas.test.ts` — vitest, só money-path.
- `web/src/components/parcelamento-dialog.tsx` — único componente compartilhado (usado pela lista em massa e pelo detalhe).

**Alterar**
- `web/src/components/bottom-nav.tsx` — item Passageiros → `/passageiros`.
- `web/src/app/page.tsx` — 2 links `router.push('/excursao?...')` → `/passageiros?...` (linhas 215 e 304).
- `web/src/lib/data.ts` — remover `listPassageiros`, `addPassageiro`, `registrarPagamento` (migram p/ `passageiros.ts`).
- `web/src/lib/types.ts` — remover `PassageiroRow`/`StatusPagamento` (vão junto).

**Remover**
- `web/src/app/excursao/page.tsx` — por último, após rewire (menor risco).

**Reusar sem tocar:** `Fab`, `Button`, `Input`, `Label`, `Badge`, `SelectField`, `Dialog`, `.glass-card`/`.glass-float`/`.surface`, `.money`, `brl()`, `haptic()`, skeletons/empty-state patterns das despesas.

### B5. Banco (migration única, sem mudar tabelas)

```sql
-- v_parcela_saldo: estado derivado por parcela
create or replace view v_parcela_saldo with (security_invoker = on) as
select
  pc.id as parcela_id, pc.passageiro_id, pc.numero, pc.valor, pc.vencimento,
  coalesce(sum(pg.valor), 0) as valor_pago,
  pc.valor - coalesce(sum(pg.valor), 0) as saldo,
  case
    when coalesce(sum(pg.valor), 0) >= pc.valor then 'paga'
    when pc.vencimento is not null and pc.vencimento < current_date then 'atrasada'
    else 'pendente'
  end as status
from parcela pc
left join pagamento pg on pg.parcela_id = pc.id
group by pc.id;

-- v_passageiro_saldo: recriar com atrasado real + proximo_vencimento
-- (DROP + CREATE porque adiciona coluna; conferir definição atual via pg_views antes)
drop view if exists v_passageiro_saldo;
create view v_passageiro_saldo with (security_invoker = on) as
select
  pa.id as passageiro_id, pa.excursao_id, pa.valor_total,
  coalesce(t.pago, 0) as valor_pago,
  pa.valor_total - coalesce(t.pago, 0) as saldo,
  case
    when pa.valor_total - coalesce(t.pago, 0) <= 0 then 'quitado'
    when exists (select 1 from v_parcela_saldo v
                 where v.passageiro_id = pa.id and v.status = 'atrasada') then 'atrasado'
    else 'em_dia'
  end as status_pagamento,
  (select min(v.vencimento) from v_parcela_saldo v
   where v.passageiro_id = pa.id and v.status <> 'paga') as proximo_vencimento
from passageiro pa
left join (select passageiro_id, sum(valor) as pago from pagamento group by passageiro_id) t
  on t.passageiro_id = pa.id;
```

Depois: `get_advisors` (security) — views novas devem manter `security_invoker`.
Limpeza dev: apagar as 2 parcelas de teste órfãs (`delete from parcela` onde não há plano real) — dado de dev, sem valor.

### B6. Contratos da lib (o que as telas consomem)

```ts
// lib/parcelas.ts — puras, testadas
export interface ParcelaGerada { numero: number; valor: number; vencimento: string }
export function gerarParcelas(total: number, n: number, primeiroVenc: string): ParcelaGerada[]
// mensal; clamp de fim de mês (31/01 → 28/02, não 03/03); última absorve centavos

export interface ParcelaAberta { id: string; numero: number; saldo: number }
export function alocarPagamento(valor: number, abertas: ParcelaAberta[]):
  { parcela_id: string | null; valor: number }[]
// waterfall por numero asc; excedente → parcela_id null

export function redistribuirParcelas(novoSaldo: number, abertas: ParcelaAberta[]):
  { id: string; valor: number }[]  // valor = pago_na_parcela + cota; última absorve centavos

// lib/passageiros.ts — I/O
export type StatusPagamento = "quitado" | "atrasado" | "em_dia";
export interface PassageiroRow {
  id: string; nome: string; valor_total: number; valor_pago: number;
  saldo: number; status_pagamento: StatusPagamento;
  proximo_vencimento: string | null; // p/ ordenar "vence antes" e mostrar na linha
}
export interface ParcelaRow {
  id: string; numero: number; valor: number; vencimento: string | null;
  valor_pago: number; saldo: number; status: "paga" | "atrasada" | "pendente";
}
export interface PagamentoRow {
  id: string; valor: number; data: string; forma: string | null;
  parcela_numero: number | null;
}
export function listPassageiros(excursaoId: string): Promise<PassageiroRow[]>
export function addPassageiro(excursaoId: string, nome: string): Promise<void> // valor_total = 0
export function getPassageiroDetalhe(id: string): Promise<{
  passageiro: PassageiroRow & { excursao_nome: string; obs: string | null };
  parcelas: ParcelaRow[]; pagamentos: PagamentoRow[];
}>
export function updateValorTotal(id: string, valor: number): Promise<void> // + redistribui abertas
export function bulkSetValor(ids: string[], valor: number): Promise<void>
export function parcelar(ids: string[], n: number, primeiroVenc: string):
  Promise<{ ok: number; pulados: string[] }> // pula quem tem pagamento vinculado a parcela
export function registrarPagamento(passageiroId: string, valor: number, data: string,
  forma?: string, parcelaId?: string): Promise<void> // sem parcelaId → waterfall
export function pagarProximaParcela(passageiroId: string): Promise<{ numero: number; valor: number }>
export function updatePagamento(id: string, valor: number, data: string, forma?: string): Promise<void>
export function deletePagamento(id: string): Promise<void>
export function deletePassageiro(id: string): Promise<void> // deleta pagamentos → parcelas → passageiro → confirmação na UI
```

### B7. Impactos em outras partes

| Área | Impacto | Mitigação |
|---|---|---|
| Home (`page.tsx`) | 2 links apontam p/ `/excursao` | Task de rewire troca p/ `/passageiros` |
| Bottom-nav | href + pathname ativo | Mesma task |
| `v_passageiro_saldo` | Recriada (DROP+CREATE) | Único consumidor é `listPassageiros` (grep confirmado); coluna nova é aditiva |
| `v_resumo_excursao` | Intocada | — |
| Despesas / donut / charts | Zero (não tocam passageiro) | — |
| Dados existentes (13 passageiros, 10 pagamentos avulsos) | Pagamentos com `parcela_id null` seguem contando no saldo | Nenhuma migração de dado necessária |
| localStorage `excursao_selecionada` | Reusado como está | — |
| Vercel build | `output: export` intacto (páginas client + Suspense, padrão atual) | `npm run build` em cada fase |

### B8. Fora do escopo desta refatoração (registrado, não implementar)

Juros · telefone/contato · botão de cobrança WhatsApp · classes de valor com preenchimento por classe · reuso de cliente entre excursões (homônimos) · notificações · exportar.

---

## PARTE C — Ordem de implementação (tasks)

> Estratégia anti-regressão: construir o novo **ao lado** do velho; rewire e deleção só no fim. Cada task termina com build verde + commit.

### Task 1: Lógica pura de dinheiro + testes

**Files:**
- Create: `web/src/lib/parcelas.ts`
- Create: `web/src/lib/parcelas.test.ts`
- Modify: `web/package.json` (devDep `vitest`, script `"test": "vitest run"`)

**Interfaces:** Produces `gerarParcelas`, `alocarPagamento`, `redistribuirParcelas` (assinaturas em B6).

- [ ] **Step 1: instalar vitest** — `npm i -D vitest` (em `web/`).
- [ ] **Step 2: escrever testes que falham** (`parcelas.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { gerarParcelas, alocarPagamento, redistribuirParcelas } from "./parcelas";

describe("gerarParcelas", () => {
  it("divide igual e última absorve centavos", () => {
    const p = gerarParcelas(1000, 3, "2026-08-10");
    expect(p.map((x) => x.valor)).toEqual([333.33, 333.33, 333.34]);
    expect(p.map((x) => x.vencimento)).toEqual(["2026-08-10", "2026-09-10", "2026-10-10"]);
  });
  it("clampa fim de mês (31/01 → 28/02, não 03/03)", () => {
    const p = gerarParcelas(300, 3, "2026-01-31");
    expect(p.map((x) => x.vencimento)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
});

describe("alocarPagamento", () => {
  const abertas = [
    { id: "a", numero: 1, saldo: 290 },
    { id: "b", numero: 2, saldo: 290 },
    { id: "c", numero: 3, saldo: 290 },
  ];
  it("waterfall: quita antigas, parcial na seguinte", () => {
    expect(alocarPagamento(600, abertas)).toEqual([
      { parcela_id: "a", valor: 290 },
      { parcela_id: "b", valor: 290 },
      { parcela_id: "c", valor: 20 },
    ]);
  });
  it("excedente vira avulso", () => {
    expect(alocarPagamento(900, abertas).at(-1)).toEqual({ parcela_id: null, valor: 30 });
  });
  it("sem parcelas → tudo avulso", () => {
    expect(alocarPagamento(100, [])).toEqual([{ parcela_id: null, valor: 100 }]);
  });
});

describe("redistribuirParcelas", () => {
  it("espalha novo saldo nas abertas, última absorve", () => {
    const abertas = [
      { id: "b", numero: 2, saldo: 290 },
      { id: "c", numero: 3, saldo: 290 },
    ];
    // pagou 290 da parcela 1 (quitada, não entra); novo total 1000 → novo saldo 710
    expect(redistribuirParcelas(710, abertas)).toEqual([
      { id: "b", valor: 355 },
      { id: "c", valor: 355 },
    ]);
  });
});
```

- [ ] **Step 3: rodar e ver falhar** — `npx vitest run` → FAIL (módulo não existe).
- [ ] **Step 4: implementar `parcelas.ts`:**

```ts
// Lógica pura de parcelas/pagamentos. Sem I/O — testável e reusável.
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ParcelaGerada { numero: number; valor: number; vencimento: string }

export function gerarParcelas(total: number, n: number, primeiroVenc: string): ParcelaGerada[] {
  const [y, m, d] = primeiroVenc.split("-").map(Number);
  const base = Math.floor((total / n) * 100) / 100;
  const out: ParcelaGerada[] = [];
  for (let i = 0; i < n; i++) {
    const ultimoDia = new Date(y, m - 1 + i + 1, 0).getDate(); // último dia do mês alvo
    const dia = Math.min(d, ultimoDia); // clamp: 31 → 28/29/30
    const data = new Date(y, m - 1 + i, dia);
    const iso = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
    out.push({ numero: i + 1, valor: base, vencimento: iso });
  }
  out[n - 1].valor = round2(total - base * (n - 1)); // última absorve centavos
  return out;
}

export interface ParcelaAberta { id: string; numero: number; saldo: number }

export function alocarPagamento(
  valor: number,
  abertas: ParcelaAberta[],
): { parcela_id: string | null; valor: number }[] {
  const out: { parcela_id: string | null; valor: number }[] = [];
  let resto = round2(valor);
  for (const p of [...abertas].sort((a, b) => a.numero - b.numero)) {
    if (resto <= 0) break;
    if (p.saldo <= 0) continue;
    const usa = Math.min(resto, round2(p.saldo));
    out.push({ parcela_id: p.id, valor: usa });
    resto = round2(resto - usa);
  }
  if (resto > 0) out.push({ parcela_id: null, valor: resto }); // avulso
  return out;
}

export function redistribuirParcelas(
  novoSaldo: number,
  abertas: ParcelaAberta[],
): { id: string; valor: number }[] {
  if (abertas.length === 0) return [];
  const ord = [...abertas].sort((a, b) => a.numero - b.numero);
  const cota = Math.floor((novoSaldo / ord.length) * 100) / 100;
  const out = ord.map((p) => ({ id: p.id, valor: cota }));
  out[out.length - 1].valor = round2(novoSaldo - cota * (ord.length - 1));
  return out;
}
```

> Nota: `redistribuirParcelas` assume parcela aberta sem pagamento parcial próprio (parcial vinculado conta no saldo do passageiro, não trava a redistribuição — a view recalcula). Se a parcela tem pagamento parcial, o novo `valor` da parcela permanece ≥ pago vinculado por construção do fluxo (redistribui-se só o saldo restante). Teste cobre o caso base; edge de parcial+redistribuição documentado como limitação aceita.

- [ ] **Step 5: rodar e ver passar** — `npx vitest run` → PASS.
- [ ] **Step 6: commit** — `git add -A && git commit -m "feat(passageiros): lógica pura de parcelas com testes"`.

### Task 2: Migration das views

**Files:** nenhum no repo (migration via Supabase MCP `apply_migration`, nome `passageiros_views_parcelas`).

- [ ] **Step 1:** buscar definição atual: `select definition from pg_views where viewname = 'v_passageiro_saldo'` (garantir que não há coluna que alguém consome fora do listado em B6).
- [ ] **Step 2:** aplicar migration com o SQL de B5 (v_parcela_saldo + DROP/CREATE v_passageiro_saldo).
- [ ] **Step 3:** limpar parcelas de teste: `delete from pagamento where parcela_id is not null; delete from parcela;` (dado dev; 2 linhas órfãs).
- [ ] **Step 4:** `get_advisors` (security) → resolver ERROS se surgirem (views devem estar `security_invoker=on`).
- [ ] **Step 5:** smoke: `select * from v_passageiro_saldo limit 3; select * from v_parcela_saldo limit 3;` → colunas esperadas.

### Task 3: Camada de dados `passageiros.ts`

**Files:**
- Create: `web/src/lib/passageiros.ts` (implementa TODAS as assinaturas de B6; consome `getEmpresaId` de `data.ts` e `alocarPagamento`/`gerarParcelas`/`redistribuirParcelas` da Task 1)

**Interfaces:** Consumes Task 1 + views Task 2. Produces contratos B6 (as duas páginas dependem).

Pontos de implementação obrigatórios:
- [ ] `listPassageiros`: join `passageiro` × `v_passageiro_saldo` (padrão atual em `data.ts:117-149`), + `proximo_vencimento`; ordenar por `created_at` (vira o Nº da vaga na UI).
- [ ] `registrarPagamento` sem `parcelaId`: lê `v_parcela_saldo` abertas → `alocarPagamento` → **um** `insert` de array em `pagamento` (atômico).
- [ ] `pagarProximaParcela`: menor `numero` com `status <> 'paga'`; insert único com `parcela_id`; retorna `{numero, valor}` p/ o toast ("Parcela 2 · R$ 290 paga").
- [ ] `parcelar`: p/ cada id → se existe `pagamento` com `parcela_id` em parcelas do passageiro → pula; senão `delete parcela where passageiro_id` + insert das geradas (gerar de `valor_total`; se `valor_total = 0` → pula com aviso).
- [ ] `updateValorTotal`: update + `redistribuirParcelas(novoTotal − pago, abertas)` → updates de `parcela.valor`.
- [ ] `deletePassageiro`: delete `pagamento` → `parcela` → `passageiro` (nesta ordem, FKs sem cascade).
- [ ] Build: `npm run build` → verde. Commit: `feat(passageiros): camada de dados do módulo`.

### Task 4: Página `/passageiros` (lista)

**Files:**
- Create: `web/src/app/passageiros/page.tsx`
- Create: `web/src/components/parcelamento-dialog.tsx`

Conteúdo (padrões copiados de `despesas/page.tsx` — Suspense + useSearchParams, load com Promise.all, toasts, skeleton):
- [ ] Header + resumo 3 números (`getResumo` de `data.ts`): Recebido (`--success`), A receber (neutro), Falta = `total_a_receber − total_recebido` (`--destructive` se > 0). `.money` em tudo.
- [ ] Toolbar: Input busca (sempre visível) · chips status (padrão chip das despesas: `--r-sm`, ativo `bg-accent-bg`-like) · SelectField ordem (Nº · Nome A-Z · Maior dívida · Vence antes) · botão "Selecionar" (toggle modo seleção).
- [ ] Tabela: `glass-card` com `overflow-x-auto`; grid `min-w-[560px]`; header 12px `--faint` sticky-top; coluna Nome `sticky left` (fundo herdado); linhas h-12+, `.money` nas colunas numéricas; status = badge na célula Falta (verde quitado / vermelho atrasado / neutro em dia) + `proximo_vencimento` em 11px `--faint` sob o valor quando houver.
- [ ] Linha: toque → `router.push('/passageiro?id=')`; botão ⚡ (ghost, 44px) → `pagarProximaParcela` + toast; desabilitado se quitado/sem parcela aberta.
- [ ] Modo seleção: checkboxes (área de toque 44px) + selecionar-todos no header; barra `glass-float` fixa acima da nav: "N selecionados · [Definir valor] [Parcelar]"; FAB esconde durante seleção.
- [ ] Modais: novo passageiro (nome + botão "Adicionar e continuar") · definir valor (1 input) · `ParcelamentoDialog` (nº parcelas + data 1º venc + preview `gerarParcelas` de cada selecionado — mostra "3 passageiros × 5 parcelas"; avisa pulados no retorno).
- [ ] Empty state + skeleton (copiar padrão despesas).
- [ ] Build + teste manual (dev server, criar/selecionar/parcelar/pagar) + commit: `feat(passageiros): tela de lista com seleção em massa`.

### Task 5: Página `/passageiro` (detalhe)

**Files:**
- Create: `web/src/app/passageiro/page.tsx` (consome `getPassageiroDetalhe`, `ParcelamentoDialog` da Task 4)

- [ ] Hero: "Falta R$ X" (display, `--destructive`/`--success` quitado) + "de R$ Y" com editar inline (Input + confirmar; chama `updateValorTotal`, toast "parcelas redistribuídas" quando houver) + barra de progresso fina (`--progress`).
- [ ] Seção Parcelas: linha = nº, `.money` valor, vencimento (dd/mm), badge status, [pagar] nas abertas (`registrarPagamento` com `parcelaId`, valor = saldo da parcela). Botão "Parcelar/Reparcelar" → `ParcelamentoDialog`. Sem parcelas + saldo > 0 → hint "Sem parcelamento — parcelar?".
- [ ] Seção Histórico: linha = data, `.money` valor, forma, "parc. N" quando vinculado; ✏️ abre sheet edição (valor/data/forma → `updatePagamento`); 🗑 Dialog central "Excluir pagamento de R$ X? O saldo volta a aumentar." → `deletePagamento`.
- [ ] "+ Registrar pagamento": sheet com valor (pré-preenchido = saldo da próxima parcela aberta; fallback saldo total), data (default hoje, `<input type="date">` via Input), forma (opcional), preview da alocação (`alocarPagamento` client-side): "Quita parcela 2 · abate R$ 20 da 3".
- [ ] Menu ⋮: "Excluir passageiro" → confirmação forte (nome + nº de pagamentos que serão apagados) → `deletePassageiro` → volta p/ lista.
- [ ] Estados: loading, id inválido ("Passageiro não encontrado").
- [ ] Build + teste manual do fluxo completo + commit: `feat(passageiros): página de detalhe com parcelas e histórico`.

### Task 6: Rewire + remoção da tela antiga

**Files:**
- Modify: `web/src/components/bottom-nav.tsx` (linhas 30, 48-50: `/excursao` → `/passageiros`)
- Modify: `web/src/app/page.tsx` (linhas 215, 304: idem)
- Modify: `web/src/lib/data.ts` (remover `listPassageiros`, `addPassageiro`, `registrarPagamento` + import `PassageiroRow`)
- Modify: `web/src/lib/types.ts` (remover `PassageiroRow`, `StatusPagamento`)
- Delete: `web/src/app/excursao/page.tsx`

- [ ] Step 1: trocar as 4 referências de rota.
- [ ] Step 2: remover funções/tipos mortos; `npx tsc --noEmit`-equivalente via `npm run build` acusa sobras.
- [ ] Step 3: deletar a página antiga.
- [ ] Step 4: `npm run lint && npm run build && npx vitest run` → tudo verde.
- [ ] Step 5: teste manual: home → nav → passageiros → detalhe → voltar; despesas intactas.
- [ ] Step 6: commit: `refactor(passageiros): substitui /excursao pela nova tela; remove página antiga`.

### Task 7 (fecho): Documentação

- [ ] Atualizar `RASCUNHO.md` §12 (parcelas ✅) e registrar decisões: sem juros; editar/excluir pagamento permitido (regra "nada se apaga" revogada pelo usuário p/ pagamentos); waterfall; status derivado (coluna `parcela.status` deprecada).
- [ ] Commit: `docs: decisões do módulo passageiros`.

---

## PARTE D — Revisão crítica (Tech Lead) e otimização

**Rubrica** (pesos): fidelidade ao escopo/planilha 20 · completude 15 · arquitetura/consistência 15 · UX/design system 15 · especificidade 15 · sequenciamento/risco 10 · casos de borda 10.

**Trajetória: 72 → 85 → 90 → 90 (platô).**

**v1 → v2 (draft inicial, 72):**
- ❌ Não definia o que acontece ao **mudar valor total com parcelas pagas** → regra da redistribuição só nas abertas (B1).
- ❌ `parcela.status` armazenado conflitava com edição livre de pagamentos → tudo derivado por view; coluna deprecada (B1/B5). É a decisão que faz "editar/excluir de vez" ser seguro.
- ❌ Waterfall em N inserts separados = não-atômico → insert de array (1 statement).
- ❌ Ignorava dados existentes (10 pagamentos avulsos, 2 parcelas de teste) → verificado: avulsos continuam válidos; teste vira limpeza (Task 2).
- ❌ Tabela mobile sem estratégia → `overflow-x` + Nome sticky (o formato tabela foi escolha explícita do usuário, ciente do trade-off).

**v2 → v3 (revisão tech lead, 85 → 90):**
- 🔧 Ordenar "vence antes" era impossível sem dado → `proximo_vencimento` exposto na view (B5) e no `PassageiroRow`.
- 🔧 `gerarParcelas` com bug clássico de fim de mês (31/01 + 1 mês = 03/03 em JS) → clamp + teste dedicado.
- 🔧 Parcelar em massa sobre passageiro com parcela paga corrompia histórico → regra "pula e avisa" com retorno `{ok, pulados}`.
- 🔧 Pré-preencher pagamento com o saldo TOTAL (comportamento atual) contradiz o fluxo de parcelas → pré-preenche com a próxima parcela.
- 🔧 Risco de regressão do DROP da view → grep confirmou consumidor único (`data.ts`); passo de conferência via `pg_views` antes do DROP.
- 🔧 Simplificações aplicadas (ponytail): sem componente de tabela genérico, sem estado global, sem painel lateral desktop no MVP (página serve os dois breakpoints com `max-w`), tipos dentro da própria lib (precedente despesas), um único componente compartilhado novo.

**v3 → v4: sem ganho > margem (mudanças seriam cosméticas). Parado no platô.**

**Limitações aceitas (registradas):** redistribuição com pagamento parcial vinculado a parcela aberta é aproximada (view corrige o saldo; caso raro) · homônimos criam clientes duplicados (dívida pré-existente, fora do escopo) · nº da vaga é ordinal por criação, não persistido.
