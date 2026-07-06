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
    expect(redistribuirParcelas(710, abertas)).toEqual([
      { id: "b", valor: 355 },
      { id: "c", valor: 355 },
    ]);
  });
});
