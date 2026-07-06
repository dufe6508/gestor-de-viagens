import type { ReactNode } from "react";

/*
 * Moldura padrão de gráfico/bloco de relatório: título, subtítulo opcional e
 * empty state embutido — todo widget novo herda o mesmo esqueleto.
 */
export function ChartCard({
  titulo,
  subtitulo,
  vazio,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  vazio?: string | false; // string = mensagem de empty state (substitui o conteúdo)
  children: ReactNode;
}) {
  return (
    <section className="glass-card glass-card-soft rounded-lg p-5">
      <header className="mb-4">
        <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
        {subtitulo && <p className="mt-0.5 text-xs text-faint">{subtitulo}</p>}
      </header>
      {vazio ? (
        <p className="py-6 text-center text-sm text-faint">{vazio}</p>
      ) : (
        children
      )}
    </section>
  );
}
