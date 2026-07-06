# Planejamento — Módulo Relatórios & BI (Central de Inteligência)

> Status: **PROPOSTA — aguardando aprovação**. Não implementar antes do OK.
> Papel: substituir de vez a análise por planilha. Transformar dado em decisão.
> Complementa: [RASCUNHO.md](../../../RASCUNHO.md) (produto) · [DESIGN.md](../../../web/DESIGN.md) (visual) · [CLAUDE.md](../../../CLAUDE.md) (stack).

---

## 1. Visão e princípios

**O que é:** uma área única (`/relatorios`) onde a gestora entende a situação da empresa
em segundos e aprofunda até o detalhe quando quiser — sem calcular nada de cabeça,
sem abrir Excel, sem pular entre telas.

**Princípios de produto (guiam todo corte de escopo):**

1. **Resposta antes do gráfico.** Cada widget existe para responder UMA pergunta do negócio
   ("quanto lucrei?", "quem me deve?", "quanto entra mês que vem?"). Se não responde
   pergunta real, não entra.
2. **Informação, não dado bruto.** O sistema resume, compara e destaca sozinho
   (ex.: "Recebido em julho: R$ 12.300 — 40% acima de junho").
3. **Regras financeiras travadas são lei** (RASCUNHO §6/§11):
   - **Lucro = saldo_caixa = total_recebido − total_despesas** — nunca usa "a receber".
   - **Passeio = fluxo de caixa puro** (decisão usuário 2026-07-06): dinheiro que entra e
     é repassado à agência. Aparece nos relatórios de caixa como **entrada + saída (repasse)**,
     e **nunca infla o lucro** (os dois lados se anulam — coerente com a view atual).
   - **origem_recurso é informativo** — pode segmentar gráfico, não muda nenhum número.
4. **Escala real do negócio:** 1 usuária, ~4 excursões/ano, dezenas–centenas de passageiros,
   celular. Isso permite agregação no cliente (padrão já usado em `despesas.ts`) e **proíbe**
   over-engineering (nada de OLAP, cache de agregados, lib de chart de 300 KB).
5. **Camadas de leitura** (do relance ao detalhe): resumo executivo → indicadores →
   gráficos → rankings/destaques → tabela completa. Quem quer só a visão geral para na camada 1.

---

## 2. Inventário — o que o sistema já sabe (auditoria dos dados)

| Fonte | Campos úteis p/ BI | Habilita |
|---|---|---|
| `excursao` | nome, destino, datas, status (planejada/ativa/encerrada) | eixo "por excursão", filtro, timeline |
| `v_resumo_excursao` | total_a_receber, total_recebido, total_despesas | KPIs por excursão e consolidado (soma) |
| `passageiro` + `v_passageiro_saldo` | valor_total, valor_pago, saldo, status (quitado/atrasado/em_dia), proximo_vencimento | inadimplência, % quitados, ranking devedores |
| `parcela` + `v_parcela_saldo` | numero, valor, **vencimento**, saldo, status (paga/atrasada/pendente) | **previsão de receita** (parcelas futuras por mês), agenda de cobrança, aging de atraso |
| `pagamento` | valor, **data**, forma (Pix/…) | série temporal de entradas, fluxo de caixa, mix de formas |
| `despesa` | valor, **data (opcional!)**, categoria (cor+ícone), origem_recurso, forma_pagamento, responsavel | série de saídas, donut por categoria, evolução |
| `categoria_despesa` | nome, cor, icone | agrupamento visual consistente (cores já existem) |
| `passeio` + participantes | valor por pessoa, pago (bool) | relatório operacional pass-through |
| `onibus`/`quarto` (schema existe, módulo não) | capacidade, custo, alocação | ocupação — **fase futura**, após módulo |

**Lacunas identificadas (tratar no plano):**

- **`despesa.data` é opcional** → série temporal precisa de um balde "sem data" e a UI de
  despesas deveria passar a sugerir `hoje` como default. (Decisão pequena, propor junto.)
- **Não existe meta/orçamento** por excursão → comparativo "previsto × realizado" de despesa
  fica fora do MVP (registrado em §9 como evolução).
- **Não existe custo por passageiro/break-even** → derivável (despesas ÷ pax), entra como
  indicador calculado, sem schema novo.
- Ônibus/quartos ainda sem módulo → seção operacional nasce só com passeios e ganha
  ocupação depois.

