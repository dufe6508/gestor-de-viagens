# RASCUNHO — Gestor Financeiro de Excursões

> Documento vivo. Captura decisões, regras de negócio e funções.
> Fase atual: **Descoberta + Requisitos**. Ainda NÃO codar.
> Última atualização: 2026-07-05

---

## 1. Contexto

- Cliente inicial: tia (empresa de excursões). Uso solo, no celular dela.
- Hoje: tudo em Excel (`planilha ju.xlsx`, `planilha organizada.xlsx`). Aba `2027` = Arraial do Cabo.
- Objetivo: eliminar planilhas. App próprio, modular, escalável (futuro multi-empresa / comercializável).
- Volume: ~4 excursões/ano (2 grandes + passeios menores). Excursões coexistem (histórico + ativas).

## 2. Escopo

- Foco central: **financeiro**. MAS inclui ônibus e quartos (fazem parte do financeiro/organização).
- Guardar TODO histórico. Nada se apaga.
- Distribuição: web app instalável. Vira **APK via Capacitor**. (Roda no navegador também.)

## 3. Decisões travadas

| Tema | Decisão |
|------|---------|
| Escopo MVP | Financeiro + ônibus + quartos |
| Empacotamento | Web app → APK via Capacitor |
| Usuários | 1 (tia) hoje. Arquitetura preparada p/ multi-usuário e multi-empresa |
| Preço por passageiro | Varia por pessoa (ex: vaga normal 1450, vaga família 650) |
| Parcelamento | Configurável por passageiro: nº parcelas + juros (sim/não + taxa) + data |
| Despesas | Despesa = nome + categoria. Categorias criáveis pelo usuário. Organização por categoria |
| Preço | Tabela de "classes de valor" (normal/família/meia/inteira/criança). Preenchimento em massa |
| Passeio | Neutro/pass-through: tia paga agência e repassa. Rastreado p/ controle |
| Alocação | Quartos com seleção de pessoas. Ônibus idem (assentos) |
| Banco | Supabase (ver §9 justificativa) |
| Front | Next.js 16 + React 19 + TypeScript + Tailwind, App Router. `output: export` (estático p/ Capacitor) |
| Estrutura | Código do app em `web/`. Planilhas + RASCUNHO.md = docs na raiz |
| Recibo | Não gerar |
| Nuvem | Sim, banco na nuvem (não perder dado se celular quebrar) |

## 4. Diagnóstico da planilha atual (problemas a corrigir)

- Dado duplicado em 2 arquivos + repetido entre abas → erro de cópia manual.
- Calcula "total a receber" (74.710) mas **não registra o que foi pago** (`Recebido = 0`).
- Saldo dá **-63.240** só porque receita não é lançada. Financeiro irreal.
- **Sem controle de parcelas**: sem datas, sem status pago/pendente.
- Sem "quanto falta" por pessoa (a dor principal).
- Despesas genéricas ("Despesas 7000", "Equipe 8000") sem detalhe.

## 5. Modelo de dados (rascunho — a validar)

### Excursao
- id, nome (ex: "Arraial do Cabo 2027"), destino, data_inicio, data_fim, status (planejada/ativa/encerrada)
- Relaciona: passageiros, despesas, receitas, ônibus, quartos, passeios

### Passageiro (por excursão)
- id, excursao_id, nome
- classe_valor_id (FK → ClasseValor) — define preço padrão
- valor_total (herda da classe, mas editável/livre por pessoa)
- valor_pago (SOMA dos pagamentos — calculado)
- saldo_devedor (valor_total − valor_pago — calculado)
- status_pagamento (em dia / atrasado / quitado)
- plano_parcelamento (opcional)

### ClasseValor (tabela de preços por excursão)
- id, excursao_id, nome (ex: "Normal", "Família", "Meia", "Inteira", "Criança")
- valor_padrao
- Função: preenchimento em massa — define valor da classe → aplica a todos passageiros dela

### Parcela
- id, passageiro_id, numero (1..N)
- valor
- vencimento (data)
- status (pendente / paga / atrasada)
- data_pagamento (quando paga)
- pagamento_id (link ao lançamento real)

### Pagamento (lançamento de entrada real)
- id, passageiro_id, parcela_id (opcional), excursao_id
- valor, data, forma (Pix / dinheiro / cartão / transferência)
- observação

### Despesa
- id, excursao_id
- nome (ex: "Ônibus", "Xareu", "Rodízio")
- classe_id (FK → ClasseDespesa)
- valor
- status (previsto / pago)
- data, observação (detalhável)

### CategoriaDespesa (criada pelo usuário)
- id, nome (ex: "Transporte", "Hospedagem", "Outros", "Alimentação")
- Despesa referencia categoria. Relatório organiza por categoria.
- (empresa_id no futuro multi-tenant)

### Passeio (dentro da viagem) — NEUTRO / pass-through
- id, excursao_id, nome (ex: "Passeio de bugre"), fornecedor/agência
- valor_unitario (por pessoa)
- participantes: lista de passageiros que aderiram
- Fluxo: tia paga a agência (saída) e recebe do passageiro (entrada). Net ~zero.
- Objetivo: controle de quem foi e se pagou. Registra entrada+saída, mas não conta como lucro.

