import type { ReactNode } from "react";

/*
 * Registry de widgets — cada aba de relatório declara seus widgets como DADOS
 * (id + nó), não JSX fixo. É o gancho da personalização (plano §7 / fase F5):
 * reordenar/ocultar por id com preferência salva, sem tocar nos widgets.
 */
export interface Widget {
  id: string;
  node: ReactNode;
  visivel?: boolean; // default true; F5 liga isso à preferência da usuária
}

export function renderWidgets(widgets: Widget[]): ReactNode {
  return (
    <div className="space-y-4">
      {widgets
        .filter((w) => w.visivel !== false)
        .map((w) => (
          <div key={w.id}>{w.node}</div>
        ))}
    </div>
  );
}