**Conclusão da auditoria:** tudo que o usuário pediu (lucro por viagem, gasto com hospedagem,
categoria que mais consome, parcelas em aberto, faturamento previsto, entrou × falta entrar)
**já é calculável com o schema atual, sem migração obrigatória**. Só serão criadas views SQL
se a agregação no cliente se provar lenta (não deve, pelo volume).

---

## 3. Catálogo de métricas (dicionário oficial)

Cada métrica tem fórmula única, definida em **funções puras** (testáveis com vitest,
mesmo padrão de `parcelas.ts`). É o "dicionário" que evita dois gráficos discordando.

### 3.1 Financeiras (consolidado ou por excursão)

| Métrica | Fórmula | Fonte |
|---|---|---|
| Faturamento previsto (a receber total) | Σ passageiro.valor_total (+ passeio: todos participantes) | v_resumo_excursao |
| Recebido | Σ pagamento.valor | v_resumo_excursao / pagamento |
| Falta receber | a_receber − recebido | derivada |
| Despesas totais | Σ despesa.valor (+ repasse de passeio pago) | v_resumo_excursao |
| **Lucro / Saldo em caixa** | recebido − despesas | regra travada 2026-07-06 |
| % recebido | recebido ÷ a_receber | derivada |
| Margem | lucro ÷ recebido | derivada |
| Ticket médio | a_receber ÷ nº passageiros | derivada |
| Custo por passageiro | despesas ÷ nº passageiros | derivada |
| Entradas no período | Σ pagamento.valor com data no range | pagamento |
| Saídas no período | Σ despesa.valor com data no range | despesa |
| Fluxo líquido do período | entradas − saídas | derivada |
| **Receita prevista por mês (forecast)** | Σ v_parcela_saldo.saldo agrupado por mês de vencimento (parcelas não pagas) | v_parcela_saldo |
| Caixa projetado | saldo atual + Σ previsto acumulado | derivada |

### 3.2 Cobrança / pagamentos

| Métrica | Fórmula |
|---|---|
| Parcelas pagas / pendentes / **vencidas** | count + Σ por status de `v_parcela_saldo` |
| Valor em atraso | Σ saldo das parcelas status=atrasada |
| Vence esta semana / este mês | parcelas pendentes com vencimento no range |
| Recebido esta semana / este mês | pagamentos com data no range |
| Inadimplentes | passageiros status=atrasado (qtd + Σ saldo) |
| Aging do atraso | buckets 1–7 / 8–30 / +30 dias desde o vencimento |

### 3.3 Passageiros / operacional

| Métrica | Fórmula |
|---|---|
| Passageiros ativos | pax de excursões status ≠ encerrada |
| Quitados / em dia / atrasados | count por status_pagamento |
| % quitados | quitados ÷ total |
| Passeios: participantes, pagos, repasse pendente | passeio_participante (pago bool) |

### 3.4 Comparativos automáticos (o "inteligente" dos cards)

- Período atual × período anterior de mesmo tamanho (ex.: julho × junho) → Δ% no card.
- Excursão × excursão (lucro, margem, custo/pax) → ranking.
- Sempre com sinal semântico: positivo `--positive`, negativo `--danger` (nunca só cor — WCAG).

---

## 4. Estrutura do módulo — `/relatorios`

Uma rota, **5 abas** (componente `Tabs` já existe), com **camada 0** fixa acima das abas.
Mobile-first: tudo em coluna única; tablet/desktop reorganiza em grid (DESIGN §9).

```
/relatorios?tab=visao&periodo=este-ano&excursao=all
│
├─ Header: "Relatórios" + botão Exportar
├─ Barra de filtros globais (pills, sticky)  ← §6
│
├─ [Visão geral]   ← abre aqui. "A empresa em 10 segundos"
├─ [Financeiro]    ← fluxo de caixa, evolução, previsão
├─ [Excursões]     ← comparativo + raio-X de cada viagem
├─ [Pagamentos]    ← cobrança: parcelas, vencimentos, inadimplência
└─ [Despesas]      ← para onde vai o dinheiro
```

Entrada: item "Relatórios" do sheet **Mais** da bottom nav (placeholder já existe em
`bottom-nav.tsx`) passa a navegar de verdade. *(Decisão em aberto §10: promover à barra?)*