### Onibus
- id, excursao_id, identificação, capacidade, custo, fornecedor
- assentos/alocação: seleciona passageiros do ônibus (mesma lógica do quarto)

### Quarto / Hospedagem
- id, excursao_id, hotel, tipo, capacidade, custo
- ocupantes: seleciona passageiros do quarto (alocação)

## 6. Funções de negócio (rascunho)

### Parcelamento (MVP: SEM juros)
```
gerarParcelas(valorTotal, numParcelas, dataPrimeira):
    valor_parcela = arredonda(valorTotal / numParcelas)
    parcelas = []
    para i em 1..numParcelas:
        parcelas.add({numero:i, valor:valor_parcela, vencimento: dataPrimeira + (i-1) meses, status:'pendente'})
    # última parcela absorve diferença de centavos p/ fechar o total exato
    ajusta_ultima_parcela(parcelas, valorTotal)
    return parcelas
```
> JUROS: adiado. Deixar `juros_tipo` (nenhum/simples/price) e `juros_taxa` no schema como
> campos opcionais, default "nenhum". Liga depois sem migração dolorosa.

### Registro de pagamento
```
registrarPagamento(passageiro, valor, data, forma, parcela?):
    cria Pagamento
    se parcela: marca parcela.status = 'paga', parcela.data_pagamento = data
    recalcula passageiro.valor_pago, saldo_devedor, status_pagamento
```

### Status de inadimplência
```
atualizarStatus(passageiro):
    se saldo_devedor == 0: 'quitado'
    senão se existe parcela pendente com vencimento < hoje: 'atrasado'
    senão: 'em dia'
# Ação hoje: tia só cobra manualmente. (Futuro: notificação/lembrete.)
```

### Resumo financeiro da excursão
```
resumoExcursao(excursao):
    total_a_receber = soma(passageiro.valor_total)
    total_recebido  = soma(pagamento.valor)
    total_despesas  = soma(despesa.valor)
    lucro_previsto  = total_a_receber - total_despesas
    lucro_realizado = total_recebido - despesas_pagas
    saldo_caixa     = total_recebido - despesas_pagas
    inadimplentes   = passageiros com status 'atrasado'
```

## 7. Dúvidas em aberto (perguntar)

- [x] Passeio → neutro/pass-through, rastreado.
- [x] **Juros**: ADIADO. MVP sem juros (valor ÷ nº parcelas). Schema deixa campos opcionais.
- [x] Preço → livre + classes de valor (normal/família/meia/etc), preenchimento em massa.
- [x] Ônibus/quartos → com alocação de pessoas.
- [x] **Forma de pagamento** → não importa. Campo opcional/livre (Pix/cartão/boleto). Não é obrigatório.
- [x] Recibo → não.
- [x] Nuvem → sim (banco Supabase).

## 9. Decisão de banco/back-end: Supabase (Postgres)

**Escolha: Supabase.** Motivos:
- Dado é **relacional e financeiro** (excursão → passageiros → parcelas → pagamentos, com SOMAs, JOINs, saldo). Postgres (SQL) faz isso nativo. Firestore (NoSQL) sofre com agregação e relatório.
- **Multi-tenant futuro** via Row Level Security (RLS) nativo do Postgres — isola empresas com 1 política.
- **Auth incluso** (login, recuperação de senha, perfis) — pronto p/ quando abrir multi-usuário.
- **Storage incluso** (arquivos/comprovantes futuros).
- Cliente JS funciona no **Capacitor** sem atrito.
- Free tier suficiente pro início.

Firebase seria melhor só se fosse app muito realtime/offline-first sem relatório pesado — não é o caso.
⚠️ Ponto de atenção: offline. App vai rodar em viagem (sinal ruim). Ver §10.

## 10. Offline (a decidir na Fase de arquitetura)

- DECIDIDO: offline NÃO é requisito do MVP. Tia evita usar quando sem sinal.
- App online-first puro (Supabase direto). Sem fila de sync no MVP. Simplifica muito.
- Reavaliar se virar dor no uso real.

## 11. MODELO DE DADOS FINAL (validar)

Convenção: `empresa_id` já entra nas tabelas-topo (custa 1 coluna, evita migração dolorosa
quando ligar multi-empresa + RLS). MVP roda com 1 empresa fixa.

### Tabelas

**empresa** (multi-tenant; MVP = 1 linha)
- id, nome

**excursao**
- id, empresa_id → empresa
- nome, destino, data_inicio, data_fim
- status (planejada | ativa | encerrada)

**classe_valor** (tabela de preços da excursão)
- id, excursao_id → excursao
- nome (Normal, Família, Meia, Criança…), valor_padrao

**cliente** (pessoa; reusada entre excursões)
- id, empresa_id → empresa
- nome, telefone (opc)
- Uma pessoa = 1 cliente. Vai em N excursões via `passageiro`.

