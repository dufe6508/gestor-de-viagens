# DESIGN.md — Sistema Visual do Gestor de Excursões

Fonte da verdade **visual**. Complementa o [RASCUNHO.md](../RASCUNHO.md) (produto/negócio) e a [CLAUDE.md](../CLAUDE.md) (stack).
Consulte antes de mexer em estilo. Atualize quando um token/decisão mudar.

Status: **IMPLEMENTADO** (2026-07-05) — tokens, primitivos, shell (bottom nav + FAB + sheets), home narrativa, telas portadas, gráficos unificados. Pendente do §9: sidebar desktop (mobile/tablet prontos; desktop usa a mesma coluna alargada). Backup pré-rebrand: scratchpad da sessão.

---

## 0. Decisões travadas

| Eixo | Decisão |
|---|---|
| Tema | **Dark-first refinado.** Grafite neutro levemente esverdeado. Sem violeta. Light fica pra depois. |
| Acento | **Sage green** dessaturado, usado com parcimônia (só valor-herói, CTA, positivo). |
| Linguagem | **Soft / tátil** — cantos generosos, borda hairline, sombra sutil só em overlay. **Sem glassmorphism / blur.** |
| Prioridade | **Mobile-first**, uma mão, uso em viagem. Bottom nav + FAB real. |

Princípio-guia (aplicar a toda decisão): *isto conta a história do dinheiro, ou só ocupa espaço?* Se não fortalece hierarquia/identidade/uso de uma mão → corta.

---

## 1. Diagnóstico do que sai (resumo da auditoria)

Problemas que destroem percepção de valor hoje, e a correção:

1. **4 utilitários de vidro** (`.glass`, `.glass-hi`, `.liquid-glass`, `.liquid-glass-plain`) → **2 superfícies** (`surface`, `surface-raised`), sem blur.
2. **Radius bracket aleatório** (`[28px]`,`[24px]`,`[22px]`,`[20px]`, `3xl`, `xl`…) → **escala de 5 valores**, sempre via token.
3. **Bordas `white/8..25` hardcoded** → sempre `--border` / `--border-strong`.
4. **Fundo gradiente violeta+ciano + speculars pesados** → canvas grafite chapado, cara de IA some.
5. **Home = coleção de cards redundante** (Recebido aparece 3×) → narrativa única (§8).
6. **Sem bottom nav; coluna `max-w-md` fixa** → shell mobile com tab bar + layout responsivo (§7, §9).
7. **4 estilos de gráfico** → 1 linguagem (§6).

Manter (funciona): fonte de dinheiro tabular, donut interativo com drilldown, sistema categoria cor+ícone, empty states, skeletons, micro-feedback `active:scale`.

---

## 2. Cor

Valores em hex (spec). Na implementação viram `--var` no `@theme` do [globals.css](src/app/globals.css), mantendo a convenção oklch do projeto.

### Neutros (dark, base) — grafite verde
Rampa de superfície por **degraus de cor**, não sombra (no dark a sombra some).

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#0b0d0c` | Canvas. Preto tingido de verde (coesão c/ acento, lição Wise). |
| `--surface` | `#141716` | Card padrão. 1º degrau. |
| `--surface-raised` | `#1b1f1d` | Card sobre card, sheet, item ativo. 2º degrau. |
| `--border` | `#232826` | Hairline 1px padrão (faz a separação). |
| `--border-strong` | `#2f3633` | Borda de item ativo/foco. |

### Texto — rampa de 4 (modelo Linear)
| Token | Hex | Uso |
|---|---|---|
| `--text` | `#f1f4f2` | Primário. Off-white esverdeado, nunca `#fff` puro. 15–17:1 ✓ |
| `--text-secondary` | `#a6aeaa` | Rótulos, subtítulos. 7.3–8.6:1 ✓ |
| `--text-muted` | `#828a84` | Metadados, hint. 4.7–5.5:1 ✓ AA em qualquer superfície. |

> Contraste **verificado por cálculo WCAG** (não estimado). `#6e766f` original reprovou (3.6–4.2:1) e foi corrigido para `#828a84`.