### Aba 1 — Visão geral (Dashboard Executivo)

Pergunta: **"como está a empresa agora?"**

1. **Herói — Saldo em caixa consolidado** (todas as excursões do filtro), número display
   sage, com linha secundária "Recebido · Despesas" (mesma gramática do herói da home,
   mas âmbito empresa, não excursão).
2. **Linha de KPIs** (grid 2×2 no mobile): A receber (falta) · Parcelas vencidas (R$ + qtd,
   em `--danger` se > 0) · Passageiros ativos · Lucro do período (com Δ% vs anterior).
3. **Sparkline de caixa** — entradas−saídas acumulado nos últimos 6 meses (tendência num relance).
4. **"Precisa de atenção"** (só aparece se houver): N inadimplentes somando R$ X →
   toca e vai p/ aba Pagamentos filtrada; parcelas que vencem em 7 dias.
5. **Ranking de excursões por lucro** (barras horizontais, top 5) → toca e abre raio-X.

> A home continua sendo o painel *da excursão selecionada*; a Visão geral é o painel
> *da empresa*. Sem redundância: a home não muda.

### Aba 2 — Financeiro

Pergunta: **"como o dinheiro se move no tempo?"**

1. KPIs do período filtrado: Entradas · Saídas · Líquido (com Δ% vs período anterior).
2. **Fluxo de caixa mensal** — barras pareadas (entrada `--positive` / saída `--danger`)
   por mês, com linha de líquido; tocar num mês abre o detalhamento (drill-down).
3. **Evolução acumulada** — gráfico de linha/área do caixa acumulado.
4. **Previsão de caixa (forecast)** — barras dos próximos 6 meses com a receita prevista
   (parcelas a vencer por mês), em estilo visual "projetado" (opacidade/tracejado, nunca
   igual ao realizado); linha de caixa projetado acumulado. É a resposta de
   "qual o faturamento previsto para os próximos meses?".
5. **Mix de formas de pagamento** (Pix/dinheiro/cartão) — proportion bar (componente existente).
6. **Passeios no caixa (pass-through):** entradas de participantes pagos e o repasse à agência
   entram no fluxo como linhas espelhadas (entra → sai), rotuladas "passeio", líquido ~zero.
   ⚠️ Limitação de dado: `passeio_participante` tem só o bool `pago` (sem data de pagamento) —
   na série temporal, o passeio entra pela **data do passeio** (ou balde "sem data").
7. Tabela **extrato unificado** (camada 5): pagamentos + despesas + repasses de passeio
   intercalados por data, com busca — o "livro-caixa" da empresa.

### Aba 3 — Excursões

Pergunta: **"quanto cada viagem deu e como estão as ativas?"**

1. **Comparativo entre excursões** — barras agrupadas (recebido × despesas × lucro) usando
   `OverviewBars`; alterna métrica (lucro/margem/custo por pax).
2. **Cards por excursão** (lista): nome + status + donut de % recebido + lucro + pax
   (quitados/total). Toca → **raio-X da excursão**:
   - KPIs completos: faturamento previsto, recebido, falta, despesas, **lucro**, margem,
     ticket médio, custo/pax;
   - Funil de pagamento dos passageiros (quitados / em dia / atrasados);
   - Despesas da excursão por categoria (donut existente);
   - Curva de arrecadação no tempo (linha: acumulado de pagamentos até a data da viagem).
3. Tabela completa (camada 5) com todas as colunas, exportável.

### Aba 4 — Pagamentos (cobrança)

Pergunta: **"quem me deve, quanto, e o que vence agora?"** — a dor nº 1 da planilha (RASCUNHO §4).

1. KPIs: Parcelas vencidas (R$+qtd) · Vence em 7 dias · Recebido esta semana · Recebido este mês.
2. **Barra de status das parcelas** — proportion bar pagas/pendentes/vencidas (R$).
3. **Agenda de vencimentos** — timeline agrupada (Atrasadas · Esta semana · Este mês ·
   Depois), cada item = passageiro + excursão + parcela + valor, **tocável → tela do
   passageiro** para registrar o pagamento na hora (relatório acionável, não só leitura).
4. **Ranking de devedores** — maiores saldos em aberto, com aging (há quantos dias venceu).
5. Histórico de recebimentos (tabela por data, filtro por forma), exportável.

### Aba 5 — Despesas

