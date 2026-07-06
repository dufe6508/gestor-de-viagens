import { describe, expect, it } from "vitest";
import {
  acumular,
  deltaPct,
  noRange,
  rangesDoPreset,
  somaNoRange,
  somaPorMes,
  somarDias,
  ultimasChavesMes,
} from "./metricas";

describe("rangesDoPreset", () => {
  it("este_mes compara parcial com parcial (mesmo dia do mês anterior)", () => {
    const r = rangesDoPreset("este_mes", "2026-07-06");
    expect(r.atual).toEqual({ de: "2026-07-01", ate: "2026-07-06" });
    expect(r.anterior).toEqual({ de: "2026-06-01", ate: "2026-06-06" });
  });

  it("clampa o dia quando o mês anterior é mais curto (31/mar → 28/fev)", () => {
    const r = rangesDoPreset("este_mes", "2026-03-31");
    expect(r.anterior).toEqual({ de: "2026-02-01", ate: "2026-02-28" });
  });

  it("este_mes em janeiro volta para dezembro do ano anterior", () => {
    const r = rangesDoPreset("este_mes", "2026-01-15");
    expect(r.anterior).toEqual({ de: "2025-12-01", ate: "2025-12-15" });
  });

  it("3_meses cobre o mês corrente + 2 anteriores × os 3 fechados antes", () => {
    const r = rangesDoPreset("3_meses", "2026-07-06");
    expect(r.atual).toEqual({ de: "2026-05-01", ate: "2026-07-06" });
    expect(r.anterior).toEqual({ de: "2026-02-01", ate: "2026-04-30" });
  });

  it("este_ano compara com o mesmo trecho do ano anterior", () => {
    const r = rangesDoPreset("este_ano", "2026-07-06");
    expect(r.atual).toEqual({ de: "2026-01-01", ate: "2026-07-06" });
    expect(r.anterior).toEqual({ de: "2025-01-01", ate: "2025-07-06" });
  });

  it("tudo é aberto e sem período anterior", () => {
    const r = rangesDoPreset("tudo", "2026-07-06");
    expect(r.atual).toEqual({ de: null, ate: null });
    expect(r.anterior).toBeNull();
  });
});

describe("noRange / somaNoRange", () => {
  const range = { de: "2026-07-01", ate: "2026-07-31" };

  it("inclui os limites (inclusivo)", () => {
    expect(noRange("2026-07-01", range)).toBe(true);
    expect(noRange("2026-07-31", range)).toBe(true);
    expect(noRange("2026-06-30", range)).toBe(false);
    expect(noRange("2026-08-01", range)).toBe(false);
  });

  it("sem data só conta no range aberto (Tudo)", () => {
    expect(noRange(null, range)).toBe(false);
    expect(noRange(null, { de: null, ate: null })).toBe(true);
  });

  it("soma apenas o que cai no range", () => {
    const itens = [
      { valor: 100, data: "2026-07-05" },
      { valor: 50, data: "2026-06-05" },
      { valor: 7, data: null },
    ];
    expect(somaNoRange(itens, range)).toBe(100);
    expect(somaNoRange(itens, { de: null, ate: null })).toBe(157);
  });
});

describe("deltaPct", () => {
  it("calcula variação relativa", () => {
    expect(deltaPct(120, 100)).toBeCloseTo(0.2);
    expect(deltaPct(80, 100)).toBeCloseTo(-0.2);
  });

  it("sem base de comparação retorna null", () => {
    expect(deltaPct(50, 0)).toBeNull();
  });

  it("base negativa (líquido) mantém o sinal intuitivo", () => {
    // de −100 para −50 = melhorou 50%
    expect(deltaPct(-50, -100)).toBeCloseTo(0.5);
  });
});

describe("séries mensais", () => {
  it("ultimasChavesMes cruza a virada do ano", () => {
    expect(ultimasChavesMes("2026-02-10", 4)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("somaPorMes agrupa no mês certo e ignora fora da janela / sem data", () => {
    const meses = ["2026-06", "2026-07"];
    const itens = [
      { valor: 10, data: "2026-06-01" },
      { valor: 5, data: "2026-06-30" },
      { valor: 7, data: "2026-07-06" },
      { valor: 99, data: "2026-01-01" },
      { valor: 3, data: null },
    ];
    expect(somaPorMes(itens, meses)).toEqual([15, 7]);
  });

  it("acumular soma corrida", () => {
    expect(acumular([10, -4, 6])).toEqual([10, 6, 12]);
  });

  it("somarDias cruza mês e ano", () => {
    expect(somarDias("2026-07-06", 7)).toBe("2026-07-13");
    expect(somarDias("2026-12-28", 7)).toBe("2027-01-04");
  });
});