### Acento — sage
Um só. Aparece em: valor-herói, CTA primário, estado positivo, seleção.

| Token | Hex | Uso |
|---|---|---|
| `--accent` | `#8fae94` | Sage base. Texto/ícone de acento sobre dark. |
| `--accent-strong` | `#a3c4a8` | Número-herói (saldo), hover de CTA. Um tom acima p/ leitura. |
| `--accent-bg` | `#18211c` | Fundo tênue de chip/CTA-fill/seleção. Verde bem escuro. |
| `--on-accent` | `#0b0d0c` | Texto sobre preenchimento sage sólido (botão primário). |

### Semânticos (mínimos)
| Token | Hex | Uso |
|---|---|---|
| `--positive` | `#8fae94` | = acento. Recebido, quitado, lucro+. Verde é o "bom". |
| `--warning` | `#c9a86a` | Âmbar dessaturado. Previsto, vence em breve. |
| `--danger` | `#c67b6f` | Terracota dessaturado (não vermelho neon). Atrasado, excluir, prejuízo. |

> Cores de **categoria** (definidas pela usuária) continuam livres, mas com **teto de saturação** — passar por um filtro que puxa pro dessaturado, pra não brigar com a paleta. Ver §6.

---

## 3. Tipografia

Mantém **IBM Plex Sans** (UI/display) + **IBM Plex Mono** (dinheiro) — já é distinta o bastante e evita licenciar fonte. Personalidade vem de **tracking apertado + peso**, não de trocar a família (lição Linear/Raycast/Wise, todos Inter).

### Escala (mobile base)
| Papel | Tamanho / line-height | Peso | Tracking |
|---|---|---|---|
| Display (saldo herói) | 40 / 44 | 600 | `-0.03em` |
| H1 tela | 22 / 28 | 600 | `-0.02em` |
| H2 seção | 16 / 22 | 600 | `-0.01em` |
| Body | 16 / 24 | 400 | 0 |
| Label | 13 / 18 | 500 | 0 |
| Caption | 12 / 16 | 500 | `0.01em` |

Regras:
- **Piso 12px.** Aposentar `text-[10px]`/`[11px]`.
- **Body 16px** (não 15): evita auto-zoom do iOS em input focado e melhora leitura p/ a usuária. **Input sempre ≥ 16px.**
- **Dinheiro** = Plex Mono, `font-variant-numeric: tabular-nums slashed-zero`, `-0.02em`. Já existe (`.money`), manter.
- Números grandes sempre tabular + tracking negativo = "precisão financeira".

---

## 4. Espaço, grid, radius, sombra