Pergunta: **"para onde está indo o dinheiro?"**

1. KPIs: Total do período · Maior categoria · Média mensal · Δ% vs período anterior.
2. **Donut por categoria** — reusa o donut interativo de `/despesas` (cores/ícones das
   categorias), com drill-down para a lista da categoria. Responde "hospedagem" e
   "qual categoria mais consome".
3. **Evolução mensal** — barras empilhadas por categoria (áreas empilhadas na versão desktop).
4. **Top 10 maiores despesas** do período (ranking com nome, excursão, categoria).
5. Corte por `origem_recurso` (passageiros × próprio) — informativo, proportion bar.
6. Tabela completa, exportável.

### (Futuro) Aba Operacional

Nasce quando ônibus/quartos existirem: ocupação de assentos/quartos, custo por assento,
passeios (participantes × pagos × repasse). Passeios já podem aparecer antes como card
dentro do raio-X da excursão. A arquitetura de abas + registry (§7) torna isso plugável.

---

## 5. Visualizações — linguagem única (DESIGN §6)

Regra: **um tipo de gráfico por tipo de pergunta**, todos na mesma linguagem
(traço arredondado, cor por token, 1 animação de entrada, motion-reduce).

| Pergunta | Forma | Componente |
|---|---|---|
| "Quanto? / status agora" | KPI card (número tabular + label + Δ%) | `KpiCard` **novo** |
| "Tendência num relance" | Sparkline | `Sparkline` **novo** |
| "Evolução no tempo" | Linha/área | `LineChart` **novo** |
| "Comparar categorias/excursões" | Barras verticais | `OverviewBars` ✔ existe |
| "Ranking (top N)" | Barras horizontais + valor | `RankBars` **novo** |
| "Partes de um todo" | Donut interativo / proportion bar | ✔ existem |
| "Entradas × saídas no tempo" | Barras pareadas ou divergentes | variação de `OverviewBars` |
| "Realizado × projetado" | Barras sólidas + barras "ghost" (opacidade) | variação de `LineChart`/barras |
| "Agenda / o que vem" | Timeline agrupada (lista com datas) | `Timeline` **novo** (lista, não gráfico) |

**Decisão técnica recomendada: continuar com SVG próprio em `charts.tsx`** (estender), em vez
de adotar Recharts/ECharts. Motivos: volume de dados minúsculo, bundle pequeno importa
(estático + APK Capacitor), a linguagem visual já existe e uma lib externa brigaria com o
design system. Custo: escrever ~4 componentes novos, todos simples (<150 linhas cada).

**Cards inteligentes:** todo KPI mostra contexto, não só o número — Δ% vs período anterior,
mini-texto automático ("melhor mês do ano", "3 parcelas vencem esta semana") e cor semântica.

---

## 6. Filtros globais

Barra sticky de **pills** (padrão de chips do DESIGN §5) acima do conteúdo, valendo para a
aba inteira; gráficos e tabelas reagem imediatamente (estado em memória — sem reload).

| Filtro | Opções | Padrão |
|---|---|---|
| **Período** | Este mês · Últimos 3 meses · Este ano · Tudo · Personalizado (de/até) | Este ano |
| **Excursão** | Todas · uma específica | Todas |
| **Categoria** (aba Despesas) | multi-select das categorias | Todas |
| **Status pagamento** (aba Pagamentos) | todas/pagas/pendentes/vencidas | Todas |
| **Forma** (onde couber) | Pix/dinheiro/cartão… | Todas |

- Filtros de **passageiro** e **passeio** ficam locais (busca dentro das tabelas/raio-X) —
  como filtro global confundiriam mais do que ajudam.
- **Estado na URL** (`?tab=&periodo=&excursao=`): voltar/atualizar preserva a análise, e é o
  gancho futuro p/ "compartilhar visão".
- Período compara automaticamente com o **período anterior de mesmo tamanho** para os Δ%.
- Regra de corte temporal: pagamentos por `data`; parcelas por `vencimento`; despesas por
  `data` (nulos caem num chip "sem data" visível, para não sumir dinheiro silenciosamente).

---

## 7. Arquitetura técnica (escalabilidade)

