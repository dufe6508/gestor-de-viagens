export type StatusExcursao = "planejada" | "ativa" | "encerrada";

export interface Excursao {
  id: string;
  nome: string;
  destino: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  status: StatusExcursao;
}

export interface ResumoExcursao {
  excursao_id: string;
  nome: string;
  total_a_receber: number;
  total_recebido: number;
  total_despesas: number;
  despesas_pagas: number;
}