**passageiro** (inscrição de um cliente numa excursão = junção cliente × excursao)
- id, excursao_id → excursao, cliente_id → cliente
- classe_valor_id → classe_valor (opc)
- valor_total (herda da classe, editável)
- juros_tipo (nenhum | simples | price) default 'nenhum'  ← reservado p/ futuro
- juros_taxa (opc)
- obs

**parcela**
- id, passageiro_id → passageiro
- numero, valor, vencimento (data)
- status (pendente | paga | atrasada)
- data_pagamento (opc)

**pagamento** (entrada real de dinheiro)
- id, passageiro_id → passageiro
- parcela_id → parcela (opc; pagamento pode ser avulso)
- valor, data
- forma (opc, texto livre: Pix/cartão/boleto)
- obs

**categoria_despesa**
- id, empresa_id → empresa
- nome (Transporte, Hospedagem, Outros…)

**despesa**
- id, excursao_id → excursao
- nome (ex: "Equipe", "Xareu")
- categoria_id → categoria_despesa
- valor, status (previsto | pago), data (opc), obs

**passeio** (neutro / pass-through)
- id, excursao_id → excursao
- nome, fornecedor, valor_unitario
- NÃO entra no lucro

**passeio_participante** (junção)
- passeio_id → passeio, passageiro_id → passageiro
- pago (bool)

**onibus**
- id, excursao_id → excursao
- nome, capacidade, custo, fornecedor

**onibus_passageiro** (alocação/junção)
- onibus_id → onibus, passageiro_id → passageiro, assento (opc)

**quarto**
- id, excursao_id → excursao
- hotel, tipo, capacidade, custo

**quarto_passageiro** (alocação/junção)
- quarto_id → quarto, passageiro_id → passageiro

### Campos CALCULADOS (views, não guardar — evita dessincronizar)
- `passageiro.valor_pago`   = SUM(pagamento.valor onde passageiro_id)
- `passageiro.saldo`        = valor_total − valor_pago
- `passageiro.status`       = saldo==0 → quitado; parcela vencida pendente → atrasado; senão em dia
- `resumo_excursao`:
  - total_a_receber  = SUM(passageiro.valor_total)
  - total_recebido   = SUM(pagamento.valor)
  - total_despesas   = SUM(despesa.valor)
  - despesas_pagas   = SUM(despesa.valor onde status=pago)
  - lucro_previsto   = total_a_receber − total_despesas
  - saldo_caixa      = total_recebido − despesas_pagas
  - inadimplentes    = passageiros status=atrasado
  - (passeio fica de fora do lucro — é neutro)

### Diagrama (relações)
```
empresa
 ├─< cliente ───────────────< passageiro (mesma pessoa, N excursões)
 ├─< categoria_despesa
 └─< excursao
       ├─< classe_valor
       ├─< passageiro (>── cliente) ─< parcela
       │        │                     └─< pagamento (parcela_id opc)
       │        └─< pagamento (avulso / personalizado)
       ├─< despesa >── categoria_despesa
       ├─< passeio ─< passeio_participante >── passageiro   (neutro)
       ├─< onibus  ─< onibus_passageiro   >── passageiro
       └─< quarto  ─< quarto_passageiro   >── passageiro
```

## 12. Status do setup

- [x] Next 16 + React 19 + TS + Tailwind em `web/` (build estático OK, gera `out/`)
- [x] `output: export` + `images.unoptimized` configurado (Capacitor-ready)
- [x] `@supabase/supabase-js` instalado + cliente em `web/src/lib/supabase.ts`
- [x] Projeto Supabase criado: `gestor-excursoes` (ref `mzdlcqmufybgddfafixn`, região sa-east-1)
- [x] Migration aplicada: 15 tabelas + 2 views + RLS. Advisors ERROS resolvidos (views security_invoker)
- [x] `.env.local` com URL + chave publishable
- [~] **Auth DESABILITADO (dev)**. RLS liberado p/ `anon`. ⚠️ REATIVAR antes de dado real/produção.
- [x] shadcn/ui + IBM Plex Sans + tokens (verde saldo / vermelho dívida) + Toaster
- [x] Tela 1: lista de excursões + criar (`/`)
- [x] Tela 2: dashboard financeiro + passageiros + registrar pagamento (`/excursao?id=`)
- [x] Build OK + CRUD validado ponta-a-ponta via anon key (read/insert/delete)
- [ ] Módulos restantes: despesas, passeios, ônibus/quartos (alocação), parcelas
- [ ] Integrar Capacitor → gerar APK (fase final)

> Nota RLS: política `USING(true)` p/ `authenticated` = WARN intencional. Só a tia tem conta no MVP.
> Upgrade multi-empresa: trocar por `empresa_id = empresa_do_usuario()`.
> Nota Auth: como RLS só libera `authenticated`, o app PRECISA de login já no MVP
> (senão a chave pública anon não lê nada — o que é o correto p/ proteger dado financeiro).

## 8. Fora do MVP (registrar p/ depois)

- Multi-empresa (multi-tenant), multi-usuário, permissões/perfis.
- Check-in de passageiros, lista de embarque.
- Contratos, documentos.
- Comunicação com cliente (WhatsApp), notificações automáticas.
- Cancelamento/reembolso formal.
- Relatórios avançados, indicadores, exportações.