```
web/src/
├─ lib/
│  ├─ relatorios.ts        # I/O: busca datasets brutos (pagamentos, parcelas,
│  │                       #      despesas, resumos) com filtro de período/excursão.
│  │                       #      Segue a convenção: NENHUM supabase.from() nas telas.
│  └─ metricas.ts          # FUNÇÕES PURAS: todas as fórmulas do §3 + agrupamentos
│                          #   (porMes, porCategoria, forecast, aging, deltas).
│                          #   100% testável com vitest (padrão parcelas.ts).
├─ components/
│  ├─ charts.tsx           # estende: Sparkline, LineChart, RankBars, barras pareadas
│  └─ relatorios/
│     ├─ kpi-card.tsx      # número + label + Δ% + cor semântica
│     ├─ chart-card.tsx    # moldura padrão (título, subtítulo, ação, empty state)
│     ├─ filtros-bar.tsx   # pills globais ↔ URL
│     ├─ secoes/…          # 1 arquivo por aba (visao, financeiro, excursoes, …)
│     └─ export.ts         # CSV/print (fase 4)
└─ app/relatorios/page.tsx # shell: tabs + filtros + renderiza seções
```

**Dashboards editáveis (decisão usuário 2026-07-06):**

Cada aba é declarada como uma **lista de widgets registrados** (`{ id, titulo, componente }`),
não JSX fixo. Sobre esse registry entra um modo **"Personalizar"** (botão no header da aba):

- **Reordenar** widgets (setas ↑/↓ ou arrastar pelo handle — mobile-first, sem grid livre);
- **Ocultar/exibir** widgets (toggle por item);
- Preferências salvas por aba em `localStorage` no MVP (1 usuária, 1 celular);
  o formato `{ tab: [{ id, visivel }] }` migra depois para uma tabela `preferencia_usuario`
  no Supabase (multi-dispositivo/multi-usuário) sem mudar a UI.
- Widget novo lançado em versão futura aparece automaticamente no fim da lista (merge
  registry × preferência por `id` — preferência não conhece o widget → visível por padrão).
- Botão "Restaurar padrão" por aba.

**Por que escala:**

- **Novo indicador** = 1 função pura em `metricas.ts` + 1 `<KpiCard>`; **novo gráfico** =
  1 componente consumindo dataset existente; **nova aba** = 1 arquivo em `secoes/` +
  entrada no array de tabs; **novo widget** = 1 entrada no registry (já nasce
  personalizável). Nada acoplado.
- **Datasets brutos separados das fórmulas**: quando ônibus/quartos/metas existirem,
  entram como novo dataset + novas fórmulas, sem tocar no resto.
- **Agregação no cliente** (decisão consciente): ~4 excursões/ano ⇒ centenas de linhas por
  consulta, agregação em ms. Se um dia doer, a **mesma fórmula vira view SQL** sem mudar a
  UI (o contrato é o dataset). Views novas só se necessário — e sempre `security_invoker=true`.
- Carregamento por aba (lazy): abrir Relatórios busca só o que a aba ativa precisa.
- Skeletons + empty states por card (padrão já existente nas telas).

**O que NÃO fazer (anti-over-engineering):** grid livre estilo BI corporativo (redimensionar
células, múltiplos dashboards salvos) — a personalização se limita a reordenar/ocultar
widgets, que cobre a necessidade real; cache de agregados; biblioteca de charts pesada;
relatório agendado/e-mail; IA gerando insight em texto livre. Os "resumos automáticos" do
§5 são regras determinísticas simples (Δ%, maior categoria, contagens), não IA.

---

## 8. Exportação — **ADIADA** (decisão usuário 2026-07-06)

Fica fora do escopo inicial do módulo. O desenho abaixo permanece como referência para
quando for ativada — a arquitetura (datasets separados em `lib/relatorios.ts`) já deixa
tudo pronto para exportar sem refatorar. O botão "Exportar" **não** entra na UI por ora.

| Fase | Formato | Técnica | Esforço |
|---|---|---|---|
| E1 | **CSV** por tabela (extrato, passageiros, despesas, parcelas) | Blob client-side, zero dependência; abre no Excel | baixo |
| E2 | **Impressão/PDF** | stylesheet `@media print` da aba atual + `window.print()` (o "PDF" nativo do navegador) | baixo |
| E3 | **Excel real (.xlsx)** multi-abas (uma planilha = o antigo Excel dela, gerado pelo sistema) | SheetJS/exceljs client-side | médio |
| E4 | PDF composto (capa + gráficos) e **compartilhar no APK** (Capacitor Share/Filesystem) | jsPDF + plugin Capacitor | médio, junto da fase Capacitor |