### Espaço (escala 4px)
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 48`. Card padding **16–20**. Gap entre seções **20–24** (mais respiro que hoje).

### Radius (5 valores, fim do bracket aleatório)
| Token | px | Uso |
|---|---|---|
| `--r-sm` | 10 | input, chip, badge |
| `--r-md` | 14 | botão |
| `--r-lg` | 18 | **card padrão** (tátil) |
| `--r-xl` | 24 | card-herói, sheet |
| `--r-pill` | 999 | botão primário, tab pill, avatar |

### Sombra — no dark, **borda faz o trabalho**
| Token | Spec | Uso |
|---|---|---|
| `--sh-flat` | *(nenhuma)* + `1px solid var(--border)` | Cards em fluxo. Padrão. |
| `--sh-raised` | `0 1px 2px rgba(0,0,0,.4)` + borda | Item ativo, FAB. |
| `--sh-overlay` | `0 8px 32px rgba(0,0,0,.45)` + borda | Sheet, dialog, drawer. Único lugar de sombra forte. |

Zero `backdrop-blur`. Zero inset specular. Tátil = **radius generoso + borda hairline + sombra mínima**, não vidro.

> ⚠️ Não derivar para **neumorphism** (emboss/deboss com sombra dupla clara+escura): em dark mode tem contraste reprovado e suporte parcial. Nosso "tátil" é border-first, nunca emboss.

---

## 5. Componentes

Especificação; substitui a base shadcn crua. Tudo consome os tokens acima.

- **Surface / Card** — `bg-surface`, `border --border`, `--r-lg`, padding 16–20. Variante `raised` = `bg-surface-raised`. Sem sombra em fluxo.
- **Botão**
  - *Primário*: fill `--accent`, texto `--on-accent`, `--r-pill`, altura 48 (toque). Hover → `--accent-strong`.
  - *Secundário*: `bg-surface-raised`, texto `--text`, borda `--border`, `--r-pill`.
  - *Ghost*: sem fundo, texto `--text-secondary`, hover `bg-surface`.
  - Aposentar "tudo pill": só primário/secundário são pill; ações em lista usam `--r-md`. Alvo mínimo **44px** (corrige os `icon-xs`).
- **Input / Select** — altura 48, fonte 16, `--r-sm`. **Identificação não depende da borda** (hairline em dark nunca atinge 3:1 — WCAG 1.4.11): input = **label sempre visível acima** + fill `bg-surface-raised` (distinto do fundo do sheet) + borda `--border`. **Foco = borda `--accent`** (7.4:1 ✓, claramente visível). **Um** padrão de select (component único; matar o `<select>` nativo inline das despesas).
- **Chip** (categoria/filtro) — `--r-sm`, borda `--border`; ativo = `bg-accent-bg` + borda `--border-strong`.
- **Badge de status** — `--r-pill`, 12px/500. quitado→positive, atrasado→danger, previsto/em dia→neutro. Fundo = versão `-bg` da cor, texto = cor cheia.
- **Bottom Sheet** ⭐ novo — substitui Dialog central no mobile p/ formulários (nova despesa, pagamento, filtros). Sobe de baixo, `--r-xl` no topo, handle de arraste, `--sh-overlay`. Ergonomia de polegar.
- **Bottom Nav** ⭐ novo — ver §7.
- **FAB** ⭐ novo — botão redondo real (56px, `--r-pill`, fill accent, `--sh-raised`), canto inferior-direito acima da nav. Não o pill largura-total atual que cobre a lista.

Motion (§10) e ícones (§11) valem pra todos.

---

## 6. Gráficos — 1 linguagem

Todos partilham: traço arredondado (`linecap round` / `rounded-full` nas barras), animação de entrada única, cor via token (não gradiente hardcoded).

- **Donut** — trilho `--surface-raised`, progresso **sólido `--accent`** (fim do gradiente violeta→ciano do SVG). Centro: % grande tabular + label muted. Reusar o donut interativo de despesas como o padrão único.
- **Barras** — colunas `--r-sm` no topo, cor por semântica (positive/danger/muted). Uma só implementação; matar os 3 estilos (CompareBars, Evolução inline, mini-barras).
- **Micro/inline** — sparkline fino p/ tendência dentro de card, mesmo traço.
- **Categoria no donut de despesas** — aplicar teto de saturação nas cores livres: `oklch(L 0.08→0.10 H)` clamp, pra caberem na paleta calma.
- **Cor nunca é o único sinal** (WCAG): status sempre tem texto/badge junto (já é assim), segmentos de donut sempre têm legenda tocável (os cards de categoria cumprem esse papel — manter).

---

## 7. Shell mobile / navegação

Fim do hambúrguer-só-na-home. Modelo consistente em todas as telas:

- **Bottom Nav** fixa, 4 itens, thumb-zone: **Início · Passageiros · Despesas · Mais**. Ícone 24 + label 12. Ativo = ícone `--accent` + label `--text`; inativo = `--text-muted`. `bg-surface`, borda-topo `--border`.
- **FAB** central/direito acima da nav p/ ação primária contextual (nova despesa / novo passageiro).
- **Header** por tela: título H1 + no máx. 1 ação à direita. Sem par de botões redondos de vidro.
- **Sheets** de baixo p/ todo formulário. Dialog central só p/ confirmação curta (excluir).
- `safe-area-inset-bottom` respeitado (APK/iOS).

---

## 8. Home — narrativa (não coleção de cards)

Ordem que conta uma história, sem redundância (hoje Recebido aparece 3×):

1. **Seletor de excursão** compacto no topo (mantém).
2. **Herói — Saldo em caixa**: número display `--accent-strong`, tabular. Abaixo, **1 linha** com A receber · Recebido (não repetir em card separado).
3. **Progresso de recebimento**: donut único + "falta X". *(funde o hero-2 e o card-donut de hoje.)*
4. **Precisa de atenção**: só aparece se houver — N atrasados, próximo vencimento. `--danger`/`--warning`. Acionável.
5. **Próxima excursão / linha do tempo**: o que hoje não existe e dá contexto temporal.
6. **Atalhos**: Passageiros · Despesas · (Passeios) · (Relatório) — via bottom nav + FAB, não 4 círculos soltos.

Remover: card de "Visão geral" com 4 barras (duplica donut + herói).

---

## 9. Responsivo (tablet / desktop)

Fim do `max-w-md` cego.
- **Mobile** (`<640`): coluna única, bottom nav.
- **Tablet** (`≥768`): conteúdo `max-w-2xl` centrado; grids 2-col nos cards de métrica; nav pode ir pra lateral.
- **Desktop** (`≥1024`): **sidebar** fixa à esquerda (substitui bottom nav), conteúdo `max-w-3xl`, dashboard 2–3 colunas. Não esticar cards ao infinito — limitar largura, usar o respiro.

---

## 10. Motion

Discreto, nunca rouba atenção. Durations: **micro 120ms**, **transição 200–260ms**, ease `cubic-bezier(.4,0,.2,1)`.
- Feedback toque: `active:scale-[0.97]` (manter).
- Sheet: slide-up 240ms + fade backdrop.
- Números: contam até o valor (count-up) 500ms só na 1ª montagem.
- Gráficos: 1 entrada (donut sweep / barras grow) 600ms, `motion-reduce` desliga (já respeitado).
- Sem bounce, sem parallax, sem shimmer decorativo.

---

## 11. Ícones

- **lucide-react**, espessura única **1.75**, tamanho **20** (inline) / **24** (nav). Fim do mix `size-4.5`/`5`/`3.5`.
- Um ícone por conceito, consistente entre telas (ex.: despesa sempre o mesmo).

---

## 12. Ordem de implementação (pendente de OK)

1. **Tokens** — reescrever camada cor/radius/sombra/espaço no `globals.css`; matar os 4 vidros → 2 surfaces. *(Base de tudo.)*
2. **Primitivos** — Button, Input/Select, Card, Badge, Chip, Sheet, BottomNav, FAB nos novos tokens.
3. **Shell** — bottom nav + FAB + header padrão + sheets.
4. **Home** narrativa (§8).
5. **Despesas / Passageiros** portadas pros primitivos.
6. **Gráficos** unificados.
7. **Responsivo** tablet/desktop.

Cada etapa é um passo revisável. Não pular a 1.

---

## Anexos
- Benchmark bruto (13 sites, computed-styles + screenshots): `scratchpad/bench/` (fora do repo, sessão).
- Valores de acento validados contra: Wise (verde/dark), Raycast (tátil/dark), Linear (rampa texto), Mercury (surfaces).

## Log de revisão

**2026-07-05 — revisão pré-implementação** (ui-ux-pro-max + frontend-ui-engineering + senior-frontend):
- ✅ Direção validada: dark + 1 acento verde + neutros = vocabulário fintech-calmo 2026; "AI purple/pink gradients" é anti-pattern catalogado (violeta atual confirmado como problema).
- 🔧 `--text-muted` corrigido `#6e766f`→`#828a84` (reprovava AA; verificado por cálculo).
- 🔧 Body 15→16px; input ≥16px (anti auto-zoom iOS) e altura 48.
- 🔧 Regra de input: identificação por label + fill + foco accent, não pela borda hairline (WCAG 1.4.11).
- 🔧 Nota anti-neumorphism (dark + emboss = contraste reprovado).
- ✔️ Já conformes: touch 44px+, bottom nav ≤5 c/ ícone+label, motion 150–300ms + reduced-motion, cor nunca sinal único, tipografia rejeitou sugestão cyberpunk do banco de dados (contexto errado).