Quando ativada: botão único **Exportar** no header abre sheet com as opções disponíveis no
contexto (aba + filtros aplicados). CSV com separador `;` e vírgula decimal (Excel pt-BR).

---

## 9. Roadmap de implementação (após aprovação)

| Fase | Entrega | Valor |
|---|---|---|
| **F0** | Fundação: rota `/relatorios`, tabs, filtros globais ↔ URL, `relatorios.ts` + `metricas.ts` com testes, `KpiCard`/`ChartCard` + **registry de widgets** | esqueleto navegável |
| **F1** | **Visão geral** completa (herói, KPIs, sparkline, atenção, ranking) + ligar item da bottom nav | a empresa em 10 segundos |
| **F2** | **Pagamentos** (agenda de vencimentos, vencidas, devedores) | ataca a dor nº 1 (cobrança) |
| **F3** | **Financeiro** (fluxo mensal c/ passeios pass-through, evolução, **forecast**, extrato) | visão de caixa e futuro |
| **F4** | **Excursões** (comparativo + raio-X) e **Despesas** (donut, evolução, top 10) | análise profunda |
| **F5** | **Personalização dos dashboards** (modo editar: reordenar/ocultar widgets, restaurar padrão) | dashboards editáveis |
| Depois | Exportação (§8, adiada), Operacional (ônibus/quartos), metas/orçamento, light theme | evolução contínua |

Ordem F2 antes de F3 é proposital: cobrança gera dinheiro; gráfico bonito não.
Personalização por último de propósito: primeiro os widgets existem (F1–F4) já montados
sobre o registry (F0), depois ganham edição — nenhum retrabalho.
Cada fase é revisável e utilizável sozinha.

## 9.1 Evoluções registradas (fora do escopo inicial)

- Meta/orçamento por excursão (previsto × realizado de despesas) — pede schema novo.
- Comparativo ano × ano (faz sentido a partir do 2º ano de dados).
- Análise de cliente recorrente (quem viaja de novo — `cliente` já permite).
- Ocupação de ônibus/quartos (depende do módulo de alocação).
- Notificação de vencimento (fora do MVP — RASCUNHO §8).

---

## 10. Revisão crítica & decisões em aberto

**Auto-crítica aplicada ao plano** (metodologia pedida):

- ✅ Todas as perguntas do usuário têm resposta mapeada: lucro por viagem (aba 3),
  hospedagem/categoria (aba 5), parcelas em aberto (aba 4), faturamento previsto (aba 2 §4),
  entrou × falta (abas 1/2).
- ⚠️ Risco nº 1 era **excesso** (BI corporativo p/ empresa de 4 viagens/ano) — mitigado com
  camadas de leitura, 5 abas fixas (não N dashboards), e a lista explícita de "não fazer" (§7).
- ⚠️ `despesa.data` opcional ameaça as séries temporais → tratamento definido (§6) +
  proposta de default `hoje` no formulário.
- ⚠️ Relatório que só "mostra" morre — por isso agenda de vencimentos e inadimplentes são
  **acionáveis** (levam à tela de pagamento).
- ✅ Coerência com o design system verificada: tokens, tipografia money, charts SVG próprios,
  bottom nav + sheets, mobile-first.

**Decisões já tomadas pelo usuário (2026-07-06):**

- ✅ **Dashboards editáveis** — modo personalizar (reordenar/ocultar widgets) via registry (§7),
  entregue na F5.
- ✅ **Exportação ADIADA** — fora do escopo inicial; desenho preservado no §8 p/ o futuro.
- ✅ **Passeios = fluxo de caixa puro** — entram nos relatórios de caixa como entrada + repasse
  (espelhados, líquido ~zero), nunca no lucro. Deixam de ser "só bloco operacional".

**Decisões respondidas (usuário 2026-07-06) — PLANO APROVADO:**

1. **Navegação:** Relatórios **continua no sheet "Mais"** (padrão atual da bottom nav).
2. **Período padrão** ao abrir: **"Este ano"**.
3. **Despesa sem data:** sim — o formulário já sugere `hoje()` por padrão (verificado no
   código; nenhuma mudança necessária).

Implementação iniciada pela F0 (fundação) + F1 (Visão geral).
